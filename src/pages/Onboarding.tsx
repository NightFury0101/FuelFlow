import { useMemo, useState } from 'react';
import type { Activity, Goal, Profile, Sex, SpecialCircumstance, Targets, UnitPrefs } from '../lib/types';
import { useStore, DEFAULT_MEALS } from '../lib/store';
import { ACTIVITY, DEFAULT_TARGETS, balanceCarbs, calculateTargets } from '../lib/targets';
import { ageFromBirthDate, isValidDateKey, todayKey } from '../lib/date';
import { inToCm, lbToKg, displayWeight } from '../lib/units';
import { Field, NumberInput, Segmented, parseNum } from '../components/ui';
import { Icon } from '../components/Icon';
import { AuthSheet } from '../components/AuthSheet';

const DIETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Dairy-free', 'Gluten-free', 'High protein', 'Low carb'];

type Step = 0 | 1 | 2 | 3 | 4;

export function Onboarding() {
  const store = useStore();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [units, setUnits] = useState<UnitPrefs>({ weight: 'kg', height: 'cm', water: 'ml' });
  const [sex, setSex] = useState<Sex>('female');
  const [birth, setBirth] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState<Activity>('light');
  const [special, setSpecial] = useState<SpecialCircumstance>('none');
  const [diet, setDiet] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const hCm = units.height === 'cm' ? parseNum(heightCm) : inToCm((parseNum(ft) || 0) * 12 + (parseNum(inch) || 0));
  const wv = parseNum(weight);
  const wKg = units.weight === 'lb' ? lbToKg(wv) : wv;
  const gv = parseNum(goalWeight);
  const gKg = goalWeight ? (units.weight === 'lb' ? lbToKg(gv) : gv) : undefined;
  const age = isValidDateKey(birth) ? ageFromBirthDate(birth) : NaN;

  const bodyErrors = {
    birth: !isValidDateKey(birth) ? 'Enter your date of birth' : age < 13 ? 'FuelFlow is for people aged 13 and over' : age > 110 ? 'Check the year' : null,
    height: !(hCm >= 100 && hCm <= 250) ? 'Enter your height' : null,
    weight: !(wKg >= 30 && wKg <= 350) ? 'Enter your current weight' : null,
  };
  const goalErrors = {
    goalWeight:
      goalWeight && !(gKg! >= 30 && gKg! <= 350)
        ? 'Enter a realistic goal weight'
        : goal === 'lose' && gKg && gKg >= wKg
          ? 'For weight loss, the goal should be below your current weight'
          : goal === 'gain' && gKg && gKg <= wKg
            ? 'For weight gain, the goal should be above your current weight'
            : null,
  };

  const result = useMemo(() => {
    if (bodyErrors.birth || bodyErrors.height || bodyErrors.weight) return null;
    return calculateTargets({ sex, age, heightCm: hCm, weightKg: wKg, goalWeightKg: gKg, activity, goal, special });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sex, age, hCm, wKg, gKg, activity, goal, special]);

  const next = () => {
    setTried(true);
    if (step === 1 && (bodyErrors.birth || bodyErrors.height || bodyErrors.weight)) return;
    if (step === 2 && goalErrors.goalWeight) return;
    if (step === 3 && result) setTargets(result.targets);
    setTried(false);
    setStep((s) => Math.min(4, s + 1) as Step);
  };

  const finish = (skipBody = false) => {
    const t = skipBody ? DEFAULT_TARGETS : (targets ?? result?.targets ?? DEFAULT_TARGETS);
    const profile: Profile = {
      name: name.trim() || 'there',
      sex,
      birthDate: skipBody ? undefined : birth,
      heightCm: skipBody ? undefined : Math.round(hCm),
      startWeightKg: skipBody ? undefined : Math.round(wKg * 10) / 10,
      goalWeightKg: skipBody ? undefined : gKg ? Math.round(gKg * 10) / 10 : undefined,
      activity,
      goal: skipBody ? 'maintain' : (result?.appliedGoal ?? goal),
      special,
      diet,
      units,
      targets: t,
      targetsCustomized: !!targets && !!result && JSON.stringify(targets) !== JSON.stringify(result.targets),
      meals: DEFAULT_MEALS,
      onboarded: true,
      setupIncomplete: skipBody,
      waterQuickAdds: units.water === 'floz' ? [237, 473] : [250, 500],
      createdAt: Date.now(),
    };
    store.setProfile(profile);
    if (!skipBody && wKg > 0) store.addWeight({ date: todayKey(), kg: Math.round(wKg * 10) / 10 });
  };

  return (
    <div className="onboarding">
      <div className="ob-inner">
        <div className="ob-progress" aria-label={`Step ${step + 1} of 5`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <section className="ob-step">
            <div className="brand-mark">
              <span className="logo-dot" /> FuelFlow
            </div>
            <h1 className="ob-title">
              Eat smarter.
              <br />
              Track better.
              <br />
              <span className="accent">Become stronger.</span>
            </h1>
            <p className="muted">A few questions so your calorie and protein targets fit you. Takes about a minute.</p>
            <Field label="What should we call you?">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="given-name" maxLength={40} />
            </Field>
            <Field label="Units">
              <Segmented
                label="Unit system"
                value={units.weight === 'kg' ? 'metric' : 'imperial'}
                onChange={(v) => setUnits(v === 'metric' ? { weight: 'kg', height: 'cm', water: 'ml' } : { weight: 'lb', height: 'ftin', water: 'floz' })}
                options={[
                  { value: 'metric', label: 'kg · cm · ml' },
                  { value: 'imperial', label: 'lb · ft · fl oz' },
                ]}
              />
            </Field>
          </section>
        )}

        {step === 1 && (
          <section className="ob-step">
            <h1 className="ob-h">About you</h1>
            <p className="muted">Used only to estimate your energy needs. Stored on this device.</p>
            <Field label="Sex used for the calculation" hint="Energy formulas differ slightly by biological sex.">
              <Segmented<Sex>
                label="Sex"
                value={sex}
                onChange={setSex}
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                  { value: 'unspecified', label: 'Prefer not to say' },
                ]}
              />
            </Field>
            <Field label="Date of birth" error={tried ? bodyErrors.birth : null}>
              <input type="date" value={birth} max={todayKey()} onChange={(e) => setBirth(e.target.value)} />
            </Field>
            {units.height === 'cm' ? (
              <Field label="Height" error={tried ? bodyErrors.height : null}>
                <NumberInput value={heightCm} onChange={setHeightCm} suffix="cm" ariaLabel="Height in centimetres" />
              </Field>
            ) : (
              <Field label="Height" error={tried ? bodyErrors.height : null}>
                <div className="row-2 tight">
                  <NumberInput value={ft} onChange={setFt} suffix="ft" ariaLabel="Height feet" />
                  <NumberInput value={inch} onChange={setInch} suffix="in" ariaLabel="Height inches" />
                </div>
              </Field>
            )}
            <Field label="Current weight" error={tried ? bodyErrors.weight : null}>
              <NumberInput value={weight} onChange={setWeight} step={0.1} suffix={units.weight} ariaLabel={`Weight in ${units.weight}`} />
            </Field>
          </section>
        )}

        {step === 2 && (
          <section className="ob-step">
            <h1 className="ob-h">Your goal</h1>
            <div className="choice-list" role="radiogroup" aria-label="Main goal">
              {(
                [
                  ['lose', 'Lose weight', 'A moderate, sustainable deficit'],
                  ['maintain', 'Maintain weight', 'Eat for your current weight'],
                  ['gain', 'Gain weight or muscle', 'A small surplus for building'],
                ] as Array<[Goal, string, string]>
              ).map(([v, t, s]) => (
                <button key={v} role="radio" aria-checked={goal === v} className={'choice' + (goal === v ? ' on' : '')} onClick={() => setGoal(v)}>
                  <span className="choice-title">{t}</span>
                  <span className="choice-sub">{s}</span>
                  {goal === v && <Icon name="check" size={18} className="choice-check" />}
                </button>
              ))}
            </div>
            {goal !== 'maintain' && (
              <Field label="Goal weight (optional)" error={goalErrors.goalWeight}>
                <NumberInput value={goalWeight} onChange={setGoalWeight} step={0.1} suffix={units.weight} ariaLabel="Goal weight" />
              </Field>
            )}
            <Field label="How active are you?">
              <select value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
                {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITY[a].label} — {ACTIVITY[a].hint}
                  </option>
                ))}
              </select>
            </Field>
          </section>
        )}

        {step === 3 && (
          <section className="ob-step">
            <h1 className="ob-h">A couple more things</h1>
            <p className="muted">Optional — skip anything you like.</p>
            <Field label="Does any of these apply?" hint="Standard calorie formulas aren’t designed for these situations.">
              <select value={special} onChange={(e) => setSpecial(e.target.value as SpecialCircumstance)}>
                <option value="none">None of these</option>
                <option value="pregnant">I’m pregnant</option>
                <option value="breastfeeding">I’m breastfeeding</option>
                <option value="medical">A medical condition affects what I eat</option>
              </select>
            </Field>
            <p className="field-label">Dietary preferences</p>
            <div className="chips-wrap">
              {DIETS.map((d) => (
                <button key={d} className={'chip toggle' + (diet.includes(d) ? ' on' : '')} aria-pressed={diet.includes(d)} onClick={() => setDiet((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>
                  {d}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 4 && result && targets && (
          <TargetReview targets={targets} setTargets={setTargets} result={result} goalLabel={goal} weightLabel={displayWeight(wKg, units)} goalWeightLabel={gKg ? displayWeight(gKg, units) : undefined} />
        )}

        <div className="ob-actions">
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </button>
          )}
          {step < 4 ? (
            <button className="btn btn-primary grow" onClick={next}>
              Continue <Icon name="right" size={18} />
            </button>
          ) : (
            <button className="btn btn-primary grow" onClick={() => finish(false)}>
              Start tracking
            </button>
          )}
        </div>
        {step === 1 && (
          <button className="skip-link" onClick={() => finish(true)}>
            Skip for now — use a standard 2,000 kcal target
          </button>
        )}
        {step === 0 && store.cloud.enabled && !store.cloud.account && (
          <p className="ob-signin">
            Already use FuelFlow?{' '}
            <button type="button" onClick={() => setAuthOpen(true)}>
              Sign in
            </button>
          </p>
        )}
        {step === 0 && store.cloud.account && <p className="ob-signin">Signed in as {store.cloud.account.email}. Set up your profile to start.</p>}
        {step === 0 && (
          <p className="ob-legal muted small">
            <a href="#/privacy">Privacy policy</a> · <a href="#/terms">Terms of use</a>
          </p>
        )}
      </div>
      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export function TargetReview({ targets, setTargets, result, goalLabel, weightLabel, goalWeightLabel }: { targets: Targets; setTargets: (t: Targets) => void; result: ReturnType<typeof calculateTargets>; goalLabel: Goal; weightLabel: string; goalWeightLabel?: string }) {
  const [editing, setEditing] = useState(false);
  const set = (k: keyof Targets, v: string) => {
    const n = Math.round(parseNum(v));
    if (!Number.isFinite(n)) return;
    const next = { ...targets, [k]: n };
    if (k !== 'carbs' && k !== 'waterMl') next.carbs = balanceCarbs(next);
    setTargets(next);
  };
  return (
    <section className="ob-step">
      <h1 className="ob-h">Your daily targets</h1>
      {result.needsProfessional && (
        <div className="notice warn">
          <Icon name="info" size={16} /> {result.notes[0]}
        </div>
      )}
      <div className="target-hero">
        <span className="target-kcal">{targets.kcal.toLocaleString()}</span>
        <span className="muted">kcal per day</span>
        {result.appliedGoal !== goalLabel && <span className="pill">Maintenance applied</span>}
      </div>
      <div className="target-grid">
        <div>
          <span className="dot-p" /> Protein<strong>{targets.protein} g</strong>
        </div>
        <div>
          <span className="dot-c" /> Carbs<strong>{targets.carbs} g</strong>
        </div>
        <div>
          <span className="dot-f" /> Fat<strong>{targets.fat} g</strong>
        </div>
        <div>
          <span className="dot-w" /> Water<strong>{(targets.waterMl / 1000).toFixed(targets.waterMl % 1000 ? 2 : 0).replace(/0$/, '')} L</strong>
        </div>
      </div>
      <details className="explain">
        <summary>How we worked this out</summary>
        <ul>
          {result.notes.slice(result.needsProfessional ? 1 : 0).map((n, i) => (
            <li key={i}>{n}</li>
          ))}
          <li>
            Starting from {weightLabel}
            {goalWeightLabel ? `, aiming for ${goalWeightLabel}` : ''}. Water is a general guide of about 35 ml per kg — needs rise with heat and exercise.
          </li>
          <li>These are estimates, not medical advice. Adjust them as you learn what works for you.</li>
        </ul>
      </details>
      <button className="link-btn" onClick={() => setEditing((e) => !e)}>
        {editing ? 'Done adjusting' : 'Adjust targets'}
      </button>
      {editing && (
        <div className="row-2">
          <Field label="Calories">
            <NumberInput value={String(targets.kcal)} onChange={(v) => set('kcal', v)} suffix="kcal" ariaLabel="Calorie target" />
          </Field>
          <Field label="Protein">
            <NumberInput value={String(targets.protein)} onChange={(v) => set('protein', v)} suffix="g" ariaLabel="Protein target" />
          </Field>
          <Field label="Fat">
            <NumberInput value={String(targets.fat)} onChange={(v) => set('fat', v)} suffix="g" ariaLabel="Fat target" />
          </Field>
          <Field label="Water">
            <NumberInput value={String(targets.waterMl)} onChange={(v) => set('waterMl', v)} suffix="ml" ariaLabel="Water target" />
          </Field>
          <p className="muted small span-2">Carbs fill the remaining calories automatically.</p>
        </div>
      )}
    </section>
  );
}
