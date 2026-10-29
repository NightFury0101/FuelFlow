import { useMemo, useState } from 'react';
import type { WeightEntry } from '../lib/types';
import { useStore } from '../lib/store';
import { addDays, formatShort, todayKey } from '../lib/date';
import { changeOver, dailyTotals, loggingStreak, sortedWeights, summarize, waterByDay, weeklyTrend } from '../lib/analytics';
import { displayWater, displayWeight, weightValue } from '../lib/units';
import { BarChart, LineChart } from '../components/charts';
import { Card, EmptyState, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { WeightSheet } from '../components/WeightSheet';

type Range = '30' | '90' | '365' | 'all';
type Period = '7' | '30';

export function Progress() {
  const store = useStore();
  const profile = store.profile!;
  const units = profile.units;
  const today = todayKey();
  const [range, setRange] = useState<Range>('90');
  const [period, setPeriod] = useState<Period>('7');
  const [weightSheet, setWeightSheet] = useState<{ edit: WeightEntry | null } | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Older data may hold several weigh-ins on one day; charts and trends use the last one per day.
  const weights = useMemo(() => {
    const byDay = new Map<string, WeightEntry>();
    for (const w of sortedWeights(store.data.weights)) byDay.set(w.date, w);
    return [...byDay.values()];
  }, [store.data.weights]);
  const shown = range === 'all' ? weights : weights.filter((w) => w.date >= addDays(today, -Number(range)));
  const first = weights[0];
  const latest = weights[weights.length - 1];
  const c7 = changeOver(weights, 7);
  const c30 = changeOver(weights, 30);
  const trend = weeklyTrend(weights.filter((w) => w.date >= addDays(today, -60)));

  const days = Number(period);
  const totals = useMemo(() => dailyTotals(store.data.entries, today, days), [store.data.entries, today, days]);
  const prevTotals = useMemo(() => dailyTotals(store.data.entries, addDays(today, -days), days), [store.data.entries, today, days]);
  const sum = summarize(totals, profile.targets);
  const prevSum = summarize(prevTotals, profile.targets);
  const water = useMemo(() => waterByDay(store.data.water, today, days), [store.data.water, today, days]);
  const waterLogged = water.filter((w) => w.ml != null);
  const waterAvg = waterLogged.length ? Math.round(waterLogged.reduce((s, w) => s + (w.ml || 0), 0) / waterLogged.length) : null;
  const streak = loggingStreak(store.data.entries, today);

  const fmtDelta = (kg: number | null) => (kg == null ? '—' : `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${weightValue(Math.abs(kg), units)} ${units.weight}`);
  const toGoal = latest && profile.goalWeightKg ? Math.round((profile.goalWeightKg - latest.kg) * 10) / 10 : null;

  return (
    <div className="page progress">
      <header className="page-head">
        <h1>Progress</h1>
        <button className="btn btn-primary sm" onClick={() => setWeightSheet({ edit: null })}>
          <Icon name="plus" size={16} /> Weight
        </button>
      </header>

      <Card title="Weight" icon="scale">
        {weights.length === 0 ? (
          <EmptyState icon="scale" title="No weigh-ins yet" text="Log your weight once or twice a week to see your trend here." action={<button className="btn btn-secondary" onClick={() => setWeightSheet({ edit: null })}>Log weight</button>} />
        ) : (
          <>
            <div className="tiles">
              <div className="tile">
                <span>Start</span>
                <strong>{displayWeight(profile.startWeightKg ?? first.kg, units)}</strong>
              </div>
              <div className="tile hi">
                <span>Current</span>
                <strong>{displayWeight(latest.kg, units)}</strong>
              </div>
              <div className="tile">
                <span>Goal</span>
                <strong>{profile.goalWeightKg ? displayWeight(profile.goalWeightKg, units) : '—'}</strong>
              </div>
            </div>
            <Segmented<Range>
              label="Chart range"
              value={range}
              onChange={setRange}
              options={[
                { value: '30', label: '1M' },
                { value: '90', label: '3M' },
                { value: '365', label: '1Y' },
                { value: 'all', label: 'All' },
              ]}
            />
            {shown.length >= 2 ? (
              <LineChart points={shown.map((w) => ({ date: w.date, value: weightValue(w.kg, units) }))} goal={profile.goalWeightKg ? weightValue(profile.goalWeightKg, units) : undefined} unit={units.weight} />
            ) : (
              <p className="muted small pad">{shown.length === 1 ? 'One weigh-in in this range. Log on another day to draw a chart.' : 'No weigh-ins in this range.'}</p>
            )}
            <div className="stat-grid">
              <div>
                <span>Last 7 days</span>
                <strong>{fmtDelta(c7)}</strong>
              </div>
              <div>
                <span>Last 30 days</span>
                <strong>{fmtDelta(c30)}</strong>
              </div>
              <div>
                <span>Avg per week</span>
                <strong>{trend == null ? '—' : fmtDelta(trend)}</strong>
              </div>
              <div>
                <span>To goal</span>
                <strong>{toGoal == null ? '—' : toGoal === 0 ? 'Reached' : fmtDelta(toGoal).replace(/^[+−]/, '')}</strong>
              </div>
            </div>
            {(c7 == null || trend == null) && <p className="muted small">Trends appear once you have weigh-ins spread over at least a week.</p>}

            <p className="list-label">History</p>
            <ul className="plain-list">
              {[...weights]
                .reverse()
                .slice(0, showAll ? undefined : 6)
                .map((w, i) => {
                  const prev = weights[weights.length - 2 - i];
                  const d = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : null;
                  return (
                    <li key={w.id}>
                      <button className="plain-row as-btn" onClick={() => setWeightSheet({ edit: w })}>
                        <span>
                          <strong>{displayWeight(w.kg, units)}</strong>
                          <span className="muted small">
                            {' '}
                            · {formatShort(w.date)}
                            {w.waistCm ? ` · waist ${w.waistCm} cm` : ''}
                          </span>
                          {w.note && <span className="muted small block">{w.note}</span>}
                        </span>
                        <span className={'delta small' + (d == null ? '' : d < 0 ? ' down' : d > 0 ? ' up' : '')}>{d == null ? '' : fmtDelta(d)}</span>
                      </button>
                    </li>
                  );
                })}
            </ul>
            {weights.length > 6 && (
              <button className="link-btn" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Show less' : `Show all ${weights.length}`}
              </button>
            )}
          </>
        )}
      </Card>

      <div className="period-switch">
        <Segmented<Period>
          label="Period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
          ]}
        />
      </div>

      <Card title="Calories" icon="flame">
        {sum.loggedDays === 0 ? (
          <EmptyState icon="chart" title="No food logged in this period" text="Your daily totals and averages show up here as you log." />
        ) : (
          <>
            <div className="stat-grid">
              <div>
                <span>Daily average</span>
                <strong>{sum.avgKcal?.toLocaleString()} kcal</strong>
              </div>
              <div>
                <span>vs previous {days} days</span>
                <strong>{prevSum.avgKcal == null || sum.avgKcal == null ? '—' : `${sum.avgKcal - prevSum.avgKcal > 0 ? '+' : sum.avgKcal - prevSum.avgKcal < 0 ? '−' : ''}${Math.abs(sum.avgKcal - prevSum.avgKcal)} kcal`}</strong>
              </div>
              <div>
                <span>Days logged</span>
                <strong>
                  {sum.loggedDays} / {sum.totalDays}
                </strong>
              </div>
              <div>
                <span>Within ±10% of target</span>
                <strong>
                  {sum.onTargetDays} day{sum.onTargetDays === 1 ? '' : 's'}
                </strong>
              </div>
            </div>
            <BarChart days={totals.map((d) => ({ date: d.date, value: d.logged ? d.kcal : null }))} target={profile.targets.kcal} unit="kcal" />
            <p className="legend muted small">
              <span className="lg-line" /> target {profile.targets.kcal.toLocaleString()} kcal <span className="lg-miss" /> not logged
            </p>
            <p className="muted small">Averages only count days you logged — a missing day is never treated as zero.</p>
          </>
        )}
      </Card>

      <Card title="Macros" icon="leaf">
        {sum.loggedDays === 0 ? (
          <p className="muted small">Log a few days to see macro averages.</p>
        ) : (
          <>
            <div className="macro-avg">
              {(
                [
                  ['Protein', sum.avgProtein, profile.targets.protein, 'var(--protein)'],
                  ['Carbs', sum.avgCarbs, profile.targets.carbs, 'var(--carbs)'],
                  ['Fat', sum.avgFat, profile.targets.fat, 'var(--fat)'],
                ] as const
              ).map(([l, v, t, c]) => (
                <div key={l}>
                  <span className="muted small">{l}</span>
                  <strong>{Math.round(v || 0)} g</strong>
                  <span className="muted small">of {t} g</span>
                  <div className="mini-bar">
                    <span style={{ width: `${Math.min(100, ((v || 0) / t) * 100)}%`, background: c }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="small">
              Protein target hit on <strong>{sum.proteinHitDays}</strong> of {sum.loggedDays} logged day{sum.loggedDays === 1 ? '' : 's'}.
            </p>
            <BarChart days={totals.map((d) => ({ date: d.date, value: d.logged ? d.protein : null }))} target={profile.targets.protein} unit="g protein" color="var(--protein)" height={130} />
          </>
        )}
      </Card>

      <Card title="Water" icon="drop">
        {waterLogged.length === 0 ? (
          <p className="muted small">No water logged in this period.</p>
        ) : (
          <>
            <p className="small">
              Average <strong>{displayWater(waterAvg || 0, units)}</strong> on {waterLogged.length} day{waterLogged.length === 1 ? '' : 's'} logged · target {displayWater(profile.targets.waterMl, units)}
            </p>
            <BarChart days={water.map((w) => ({ date: w.date, value: w.ml }))} target={profile.targets.waterMl} unit="ml" color="var(--water)" height={130} />
          </>
        )}
      </Card>

      <Card title="Consistency" icon="target">
        <div className="stat-grid">
          <div>
            <span>Current streak</span>
            <strong>
              {streak} day{streak === 1 ? '' : 's'}
            </strong>
          </div>
          <div>
            <span>Weigh-ins total</span>
            <strong>{weights.length}</strong>
          </div>
        </div>
      </Card>

      <WeightSheet open={!!weightSheet} edit={weightSheet?.edit} onClose={() => setWeightSheet(null)} />
    </div>
  );
}
