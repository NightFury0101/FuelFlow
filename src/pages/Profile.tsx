import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Activity, Goal, Sex, SpecialCircumstance, Targets, ThemePref, UnitPrefs } from '../lib/types';
import { useStore } from '../lib/store';
import { ACTIVITY, balanceCarbs, calculateTargets } from '../lib/targets';
import { ageFromBirthDate, isValidDateKey, todayKey } from '../lib/date';
import { backupJson, diaryCsv, progressCsv, uid } from '../lib/storage';
import { displayWater, displayWeight, weightToKg, weightValue, waterToMl, ML_PER_FLOZ } from '../lib/units';
import { getApiKey, getProvider, isValidEndpoint, looksLikeKey, maskKey, PROVIDER_INFO, resolveAi, setApiKey, setProvider, testKey, type Provider } from '../lib/ai';
import { isNativeApp } from '../lib/platform';
import { showPremium } from '../lib/billing';
import { loadReminders, saveReminders, type ReminderItem, type ReminderSettings } from '../lib/reminders';
import { checkPermission, remindersSupported, requestPermission, type Permission } from '../lib/notifications';
import { PREMIUM_PITCH } from '../lib/plans';
import { usePremium } from '../lib/premium';
import { usePremiumCoach } from '../lib/useAi';
import { Card, Field, NumberInput, Segmented, parseNum } from '../components/ui';
import { Icon } from '../components/Icon';
import { TargetReview } from './Onboarding';
import { Link, useRoute } from '../router';
import { AuthSheet } from '../components/AuthSheet';

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  // Inside the iPhone/Android app there's no browser download bar, so hand the file to the
  // system share sheet instead (Save to Files, AirDrop, email…).
  if (isNativeApp()) {
    const file = new File([blob], name, { type });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      nav.share({ files: [file], title: name }).catch(() => undefined);
      return;
    }
  }
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
          refs.current.account = el;
        }}
      >
        <AccountSection />
      </div>

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
      {remindersSupported() && <RemindersSection />}
      <div
        ref={(el) => {
          refs.current.ai = el;
        }}
      >
        <CoachSection />
      </div>

      {showPremium() && <PremiumCard />}

      <DataSection />

      <p className="muted small center foot-note">
        FuelFlow gives estimates for general wellbeing, not medical advice.
        <br />
        <Link to="/privacy" className="accent">
          Privacy policy
        </Link>{' '}
        ·{' '}
        <Link to="/terms" className="accent">
          Terms of use
        </Link>{' '}
        ·{' '}
        <Link to="/support" className="accent">
          Help &amp; support
        </Link>
      </p>
    </div>
  );
}

function PremiumCard() {
  const premium = usePremium();
  const on = premium.status === 'premium';
  return (
    <Card title="FuelFlow Premium" icon="crown">
      <p className="muted small">{on ? 'You’re Premium — thank you! Your built-in AI coach is ready.' : PREMIUM_PITCH}</p>
      <Link to="/premium" className="btn btn-secondary sm">
        {on ? 'Manage Premium' : premium.available ? 'See Premium' : 'What’s in Premium'}
      </Link>
    </Card>
  );
}

function timeAgo(ts: number | null): string {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

function AccountSection() {
  const store = useStore();
  const { cloud } = store;
  const [auth, setAuth] = useState<'in' | 'up' | null>(null);
  const [confirmOut, setConfirmOut] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!cloud.enabled) {
    return (
      <Card title="Account & sync" icon="user">
        <p className="muted small">Accounts aren’t switched on for this FuelFlow yet, so your data stays on this phone. Use “Download full backup” below to keep a copy.</p>
      </Card>
    );
  }

  if (!cloud.account) {
    return (
      <Card title="Account & sync" icon="user" className="account-card">
        {cloud.state === 'error' && cloud.message && <p className="notice warn">{cloud.message}</p>}
        <p className="small">Create a free account to back up your diary and use FuelFlow on any phone.</p>
        <p className="muted small">Right now your data is only on this phone. Signing in adds it to your account — nothing is lost.</p>
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => setAuth('in')}>
            Sign in
          </button>
          <button className="btn btn-primary grow" onClick={() => setAuth('up')}>
            Create account
          </button>
        </div>
        <AuthSheet open={!!auth} initialMode={auth ?? 'in'} onClose={() => setAuth(null)} />
      </Card>
    );
  }

  const label =
    cloud.state === 'syncing'
      ? 'Syncing…'
      : cloud.state === 'offline'
        ? `Offline${cloud.pending ? ` — ${cloud.pending} change${cloud.pending === 1 ? '' : 's'} waiting` : ''}`
        : cloud.state === 'error'
          ? 'Sync problem'
          : `Synced${cloud.lastSynced ? ` ${timeAgo(cloud.lastSynced)}` : ''}`;

  const doSignOut = async (force: boolean) => {
    setBusy(true);
    const r = await cloud.signOut(force);
    setBusy(false);
    if (!r.ok) setConfirmOut(r.pending);
    else store.showToast('Signed out — your data is safe in your account');
  };

  return (
    <Card title="Account & sync" icon="user" className="account-card">
      <div className="acct-row">
        <span className="acct-avatar" aria-hidden="true">
          {cloud.account.email.charAt(0).toUpperCase()}
        </span>
        <span className="acct-main">
          <strong>{cloud.account.email}</strong>
          <span className={`sync-state sync-${cloud.state}`}>
            <span className="sync-dot" aria-hidden="true" /> {label}
          </span>
        </span>
        <button className="icon-btn" aria-label="Sync now" title="Sync now" disabled={cloud.state === 'syncing'} onClick={() => void cloud.syncNow()}>
          <Icon name="refresh" size={18} />
        </button>
      </div>
      {cloud.message && cloud.state !== 'synced' && <p className={'notice' + (cloud.state === 'error' ? ' warn' : '')}>{cloud.message}</p>}
      <p className="muted small">Your diary, recipes, plans, water and weight are backed up to your private account and kept in sync on every phone you sign in on.</p>

      {confirmOut != null ? (
        <div className="confirm-box">
          <p className="small warn-text">
            {confirmOut} change{confirmOut === 1 ? '' : 's'} on this phone {confirmOut === 1 ? 'hasn’t' : 'haven’t'} synced yet. If you sign out now {confirmOut === 1 ? 'it' : 'they'} will be lost.
          </p>
          <div className="sheet-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmOut(null)}>
              Stay signed in
            </button>
            <button className="btn btn-danger grow" disabled={busy} onClick={() => void doSignOut(true)}>
              Sign out anyway
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-secondary block" disabled={busy} onClick={() => void doSignOut(false)}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      )}
      <p className="muted small">Signing out removes your data and coach settings from this phone. It stays safe in your account.</p>

      <div className="danger-zone">
        {!deleting ? (
          <button className="btn btn-ghost danger block" onClick={() => (setDeleting(true), setErr(null))}>
            <Icon name="trash" size={16} /> Delete my account
          </button>
        ) : (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setErr(null);
              try {
                await cloud.deleteAccount(pw);
                store.showToast('Your account and all its data have been deleted');
              } catch (x) {
                setErr(x instanceof Error ? x.message : 'Couldn’t delete the account.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="small">This permanently deletes your account and everything in it, on every device. It can’t be undone. Download a backup first if you want to keep a copy.</p>
            <Field label="Enter your password to confirm">
              <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password to confirm deletion" />
            </Field>
            {err && <p className="notice warn">{err}</p>}
            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={() => (setDeleting(false), setPw(''))}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger grow" disabled={!pw || busy}>
                {busy ? 'Deleting…' : 'Delete account forever'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Card>
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
    <Card title="Units & appearance" icon="settings">
      <div className="form">
        <Field label="Appearance">
          <Segmented<ThemePref>
            label="Appearance"
            value={p.theme ?? 'dark'}
            onChange={(v) => store.updateProfile({ theme: v })}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'Match phone' },
            ]}
          />
        </Field>
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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function RemindersSection() {
  const store = useStore();
  const p = store.profile!;
  const [settings, setSettings] = useState<ReminderSettings>(() => loadReminders(p.meals));
  const [perm, setPerm] = useState<Permission | null>(null);
  const [busy, setBusy] = useState(false);

  // Meals can be renamed, added or removed above; keep the list in step.
  const mealKey = p.meals.map((m) => m.id).join('|');
  useEffect(() => {
    setSettings(loadReminders(p.meals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealKey]);
  useEffect(() => {
    checkPermission().then(setPerm).catch(() => setPerm(null));
  }, []);

  const update = (next: ReminderSettings) => {
    setSettings(next);
    saveReminders(next);
  };
  const setItem = (id: string, patch: Partial<ReminderItem>) => update({ ...settings, items: settings.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  const toggleAll = async () => {
    if (settings.enabled) return update({ ...settings, enabled: false });
    setBusy(true);
    try {
      const r = perm === 'granted' ? 'granted' : await requestPermission();
      setPerm(r);
      if (r === 'granted') {
        update({ ...settings, enabled: true });
        store.showToast('Reminders on');
      }
    } catch {
      store.showToast('Couldn’t turn on reminders on this phone.');
    } finally {
      setBusy(false);
    }
  };

  const label = (i: ReminderItem) =>
    i.kind === 'meal' ? p.meals.find((m) => m.id === i.meal)?.name || 'Meal' : i.kind === 'water' ? 'Water' : 'Weigh-in';

  return (
    <Card title="Reminders" icon="bell">
      <button className={'share-toggle' + (settings.enabled ? ' on' : '')} role="switch" aria-checked={settings.enabled} disabled={busy} onClick={() => void toggleAll()}>
        <Icon name="bell" size={16} />
        <span>{settings.enabled ? 'Reminders are on' : 'Remind me to log'}</span>
        <span className="switch" aria-hidden="true">
          <span />
        </span>
      </button>
      {perm === 'denied' && !settings.enabled && (
        <p className="notice warn small">
          <Icon name="alert" size={16} /> Notifications are off for FuelFlow. Turn them on in your phone’s Settings → Notifications → FuelFlow, then try again.
        </p>
      )}
      {settings.enabled && (
        <>
          <ul className="plain-list reminder-list">
            {settings.items.map((i) => (
              <li key={i.id} className={'plain-row reminder-row' + (i.on ? '' : ' off')}>
                <label className="reminder-name">
                  <input type="checkbox" checked={i.on} onChange={(e) => setItem(i.id, { on: e.target.checked })} />
                  <span>{label(i)}</span>
                </label>
                {i.kind === 'weigh' && (
                  <select className="reminder-day" value={i.weekday ?? 1} aria-label="Weigh-in day" disabled={!i.on} onChange={(e) => setItem(i.id, { weekday: Number(e.target.value) })}>
                    {WEEKDAYS.map((d, n) => (
                      <option key={d} value={n}>
                        {d.slice(0, 3)}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="time"
                  className="reminder-time"
                  value={i.time}
                  disabled={!i.on}
                  aria-label={`${label(i)} reminder time`}
                  onChange={(e) => e.target.value && setItem(i.id, { time: e.target.value })}
                />
              </li>
            ))}
          </ul>
          <p className="muted small">Meal reminders skip meals you’ve already logged that day, and water reminders stop once you reach your goal. Weigh-in is once a week.</p>
        </>
      )}
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
  const premiumCoach = usePremiumCoach();
  const using = resolveAi(p.scannerEndpoint, premiumCoach);

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
            Coach is using: <strong className="fg">{using.kind === 'premium' ? 'FuelFlow Premium (built in)' : using.kind === 'server' ? 'your own server' : PROVIDER_INFO[using.provider].name}</strong>
          </p>
        )}
        {using?.kind === 'premium' && <p className="notice ok small">Your Premium coach is ready — no key needed. Anything you set up below is only used if Premium ends.</p>}
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
            Gemini’s free tier has daily limits, and Google may use free-tier conversations to improve its products. Your key is kept only on this device — not in backups, not on GitHub.
          </p>
        )}
        {provider === 'claude' && (
          <p className="muted small">
            Claude is pay-as-you-go — usually under 1 cent per question. Set a monthly limit in the Anthropic console. Your key is kept only on this device — not in backups, not on GitHub.
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
        {store.cloud.account
          ? 'Your data is on this phone and backed up to your account. AI coach keys and chats stay on this phone only.'
          : isNativeApp()
            ? 'Everything is stored only in the app on this phone — nothing is sent to a server (except questions you ask the AI coach, if you connect it). Deleting the app erases it, so create an account or export a backup now and then.'
            : 'Everything is stored only in this browser on this device — nothing is sent to a server (except questions you ask the AI coach, if you connect it). Clearing browser data erases it, so create an account or export a backup now and then.'}
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
            <Field label={store.cloud.account ? 'Type "DELETE" to erase your FuelFlow data here and in your account (the account itself stays)' : 'Type "DELETE" to erase everything on this device'}>
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
