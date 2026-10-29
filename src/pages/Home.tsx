import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { entriesForDay, sumNutrients } from '../lib/nutrition';
import { greeting, todayKey, formatShort } from '../lib/date';
import { dailyInsights } from '../lib/insights';
import { changeFromPrevious, loggingStreak, sortedWeights } from '../lib/analytics';
import { displayWeight, weightValue } from '../lib/units';
import { Bar, LineChart, ProgressRing } from '../components/charts';
import { Card } from '../components/ui';
import { Icon } from '../components/Icon';
import { WaterCard, WaterSheet } from '../components/Water';
import { AddFoodSheet } from '../components/AddFoodSheet';
import { WeightSheet } from '../components/WeightSheet';
import { Link, navigate } from '../router';

export function Home() {
  const store = useStore();
  const profile = store.profile!;
  const today = todayKey();
  const [add, setAdd] = useState<{ meal: string; view: 'browse' | 'quick' } | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);

  const entries = useMemo(() => entriesForDay(store.data.entries, today), [store.data.entries, today]);
  const totals = useMemo(() => sumNutrients(entries), [entries]);
  const waterMl = store.data.water.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0);
  const t = profile.targets;
  const remaining = t.kcal - totals.kcal;
  const over = remaining < 0;
  const streak = useMemo(() => loggingStreak(store.data.entries, today), [store.data.entries, today]);
  const insights = dailyInsights({ totals, targets: t, waterMl, entryCount: entries.length, hour: new Date().getHours(), streak });

  const weights = useMemo(() => sortedWeights(store.data.weights), [store.data.weights]);
  const latest = weights[weights.length - 1];
  const change = changeFromPrevious(weights);

  const defaultMeal = () => {
    const h = new Date().getHours();
    const ids = profile.meals.map((m) => m.id);
    const pick = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks';
    return ids.includes(pick) ? pick : ids[0];
  };

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page home">
      <header className="home-head">
        <div>
          <p className="muted small">{dateLabel}</p>
          <h1 className="hello">
            {greeting()}, {profile.name}
          </h1>
        </div>
        <Link to="/profile" className="avatar" aria-label="Profile">
          {profile.name.trim().charAt(0).toUpperCase() || 'F'}
        </Link>
      </header>

      {profile.setupIncomplete && (
        <Link to="/profile?section=body" className="banner">
          <Icon name="target" size={18} />
          <span>
            <strong>Finish setup</strong> to get targets based on your body and goal.
          </span>
          <Icon name="right" size={18} />
        </Link>
      )}

      <Card className="cal-card">
        <div className="cal-row">
          <ProgressRing value={totals.kcal} max={t.kcal} label={`${totals.kcal} of ${t.kcal} calories eaten`}>
            <span className="ring-num">{Math.abs(remaining).toLocaleString()}</span>
            <span className={'ring-label' + (over ? ' warn-text' : '')}>{over ? 'kcal over' : 'kcal left'}</span>
          </ProgressRing>
          <dl className="cal-stats">
            <div>
              <dt>Target</dt>
              <dd>{t.kcal.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Eaten</dt>
              <dd>{totals.kcal.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{over ? 'Over by' : 'Remaining'}</dt>
              <dd className={over ? 'warn-text' : 'accent'}>{Math.abs(remaining).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
        <div className="macros">
          {(
            [
              ['Protein', totals.protein, t.protein, 'var(--protein)'],
              ['Carbs', totals.carbs, t.carbs, 'var(--carbs)'],
              ['Fat', totals.fat, t.fat, 'var(--fat)'],
            ] as const
          ).map(([label, v, max, color]) => (
            <div key={label} className="macro">
              <div className="macro-top">
                <span>{label}</span>
                <span className="muted small">
                  <strong className="fg">{Math.round(v)}</strong> / {max} g
                </span>
              </div>
              <Bar value={v} max={max} color={color} label={`${label} ${Math.round(v)} of ${max} grams`} />
            </div>
          ))}
        </div>
      </Card>

      {insights.length > 0 && (
        <ul className="insights" aria-label="Today’s insights">
          {insights.map((i) => (
            <li key={i.id} className={`insight insight-${i.tone}`}>
              <Icon name={i.tone === 'positive' ? 'check' : i.tone === 'heads-up' ? 'info' : 'sparkles'} size={16} />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      )}

      <nav className="quick" aria-label="Quick actions">
        <button className="quick-btn primary" onClick={() => navigate('/scan')}>
          <Icon name="camera" size={20} />
          <span>Scan</span>
        </button>
        <button className="quick-btn" onClick={() => setAdd({ meal: defaultMeal(), view: 'browse' })}>
          <Icon name="search" size={20} />
          <span>Search</span>
        </button>
        <button className="quick-btn" onClick={() => setWaterOpen(true)}>
          <Icon name="drop" size={20} />
          <span>Water</span>
        </button>
        <button className="quick-btn" onClick={() => navigate('/coach')}>
          <Icon name="sparkles" size={20} />
          <span>AI Coach</span>
        </button>
      </nav>

      <Card
        title="Today’s meals"
        icon="utensils"
        action={
          <Link to="/diary" className="link-btn">
            Diary <Icon name="right" size={15} />
          </Link>
        }
      >
        <ul className="meal-list">
          {profile.meals.map((m) => {
            const list = entries.filter((e) => e.meal === m.id);
            const mt = sumNutrients(list);
            return (
              <li key={m.id} className="meal-row">
                <Link to={`/diary?date=${today}&meal=${m.id}`} className="meal-row-main">
                  <span className="meal-name">{m.name}</span>
                  <span className="meal-items muted small">{list.length ? list.map((e) => e.food.name).join(', ') : 'Nothing logged'}</span>
                </Link>
                <span className="meal-kcal">{list.length ? `${mt.kcal}` : ''}</span>
                <button className="add-round" onClick={() => setAdd({ meal: m.id, view: 'browse' })} aria-label={`Add food to ${m.name}`}>
                  <Icon name="plus" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <WaterCard date={today} />

      <Card
        title="Weight"
        icon="scale"
        action={
          <Link to="/progress" className="link-btn">
            Progress <Icon name="right" size={15} />
          </Link>
        }
      >
        {latest ? (
          <div className="weight-mini">
            <div>
              <p className="big-num">{displayWeight(latest.kg, profile.units)}</p>
              {change ? (
                <p className="muted small">
                  {change.kg === 0 ? 'No change' : `${change.kg > 0 ? '+' : '−'}${Math.abs(weightValue(Math.abs(change.kg), profile.units))} ${profile.units.weight}`} vs {formatShort(change.previousDate)}
                </p>
              ) : (
                <p className="muted small">Logged {formatShort(latest.date)}</p>
              )}
              {profile.goalWeightKg && <p className="muted small">Goal {displayWeight(profile.goalWeightKg, profile.units)}</p>}
            </div>
            {weights.length >= 2 && (
              <div className="spark">
                <LineChart height={110} unit={profile.units.weight} points={weights.slice(-10).map((w) => ({ date: w.date, value: weightValue(w.kg, profile.units) }))} />
              </div>
            )}
          </div>
        ) : (
          <p className="muted small">No weigh-ins yet.</p>
        )}
        <button className="btn btn-secondary sm" onClick={() => setWeightOpen(true)}>
          <Icon name="plus" size={16} /> Log weight
        </button>
      </Card>

      <AddFoodSheet open={!!add} onClose={() => setAdd(null)} date={today} meal={add?.meal ?? 'snacks'} initialView={add?.view ?? 'browse'} />
      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} />
      <WaterSheet open={waterOpen} onClose={() => setWaterOpen(false)} date={today} />
    </div>
  );
}
