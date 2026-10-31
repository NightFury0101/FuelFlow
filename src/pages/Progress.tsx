import { useCallback, useMemo, useState } from 'react';
import type { WeightEntry } from '../lib/types';
import { useStore } from '../lib/store';
import { addDays, formatShort, todayKey } from '../lib/date';
import { changeOver, dailyTotals, loggingStreak, milestones, sortedWeights, summarize, waterByDay, weeklyBuckets, weeklyTrend } from '../lib/analytics';
import { MEASURES, summarizeMeasures, toDisplay, unitFor } from '../lib/measurements';
import { displayWater, displayWeight, lbToKg, weightValue } from '../lib/units';
import { BarChart, LineChart } from '../components/charts';
import { Card, EmptyState, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { WeightSheet } from '../components/WeightSheet';
import { ReportSheet } from '../components/ReportSheet';

type Range = '30' | '90' | '365' | 'all';
type Period = '7' | '30' | '90' | '365';
const PERIOD_LABEL: Record<Period, string> = { '7': '7 days', '30': '30 days', '90': '3 months', '365': '1 year' };

export function Progress() {
  const store = useStore();
  const profile = store.profile!;
  const units = profile.units;
  const today = todayKey();
  const [range, setRange] = useState<Range>('90');
  const [period, setPeriod] = useState<Period>('7');
  const [weightSheet, setWeightSheet] = useState<{ edit: WeightEntry | null } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);

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

  // Longer periods are charted as weekly averages so the bars stay readable.
  const weekly = days > 30;
  const chartOf = (list: Array<{ date: string; value: number | null }>) => (weekly ? weeklyBuckets(list) : list);
  const kcalBars = useMemo(() => chartOf(totals.map((d) => ({ date: d.date, value: d.logged ? d.kcal : null }))), [totals, weekly]); // eslint-disable-line react-hooks/exhaustive-deps
  const proteinBars = useMemo(() => chartOf(totals.map((d) => ({ date: d.date, value: d.logged ? d.protein : null }))), [totals, weekly]); // eslint-disable-line react-hooks/exhaustive-deps
  const waterBars = useMemo(() => chartOf(water.map((w) => ({ date: w.date, value: w.ml }))), [water, weekly]); // eslint-disable-line react-hooks/exhaustive-deps

  const measures = useMemo(() => summarizeMeasures(store.data.weights), [store.data.weights]);
  const ms = useMemo(
    () =>
      milestones({
        weights: store.data.weights,
        entries: store.data.entries,
        goal: profile.goal,
        startKg: profile.startWeightKg,
        goalKg: profile.goalWeightKg,
        stepKg: units.weight === 'lb' ? lbToKg(5) : 2,
        fmt: (kg) => `${weightValue(kg, units)} ${units.weight}`,
        today,
      }),
    [store.data.weights, store.data.entries, profile.goal, profile.startWeightKg, profile.goalWeightKg, units, today],
  );
  const [allMilestones, setAllMilestones] = useState(false);

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
                            {w.waistCm ? ` · waist ${toDisplay(MEASURES[0], w.waistCm, units)} ${unitFor(MEASURES[0], units)}` : ''}
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

      <Card className="share-card">
        <div className="share-row">
          <span className="share-icon" aria-hidden="true">
            <Icon name="upload" size={20} />
          </span>
          <div className="share-text">
            <strong>Share with your trainer</strong>
            <span className="muted small">A one-page report of your weight, calories, protein and consistency.</span>
          </div>
          <button className="btn btn-secondary sm" onClick={() => setReportOpen(true)}>
            Create
          </button>
        </div>
      </Card>
      <ReportSheet open={reportOpen} onClose={closeReport} />

      {measures.length > 0 && (
        <Card title="Body measurements" icon="target">
          <ul className="measure-list">
            {measures.map(({ measure: m, first, latest: l, count }) => {
              const unit = unitFor(m, units);
              const change = Math.round((toDisplay(m, l.value, units) - toDisplay(m, first.value, units)) * 10) / 10;
              return (
                <li key={m.key}>
                  <span className="ml-name">{m.label}</span>
                  <span className="ml-value">
                    {toDisplay(m, l.value, units)} {unit}
                  </span>
                  <span className="ml-change muted small">
                    {count > 1 ? `${change > 0 ? '+' : change < 0 ? '−' : '±'}${Math.abs(change)} ${unit} since ${formatShort(first.date)}` : `on ${formatShort(l.date)}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="muted small">Add measurements when you log your weight. Measuring every 2–4 weeks is plenty.</p>
        </Card>
      )}

      <Card title="Milestones" icon="star">
        {ms.next.length > 0 && (
          <ul className="milestones next">
            {ms.next.map((m) => (
              <li key={m.id}>
                <span className="ms-dot" aria-hidden="true" />
                <span className="ms-main">
                  <strong>Next: {m.title}</strong>
                  <span className="muted small">{m.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {ms.reached.length === 0 ? (
          <p className="muted small">Your milestones appear here as you log food and weigh in.</p>
        ) : (
          <ul className="milestones">
            {ms.reached.slice(0, allMilestones ? undefined : 5).map((m) => (
              <li key={m.id}>
                <span className="ms-dot done" aria-hidden="true">
                  <Icon name="check" size={12} />
                </span>
                <span className="ms-main">
                  <strong>{m.title}</strong>
                  <span className="muted small">{m.date ? formatShort(m.date) : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {ms.reached.length > 5 && (
          <button className="link-btn" onClick={() => setAllMilestones((x) => !x)}>
            {allMilestones ? 'Show less' : `Show all ${ms.reached.length}`}
          </button>
        )}
      </Card>

      <div className="period-switch">
        <Segmented<Period>
          label="Period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '3 months' },
            { value: '365', label: '1 year' },
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
                <span>vs previous {PERIOD_LABEL[period]}</span>
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
            <BarChart days={kcalBars} target={profile.targets.kcal} unit="kcal" weekly={weekly} />
            <p className="legend muted small">
              {weekly && <>Weekly averages · </>}
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
            <BarChart days={proteinBars} target={profile.targets.protein} unit="g protein" color="var(--protein)" height={130} weekly={weekly} />
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
            <BarChart days={waterBars} target={profile.targets.waterMl} unit="ml" color="var(--water)" height={130} weekly={weekly} />
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
