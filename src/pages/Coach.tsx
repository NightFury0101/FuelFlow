import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import { useAi } from '../lib/useAi';
import { usePremium } from '../lib/premium';
import { safeLocalStorage, uid } from '../lib/storage';
import type { AiConfig } from '../lib/ai';
import type { CoachProvider } from '../lib/aiConsent';
import { askCoach, buildContext, CoachError, loadMessages, saveMessages, STARTERS, MAX_CHARS, type CoachMessage } from '../lib/coach';
import { Card } from '../components/ui';
import { Icon } from '../components/Icon';
import { Link } from '../router';
import { consentId, disclosure, hasConsent } from '../lib/aiConsent';
import { getPremiumConfig } from '../lib/billing';

/** Minimal, safe formatter for coach replies: paragraphs, bullet/numbered lists, **bold**, ### headings. No HTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.length > 2 && part.startsWith('*') && part.endsWith('*') ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      part
    ),
  );
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const num = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet || num)![1]);
      continue;
    }
    flush();
    if (!line) continue;
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    blocks.push(h ? <p key={blocks.length} className="rt-h">{inline(h[1])}</p> : <p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="rich">{blocks}</div>;
}

export function Coach() {
  const store = useStore();
  const profile = store.profile!;
  const ai = useAi();
  const premium = usePremium();
  const ls = safeLocalStorage();
  const [messages, setMessages] = useState<CoachMessage[]>(() => loadMessages(ls));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const share = profile.coachShareLog;
  const premiumProvider = getPremiumConfig().coachProvider;
  const cid = ai ? consentId(ai, premiumProvider) : null;
  const allowed = !!cid && hasConsent(profile, cid);
  const [shareChoice, setShareChoice] = useState(false);

  useEffect(() => saveMessages(ls, messages), [messages, ls]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, busy]);
  useEffect(() => () => ctrl.current?.abort(), []);

  const send = async (text: string) => {
    const q = text.trim().slice(0, MAX_CHARS);
    // Nothing is sent to an AI company without permission for that company (App Store 5.1.2(i)).
    if (!q || busy || !ai || !allowed) return;
    const userMsg: CoachMessage = { id: uid('c-'), role: 'user', text: q, at: Date.now() };
    const history = [...messages.filter((m) => !m.error), userMsg];
    setMessages((m) => [...m.filter((x) => !x.error), userMsg]);
    setInput('');
    setBusy(true);
    const c = new AbortController();
    ctrl.current = c;
    try {
      const reply = await askCoach(ai, history, buildContext(profile, store.data, !!share), c.signal);
      setMessages((m) => [...m, { id: uid('c-'), role: 'assistant', text: reply, at: Date.now() }]);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const msg = e instanceof CoachError ? e.message : 'Something went wrong. Try again.';
      setMessages((m) => [...m, { id: uid('c-'), role: 'assistant', text: msg, at: Date.now(), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages((m) => m.filter((x) => !x.error && x.id !== lastUser.id));
    send(lastUser.text);
  };

  return (
    <div className="page coach">
      <header className="page-head">
        <div>
          <h1>Nutrition coach</h1>
          <p className="muted small">Food and nutrition questions, answered for you</p>
        </div>
        {messages.length > 0 && (
          <button
            className="icon-btn"
            aria-label="Clear conversation"
            title="Clear conversation"
            onClick={() => {
              const old = messages;
              setMessages([]);
              store.showToast('Conversation cleared', () => setMessages(old));
            }}
          >
            <Icon name="trash" size={18} />
          </button>
        )}
      </header>

      {!ai ? (
        <Card className="setup-card">
          <div className="setup-hero" aria-hidden="true">
            <div className="setup-frame">
              <Icon name="sparkles" size={44} />
            </div>
          </div>
          <h2>Connect your nutrition coach</h2>
          {premium.available && premium.coachUrl ? (
            <>
              <p className="muted">Ask anything about food — meal ideas that fit your day, labels, cravings, eating out. With Premium the coach is built in: no key, no setup.</p>
              <Link to="/premium" className="btn btn-primary block">
                <Icon name="crown" size={18} /> Get Premium
              </Link>
              <Link to="/profile?section=ai" className="btn btn-ghost block">
                Or use your own free key
              </Link>
            </>
          ) : (
            <>
              <p className="muted">Ask anything about food — meal ideas that fit your day, labels, cravings, eating out. Connect it once with a free Gemini key (or Claude); the key stays on this device.</p>
              <Link to="/profile?section=ai" className="btn btn-primary block">
                Add API key
              </Link>
            </>
          )}
        </Card>
      ) : (
        <>
          {!allowed ? (
            <ConsentCard
              ai={ai}
              provider={premiumProvider}
              share={shareChoice}
              setShare={setShareChoice}
              onAllow={() => store.updateProfile({ aiConsent: cid!, coachShareLog: shareChoice })}
            />
          ) : (
            <>
          <button className={'share-toggle' + (share ? ' on' : '')} role="switch" aria-checked={!!share} onClick={() => store.updateProfile({ coachShareLog: !share })}>
            <Icon name={share ? 'diary' : 'lock'} size={16} />
            <span>{share ? 'Coach can see your food log' : 'Coach can’t see your food log'}</span>
            <span className="switch" aria-hidden="true">
              <span />
            </span>
          </button>

          {messages.length === 0 ? (
            <div className="coach-empty">
              <div className="coach-avatar lg">
                <Icon name="sparkles" size={26} />
              </div>
              <p className="muted center">Ask about meals, macros, labels, cravings, eating out or anything else about food.</p>
              <div className="starters">
                {STARTERS.map((s) => (
                  <button key={s} className="starter" onClick={() => send(s)} disabled={busy}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="chat" aria-live="polite">
              {messages.map((m) => (
                <li key={m.id} className={`msg msg-${m.role}` + (m.error ? ' msg-error' : '')}>
                  {m.role === 'assistant' && (
                    <span className="coach-avatar" aria-hidden="true">
                      <Icon name={m.error ? 'alert' : 'sparkles'} size={14} />
                    </span>
                  )}
                  <div className="bubble">
                    {m.role === 'assistant' && !m.error ? <RichText text={m.text} /> : <p>{m.text}</p>}
                    {m.error && (
                      <button className="link-btn" onClick={retry}>
                        <Icon name="refresh" size={14} /> Try again
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {busy && (
                <li className="msg msg-assistant">
                  <span className="coach-avatar" aria-hidden="true">
                    <Icon name="sparkles" size={14} />
                  </span>
                  <div className="bubble typing" aria-label="Coach is typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </li>
              )}
            </ol>
          )}
          <div ref={endRef} />

          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              rows={1}
              value={input}
              maxLength={MAX_CHARS}
              placeholder="Ask about food or nutrition…"
              aria-label="Message the coach"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button className="send" type="submit" disabled={!input.trim() || busy} aria-label="Send">
              <Icon name="up" size={20} />
            </button>
          </form>
          <p className="muted small center coach-note">
            Answers come from {disclosure(ai, premiumProvider).recipient}. Suggestions only — not medical advice. For health conditions, talk to a doctor or registered dietitian.
          </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Shown before the first question to a given AI company, and again if permission is withdrawn
 *  or the coach is switched to another company. Nothing is sent until Allow is tapped. */
function ConsentCard({ ai, provider, share, setShare, onAllow }: { ai: AiConfig; provider: CoachProvider; share: boolean; setShare: (v: boolean) => void; onAllow: () => void }) {
  const d = disclosure(ai, provider);
  return (
    <Card className="consent">
      <p className="consent-title">
        <Icon name="lock" size={16} /> Before you ask the coach
      </p>
      <p className="small">
        To answer you, FuelFlow sends data to <strong>{d.recipient}</strong>, a third-party AI service. It’s used only to write the coach’s reply.
      </p>
      <p className="small">What’s sent with each question:</p>
      <ul className="small consent-list">
        <li>What you type, and your recent messages in this chat</li>
        <li>Your goal, daily targets, units and dietary preferences</li>
        <li>Whether you noted pregnancy, breastfeeding or a medical condition (not which one)</li>
        <li>Only if you turn it on below: a summary of your food log — today’s foods, totals, planned meals and water, last week’s averages, and your latest weight and 30-day change</li>
      </ul>
      <p className="muted small">Not sent: your name, email, date of birth or account details.{d.note ? ' ' + d.note : ''}</p>
      <button type="button" className={'share-toggle' + (share ? ' on' : '')} role="switch" aria-checked={share} onClick={() => setShare(!share)}>
        <Icon name={share ? 'diary' : 'lock'} size={16} />
        <span>Also share my food log summary</span>
        <span className="switch" aria-hidden="true">
          <span />
        </span>
      </button>
      <div className="sheet-actions">
        <Link to="/" className="btn btn-ghost grow">
          Not now
        </Link>
        <button type="button" className="btn btn-primary grow" onClick={onAllow}>
          Allow
        </button>
      </div>
      <p className="muted small">
        You can withdraw this any time in Profile → AI nutrition coach. See our{' '}
        <Link to="/privacy" className="accent">
          privacy policy
        </Link>
        .
      </p>
    </Card>
  );
}
