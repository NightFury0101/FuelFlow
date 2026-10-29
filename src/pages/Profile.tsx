import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Activity, Goal, Sex, SpecialCircumstance, Targets, UnitPrefs } from '../lib/types';
import { useStore } from '../lib/store';
import { ACTIVITY, balanceCarbs, calculateTargets } from '../lib/targets';
import { ageFromBirthDate, isValidDateKey, todayKey } from '../lib/date';
import { backupJson, diaryCsv, progressCsv, uid } from '../lib/storage';
import { displayWater, displayWeight, weightToKg, weightValue, waterToMl, ML_PER_FLOZ } from '../lib/units';
import { getApiKey, getProvider, isValidEndpoint, looksLikeKey, maskKey, PROVIDER_INFO, resolveAi, setApiKey, setProvider, testKey, type Provider } from '../lib/ai';
import { BILLING_ENABLED } from '../lib/plans';
import { Card, Field, NumberInput, Segmented, parseNum } from '../components/ui';
import { Icon } from '../components/Icon';
import { TargetReview } from './Onboarding';
import { Link, useRoute } from '../router';

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Profile() {
  const store = useStore();
  const profile = store.profile!;
  const route = useRoute();
  const section = route.query.get('section');
  const refs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (section && refs.current[section]) refs.current[section]!.scrollIntoView({ block: 'start' });
  }, [section]);

  const goalLabel = { lose: 'Losing weight', maintain: 'Maintaining weight', gain: 'Gaining weight' }[profile.goal];

  return (
    <div className="page profile">
      <header className="profile-head">
        <div className="avatar lg">{profile.name.charAt(0).toUpperCase()}</div>
        <div>
          <h1>{profile.name}</h1>
          <p className="muted small">
            {goalLabel} · {profile.targets.kcal.toLocaleString()} kcal / day
          </p>
        </div>
      </header>

      <div
        ref={(el) => {
          refs.current.body = el;
        }}
      >
        <BodySection />
      </div>
      <TargetsSection />
      <UnitsSection />
      <MealsSection />
      <div
        ref={(el) => {
          refs.current.ai = el;
        }}
      >
        <CoachSection />
      </div>

      <Card title="FuelFlow Premium" icon="crown">
        <p className="muted small">{BILLING_ENABLED ? 'Manage your subscription.' : 'You’re on the free plan. Every feature is currently available while billing isn’t set up.'}</p>
        <Link to="/premium" className="btn btn-secondary sm">
          See plans
        </Link>
      </Card>

      <DataSection />

      <p className="muted small center foot-note">FuelFlow gives estimates for general wellbeing, not medical advice.</p>
    </div>
  );
}

function BodySection() {
  const store = useStore();
  const p = store.profile!;
  const u = p.units;
  const [name, setName] = useState(p.name);
  const [sex, setSex] = useState<Sex>(p.sex);
  const [birth, setBirth] = useState(p.birthDate ?? '');
  const [height, setHeight] = useState(p.heightCm ? String(p.heightCm) : '');
  const latest = [...store.data.weights].sort((a, b) => b.date.localeCompare(a.date))[0];
  const currentKg = latest?.kg ?? p.startWeightKg;
  const [weight, setWeight] = useState(currentKg ? String(weightValue(currentKg, u)) : '');
  const [goal, setGoal] = useState<Goal>(p.goal);
  const [goalWeight, setGoalWeight] = useState(p.goalWeightKg ? String(weightValue(p.goalWeightKg, u)) : '');
  const [activity, setActivity] = useState<Activity>(p.activity);
  const [special, setSpecial] = useState<SpecialCircumstance>(p.special);
  const [review, setReview] = useState<{ targets: Targets; result: ReturnType<typeof calculateTargets> } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const recalc = () => {
    const age = isValidDateKey(birth) ? ageFromBirthDate(birth) : NaN;
    const h = parseNum(height);
    const wKg = weightToKg(parseNum(weight), u);
    const gKg = goalWeight ? weightToKg(parseNum(goalWeight), u) : undefined;
    if (!(age >= 13 && age < 110)) return setErr('Enter a valid date of birth (13+).');
    if (!(h >= 100 && h <= 250)) return setErr('Enter your height in cm.');
    if (!(wKg >= 30 && wKg <= 350)) return setErr('Enter your current weight.');
    if (gKg != null && !(gKg >= 30 && gKg <= 350)) return setErr('Enter a realistic goal weight.');
    setErr(null);
    const result = calculateTargets({ sex, age, heightCm: h, weightKg: wKg, goalWeightKg: gKg, activity, goal, special });
    setReview({ targets: result.targets, result });
  };

  const apply = () => {
    if (!review) return;
    const gKg = goalWeight ? weightToKg(parseNum(goalWeight), u) : undefined;
    store.updateProfile({
      name: name.trim() || p.name,
      sex,
      birthDate: birth,
      heightCm: Math.round(parseNum(height)),
      goal: review.result.appliedGoal,
      goalWeightKg: gKg ? Math.round(gKg * 10) / 10 : undefined,
      activity,
      special,
      targets: review.targets,
      targetsCustomized: JSON.stringify(review.targets) !== JSON.stringify(review.result.targets),
      setupIncomplete: false,
      startWeightKg: p.startWeightKg ?? Math.round(weightToKg(parseNum(weight), u) * 10) / 10,
    });
    if (!latest) store.addWeight({ date: todayKey(), kg: Math.round(weightToKg(parseNum(weight), u) * 10) / 10 });
    setReview(null);
    store.showToast('Profile and targets updated');
  };

  return (
    <Card title="Body & goal" icon="user">
      <div className="form">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && store.updateProfile({ name: name.trim() })} maxLength={40} />
        </Field>
        <Field label="Sex used for calculation">
          <Segmented<Sex>
            label="Sex"
            value={sex}
            onChange={setSex}
            options={[
              { value: 'female', label: 'Female' },
              { value: 'male', label: 'Male' },
              { value: 'unspecified', label: 'Not set' },
            ]}
          />
        </Field>
        <div className="row-2">
          <Field label="Date of birth">
            <input type="date" value={birth} max={todayKey()} onChange={(e) => setBirth(e.target.value)} />
          </Field>
          <Field label="Height">
            <NumberInput value={height} onChange={setHeight} suffix="cm" ariaLabel="Height in cm" />
          </Field>
          <Field label="Current weight">
            <NumberInput value={weight} onChange={setWeight} step={0.1} suffix={u.weight} ariaLabel="Current weight" />
          </Field>
          <Field label="Goal weight">
            <NumberInput value={goalWeight} onChange={setGoalWeight} step={0.1} suffix={u.weight} ariaLabel="Goal weight" />
          </Field>
        </div>
        <Field label="Goal">
          <Segmented<Goal>
            label="Goal"
            value={goal}
            onChange={setGoal}
            options={[
              { value: 'lose', label: 'Lose' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'gain', label: 'Gain' },
            ]}
          />
        </Field>
        <Field label="Activity">
          <select value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
            {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
              <option key={a} value={a}>
                {ACTIVITY[a].label} — {ACTIVITY[a].hint}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Special circumstances">
          <select value={special} onChange={(e) => setSpecial(e.target.value as SpecialCircumstance)}>
            <option value="none">None</option>
            <option value="pregnant">Pregnant</option>
            <option value="breastfeeding">Breastfeeding</option>
            <option value="medical">Medical condition affects diet</option>
          </select>
        </Field>
        {err && <p className="notice warn">{err}</p>}
        {!review && (
          <button className="btn btn-secondary" onClick={recalc}>
            <Icon name="refresh" size={16} /> Recalculate targets
          </button>
        )}
        {review && (
          <div className="review-box">
            <TargetReview
              targets={review.targets}
              setTargets={(t) => setReview((r) => (r ? { ...r, targets: t } : r))}
              result={review.result}
              goalLabel={goal}
              weightLabel={displayWeight(weightToKg(parseNum(weight), u), u)}
              goalWeightLabel={goalWeight ? displayWeight(weightToKg(parseNum(goalWeight), u), u) : undefined}
            />
            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={() => setReview(null)}>
                Cancel
              </button>
              <button className="btn btn-primary grow" onClick={apply}>
                Use these targets
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TargetsSection() {
  const store = useStore();
  const p = store.profile!;
  const [t, setT] = useState(p.targets);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setT(p.targets);
    setDirty(false);
  }, [p.targets]);
  const set = (k: keyof Targets, v: string) => {
    const n = Math.round(parseNum(v));
    if (!Number.isFinite(n)) return;
    const next = { ...t, [k]: k === 'waterMl' ? waterToMl(n, p.units) : n };
    if (k === 'kcal' || k === 'protein' || k === 'fat') next.carbs = balanceCarbs(next);
    setT(next);
    setDirty(true);
  };
  const valid = t.kcal >= 1000 && t.kcal <= 6000 && t.protein >= 0 && t.fat >= 0 && t.waterMl >= 500 && t.waterMl <= 6000;
  const waterShown = p.units.water === 'floz' ? Math.round(t.waterMl / ML_PER_FLOZ) : t.waterMl;
  return (
    <Card title="Daily targets" icon="target">
      <div className="row-2">
        <Field label="Calories" error={t.kcal < 1000 ? 'Targets below 1,000 kcal need medical supervision' : null}>
          <NumberInput value={String(t.kcal)} onChange={(v) => set('kcal', v)} suffix="kcal" ariaLabel="Calorie target" />
        </Field>
        <Field label="Protein">
          <NumberInput value={String(t.protein)} onChange={(v) => set('protein', v)} suffix="g" ariaLabel="Protein target" />
        </Field>
        <Field label="Fat">
          <NumberInput value={String(t.fat)} onChange={(v) => set('fat', v)} suffix="g" ariaLabel="Fat target" />
        </Field>
        <Field label="Carbs" hint="Fills remaining calories">
          <NumberInput value={String(t.carbs)} onChange={(v) => set('carbs', v)} suffix="g" ariaLabel="Carbs target" />
        </Field>
        <Field label="Water">
          <NumberInput value={String(waterShown)} onChange={(v) => set('waterMl', v)} suffix={p.units.water === 'floz' ? 'fl oz' : 'ml'} ariaLabel="Water target" />
        </Field>
      </div>
      {dirty && (
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => (setT(p.targets), setDirty(false))}>
            Reset
          </button>
          <button
            className="btn btn-primary grow"
            disabled={!valid}
            onClick={() => {
              store.updateProfile({ targets: t, targetsCustomized: true });
              store.showToast('Targets saved');
            }}
          >
            Save targets
          </button>
        </div>
      )}
    </Card>
  );
}

function UnitsSection() {
  const store = useStore();
  const p = store.profile!;
  const set = (patch: Partial<UnitPrefs>) => store.updateProfile({ units: { ...p.units, ...patch } });
  return (
    <Card title="Units" icon="settings">
      <div className="form">
        <Field label="Weight">
          <Segmented label="Weight unit" value={p.units.weight} onChange={(v) => set({ weight: v })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </Field>
        <Field label="Water">
          <Segmented label="Water unit" value={p.units.water} onChange={(v) => set({ water: v })} options={[{ value: 'ml', label: 'ml / L' }, { value: 'floz', label: 'fl oz' }]} />
        </Field>
        <Field label="Water quick-add buttons" hint={`Currently ${p.waterQuickAdds.map((m) => displayWater(m, p.units)).join(' and ')}`}>
          <Segmented
            label="Quick-add sizes"
            value={p.waterQuickAdds.join(',')}
            onChange={(v) => store.updateProfile({ waterQuickAdds: v.split(',').map(Number) })}
            options={[
              { value: '250,500', label: '250 · 500 ml' },
              { value: '200,330', label: '200 · 330 ml' },
              { value: '237,473', label: '8 · 16 fl oz' },
            ]}
          />
        </Field>
      </div>
    </Card>
  );
}

function MealsSection() {
  const store = useStore();
  const p = store.profile!;
  const [newName, setNewName] = useState('');
  const used = new Set([...store.data.entries, ...store.data.planned].map((e) => e.meal));
  return (
    <Card title="Meals" icon="utensils">
      <ul className="plain-list">
        {p.meals.map((m, i) => (
          <li key={m.id} className="plain-row">
            <input className="inline-input" value={m.name} aria-label={`Meal name ${i + 1}`} maxLength={24} onChange={(e) => store.updateProfile({ meals: p.meals.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)) })} />
            <button
              className="icon-btn sm"
              disabled={p.meals.length <= 1 || used.has(m.id)}
              title={used.has(m.id) ? 'This meal has logged food, so it can’t be removed' : 'Remove'}
              aria-label={`Remove ${m.name}`}
              onClick={() => store.updateProfile({ meals: p.meals.filter((x) => x.id !== m.id) })}
            >
              <Icon name="trash" size={16} />
            </button>
          </li>
        ))}
      </ul>
      <div className="row-add">
        <Field label="Add a meal" hint="e.g. Pre-workout, Late snack">
          <input value={newName} maxLength={24} onChange={(e) => setNewName(e.target.value)} />
        </Field>
        <button
          className="btn btn-secondary"
          disabled={!newName.trim() || p.meals.length >= 8}
          onClick={() => {
            store.updateProfile({ meals: [...p.meals, { id: uid('meal-'), name: newName.trim() }] });
            setNewName('');
          }}
        >
          Add
        </button>
      </div>
    </Card>
  );
}

function CoachSection() {
  const store = useStore();
  const p = store.profile!;
  type Mode = Provider | 'server';
  const [saved, setSaved] = useState<Record<Provider, string | null>>(() => ({ gemini: getApiKey('gemini'), claude: getApiKey('claude') }));
  const [active, setActive] = useState<Provider | null>(() => getProvider());
  const [mode, setMode] = useState<Mode>(() => getProvider() ?? (getApiKey('claude') ? 'claude' : p.scannerEndpoint ? 'server' : 'gemini'));
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [url, setUrl] = useState(p.scannerEndpoint ?? '');
  const [status, setStatus] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'fail'; text?: string }>({ kind: 'idle' });
  const validUrl = !url || isValidEndpoint(url);
  const provider: Provider | null = mode === 'server' ? null : mode;
  const keyOk = provider ? looksLikeKey(provider, key) : false;
  const savedKey = provider ? saved[provider] : null;
  const using = resolveAi(p.scannerEndpoint);

  const refresh = () => {
    setSaved({ gemini: getApiKey('gemini'), claude: getApiKey('claude') });
    setActive(getProvider());
  };

  const saveKey = async () => {
    if (!provider) return;
    setStatus({ kind: 'testing' });
    const r = await testKey(provider, key.trim());
    if (!r.ok) return setStatus({ kind: 'fail', text: r.message });
    setApiKey(provider, key.trim());
    refresh();
    setKey('');
    setStatus({ kind: 'ok', text: r.message });
    store.showToast(`${PROVIDER_INFO[provider].name} connected`);
  };

  const testSaved = async () => {
    if (!provider || !savedKey) return;
    setStatus({ kind: 'testing' });
    const r = await testKey(provider, savedKey);
    setStatus({ kind: r.ok ? 'ok' : 'fail', text: r.message });
  };

  const testServer = async () => {
    setStatus({ kind: 'testing' });
    try {
      const r = await fetch(url.replace(/\/$/, '') + '/health', { method: 'GET' });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; configured?: boolean };
      if (r.ok && j.ok) setStatus({ kind: j.configured === false ? 'fail' : 'ok', text: j.configured === false ? 'Server reached, but its AI key isn’t set.' : 'AI server is reachable and ready.' });
      else setStatus({ kind: 'fail', text: `Server answered with ${r.status}.` });
    } catch {
      setStatus({ kind: 'fail', text: 'Couldn’t reach that address. Check the URL and that it allows this site.' });
    }
  };

  const steps: Record<Provider, ReactNode> = {
    gemini: (
      <ol className="steps small">
        <li>
          Open{' '}
          <a href={PROVIDER_INFO.gemini.console} target="_blank" rel="noreferrer" className="accent">
            aistudio.google.com/apikey
          </a>{' '}
          and sign in with a Google account.
        </li>
        <li>
          Tap <strong>Create API key</strong> and copy it. No card needed for the free tier.
        </li>
        <li>Paste it below and tap Connect.</li>
      </ol>
    ),
    claude: (
      <ol className="steps small">
        <li>
          Sign in at{' '}
          <a href={PROVIDER_INFO.claude.console} target="_blank" rel="noreferrer" className="accent">
            console.anthropic.com
          </a>{' '}
          and add a little credit under Billing.
        </li>
        <li>
          Go to <strong>API keys → Create key</strong>, copy it.
        </li>
        <li>Paste it below and tap Connect.</li>
      </ol>
    ),
  };

  return (
    <Card title="AI nutrition coach" icon="sparkles">
      <div className="form">
        {using && (
          <p className="muted small">
            Coach is using: <strong className="fg">{using.kind === 'server' ? 'your own server' : PROVIDER_INFO[using.provider].name}</strong>
          </p>
        )}
        <Segmented<Mode>
          label="Which AI to use"
          value={mode}
          onChange={(v) => (setMode(v), setStatus({ kind: 'idle' }), setKey(''))}
          options={[
            { value: 'gemini', label: 'Gemini · free' },
            { value: 'claude', label: 'Claude' },
            { value: 'server', label: 'Own server' },
          ]}
        />

        {provider ? (
          savedKey ? (
            <>
              <div className="key-row">
                <Icon name="lock" size={16} />
                <span>
                  <strong>{PROVIDER_INFO[provider].name} connected</strong>
                  <span className="muted small block">Key {maskKey(savedKey)} · stored on this device only</span>
                </span>
              </div>
              {active !== provider && (
                <button
                  className="btn btn-primary block"
                  onClick={() => {
                    setProvider(provider);
                    refresh();
                    store.showToast(`Coach now uses ${PROVIDER_INFO[provider].name}`);
                  }}
                >
                  Use {PROVIDER_INFO[provider].name} for the coach
                </button>
              )}
              <div className="sheet-actions">
                <button
                  className="btn btn-ghost danger"
                  onClick={() => {
                    if (!window.confirm(`Remove the ${PROVIDER_INFO[provider].name} key from this device?`)) return;
                    setApiKey(provider, null);
                    refresh();
                    setStatus({ kind: 'idle' });
                    store.showToast('API key removed');
                  }}
                >
                  Remove
                </button>
                <button className="btn btn-secondary grow" disabled={status.kind === 'testing'} onClick={testSaved}>
                  Test connection
                </button>
              </div>
            </>
          ) : (
            <>
              {steps[provider]}
              <Field label={`${PROVIDER_INFO[provider].name} API key`} error={key && !keyOk ? (provider === 'claude' ? 'Claude keys start with sk-ant-' : 'Gemini keys start with AIza') : null}>
                <div className="key-input">
                  <input
                    type={show ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => (setKey(e.target.value.trim()), setStatus({ kind: 'idle' }))}
                    placeholder={PROVIDER_INFO[provider].placeholder}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-label={`${PROVIDER_INFO[provider].name} API key`}
                  />
                  <button type="button" className="link-btn" onClick={() => setShow((x) => !x)}>
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>
              <button className="btn btn-primary block" disabled={!keyOk || status.kind === 'testing'} onClick={saveKey}>
                {status.kind === 'testing' ? 'Checking…' : 'Connect'}
              </button>
            </>
          )
        ) : (
          <>
            <p className="muted small">
              For when other people use your FuelFlow: a small Cloudflare server holds a Claude key instead of each phone. Setup guide: <code>server/README.md</code>.
            </p>
            <Field label="AI server URL" error={!validUrl ? 'Use an https:// address' : null}>
              <input type="url" inputMode="url" placeholder="https://fuelflow-coach.yourname.workers.dev" value={url} onChange={(e) => (setUrl(e.target.value.trim()), setStatus({ kind: 'idle' }))} />
            </Field>
            <div className="sheet-actions">
              <button className="btn btn-ghost" disabled={!url || !validUrl || status.kind === 'testing'} onClick={testServer}>
                Test
              </button>
              <button
                className="btn btn-primary grow"
                disabled={!validUrl || url === (p.scannerEndpoint ?? '')}
                onClick={() => {
                  store.updateProfile({ scannerEndpoint: url || undefined });
                  store.showToast(url ? 'AI server saved' : 'AI server removed');
                }}
              >
                Save
              </button>
            </div>
            {(saved.gemini || saved.claude) && <p className="muted small">An API key is also saved on this device and is used before the server.</p>}
          </>
        )}
        {status.kind !== 'idle' && <p className={'notice' + (status.kind === 'fail' ? ' warn' : status.kind === 'ok' ? ' ok' : '')}>{status.kind === 'testing' ? 'Testing…' : status.text}</p>}
        {provider === 'gemini' && (
          <p className="muted small">
            Gemini’s free tier has daily limits, and Google may use free-tier conversations to improve its products. Your key is kept only in this browser — not in backups, not on GitHub.
          </p>
        )}
        {provider === 'claude' && (
          <p className="muted small">
            Claude is pay-as-you-go — usually under 1 cent per question. Set a monthly limit in the Anthropic console. Your key is kept only in this browser — not in backups, not on GitHub.
          </p>
        )}
      </div>
    </Card>
  );
}

function DataSection() {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const stamp = todayKey();
  const d = store.data;
  return (
    <Card title="Your data" icon="lock">
      <p className="muted small">
        Everything is stored only in this browser on this device — there’s no account and nothing is sent to a server (except questions you ask the AI coach, if you connect it). Clearing browser data erases it, so export a backup now and then.
      </p>
      <p className="small">
        {d.entries.length} food entries · {d.weights.length} weigh-ins · {d.water.length} water entries
      </p>
      <div className="stack">
        <button className="btn btn-secondary block" onClick={() => download(`fuelflow-backup-${stamp}.json`, backupJson(d), 'application/json')}>
          <Icon name="download" size={16} /> Download full backup
        </button>
        <div className="row-2 tight">
          <button className="btn btn-ghost" onClick={() => download(`fuelflow-diary-${stamp}.csv`, diaryCsv(d), 'text/csv')}>
            Diary CSV
          </button>
          <button className="btn btn-ghost" onClick={() => download(`fuelflow-progress-${stamp}.csv`, progressCsv(d), 'text/csv')}>
            Progress CSV
          </button>
        </div>
        <button className="btn btn-ghost block" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={16} /> Restore from backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (f.size > 20 * 1024 * 1024) return store.showToast('That file is too large to be a FuelFlow backup.');
            try {
              const json = JSON.parse(await f.text());
              if (!window.confirm('Restoring replaces everything currently on this device. Continue?')) return;
              const r = store.importData(json);
              store.showToast(r.message);
            } catch {
              store.showToast('That file couldn’t be read as a backup.');
            }
          }}
        />
      </div>
      <div className="danger-zone">
        {!showDelete ? (
          <button className="btn btn-ghost danger block" onClick={() => setShowDelete(true)}>
            <Icon name="trash" size={16} /> Delete all my data
          </button>
        ) : (
          <>
            <Field label='Type "DELETE" to erase everything on this device'>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" />
            </Field>
            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={() => (setShowDelete(false), setConfirm(''))}>
                Cancel
              </button>
              <button className="btn btn-danger grow" disabled={confirm !== 'DELETE'} onClick={() => store.resetAll()}>
                Delete everything
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
