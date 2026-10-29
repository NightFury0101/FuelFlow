import { useEffect, useMemo, useRef, useState } from 'react';
import type { FoodEntry } from '../lib/types';
import { useStore } from '../lib/store';
import { entriesForDay, formatAmount, sumNutrients } from '../lib/nutrition';
import { addDays, formatDay, isValidDateKey, parseDateKey, todayKey } from '../lib/date';
import { Card, EmptyState, MacroPills, Sheet, SourceTag, Field } from '../components/ui';
import { Bar } from '../components/charts';
import { Icon } from '../components/Icon';
import { AddFoodSheet } from '../components/AddFoodSheet';
import { EntryEditor } from '../components/EntryEditor';
import { WaterCard } from '../components/Water';
import { navigate, useRoute } from '../router';

export const PLAN_DAYS_AHEAD = 14;

export function Diary() {
  const store = useStore();
  const profile = store.profile!;
  const route = useRoute();
  const today = todayKey();
  const maxDate = addDays(today, PLAN_DAYS_AHEAD);
  const qd = route.query.get('date') || '';
  const date = isValidDateKey(qd) && qd <= maxDate ? qd : today;
  const future = date > today;
  const setDate = (d: string) => navigate(`/diary?date=${d}`, { replace: true });

  const [add, setAdd] = useState<{ meal: string; view: 'browse' | 'quick'; plan: boolean } | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [planItem, setPlanItem] = useState<FoodEntry | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [saveMeal, setSaveMeal] = useState<{ meal: string; name: string } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const entries = useMemo(() => entriesForDay(store.data.entries, date), [store.data.entries, date]);
  const planned = useMemo(() => entriesForDay(store.data.planned, date), [store.data.planned, date]);
  const prevDay = addDays(date, -1);
  const prevItems = useMemo(
    () => (future ? [...entriesForDay(store.data.entries, prevDay), ...entriesForDay(store.data.planned, prevDay)] : entriesForDay(store.data.entries, prevDay)),
    [store.data.entries, store.data.planned, prevDay, future],
  );
  const totals = sumNutrients(future ? planned : entries);
  const plannedTotals = sumNutrients(planned);
  const t = profile.targets;

  const focusMeal = route.query.get('meal');
  useEffect(() => {
    if (focusMeal && sectionRefs.current[focusMeal]) sectionRefs.current[focusMeal]!.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focusMeal]);

  const week = useMemo(() => {
    const start = addDays(date, -3);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [date]);
  const loggedDays = useMemo(() => new Set(store.data.entries.map((e) => e.date)), [store.data.entries]);
  const plannedDays = useMemo(() => new Set(store.data.planned.map((e) => e.date)), [store.data.planned]);

  const copyFrom = (meal: string, from: FoodEntry[]) => {
    const items = from.map((e) => ({ date, meal, food: e.food, servingLabel: e.servingLabel, quantity: e.quantity, amount: e.amount, aiEstimated: e.aiEstimated }));
    const created = future ? store.addPlanned(items) : store.addEntries(items);
    const undo = () => created.forEach((c) => (future ? store.deletePlanned(c.id) : store.deleteEntry(c.id)));
    store.showToast(`${future ? 'Planned' : 'Copied'} ${created.length} item${created.length === 1 ? '' : 's'}`, undo);
  };

  const eat = (items: FoodEntry[]) => {
    const eaten = store.eatPlanned(items.map((i) => i.id));
    store.showToast(`Logged ${eaten.length} planned item${eaten.length === 1 ? '' : 's'}`, () => {
      eaten.forEach((e) => store.deleteEntry(e.id));
      store.restorePlanned(items);
    });
  };

  const over = totals.kcal > t.kcal;

  return (
    <div className="page diary">
      <header className="page-head">
        <h1>{future ? 'Meal plan' : 'Diary'}</h1>
        <label className="date-pick">
          <Icon name="calendar" size={18} />
          <span className="sr-only">Pick a date</span>
          <input type="date" value={date} max={maxDate} onChange={(e) => isValidDateKey(e.target.value) && e.target.value <= maxDate && setDate(e.target.value)} />
        </label>
      </header>

      <div className="day-nav">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          <Icon name="left" />
        </button>
        <div className="week-strip" role="list">
          {week.map((d) => (
            <button
              key={d}
              role="listitem"
              disabled={d > maxDate}
              className={'wday' + (d === date ? ' on' : '') + (d === today ? ' today' : '') + (d > today ? ' ahead' : '')}
              onClick={() => setDate(d)}
              aria-label={formatDay(d, today)}
              aria-current={d === date ? 'date' : undefined}
            >
              <span className="wd">{parseDateKey(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              <span className="dn">{parseDateKey(d).getDate()}</span>
              <span className={'logged-dot' + (loggedDays.has(d) ? ' on' : plannedDays.has(d) ? ' plan' : '')} />
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={date >= maxDate} aria-label="Next day">
          <Icon name="right" />
        </button>
      </div>
      <p className="day-title">
        <span>
          {formatDay(date, today)}
          {future && <span className="pill pill-plan">Planning</span>}
        </span>
        {date !== today && (
          <button className="link-btn" onClick={() => setDate(today)}>
            Back to today
          </button>
        )}
      </p>

      {future && (
        <p className="plan-note">
          <Icon name="calendar" size={15} /> Plan meals ahead. Nothing here counts toward your totals until you mark it as eaten on the day.
        </p>
      )}

      <Card className="day-summary">
        <div className="ds-top">
          <span>
            <strong className="ds-kcal">{totals.kcal.toLocaleString()}</strong> <span className="muted">/ {t.kcal.toLocaleString()} kcal {future ? 'planned' : ''}</span>
          </span>
          <span className={over ? 'warn-text small' : 'muted small'}>{over ? `${(totals.kcal - t.kcal).toLocaleString()} over` : `${(t.kcal - totals.kcal).toLocaleString()} left`}</span>
        </div>
        <Bar value={totals.kcal} max={t.kcal} color={over ? 'var(--warn)' : future ? 'var(--fat)' : 'var(--accent)'} label={future ? 'Planned calories' : 'Calories for the day'} />
        <div className="ds-macros">
          <span>
            <span className="dot-p" /> {Math.round(totals.protein)}/{t.protein} g
          </span>
          <span>
            <span className="dot-c" /> {Math.round(totals.carbs)}/{t.carbs} g
          </span>
          <span>
            <span className="dot-f" /> {Math.round(totals.fat)}/{t.fat} g
          </span>
        </div>
        {!future && planned.length > 0 && (
          <p className="muted small ds-plan">
            + {plannedTotals.kcal.toLocaleString()} kcal still planned — not counted until eaten
          </p>
        )}
      </Card>

      {menu && <button className="menu-scrim" aria-label="Close menu" onClick={() => setMenu(null)} />}

      {profile.meals.map((m) => {
        const list = future ? [] : entries.filter((e) => e.meal === m.id);
        const plan = planned.filter((e) => e.meal === m.id);
        const mt = sumNutrients(future ? plan : list);
        const prev = prevItems.filter((e) => e.meal === m.id);
        const has = list.length > 0 || plan.length > 0;
        return (
          <section
            key={m.id}
            className="meal-section card"
            ref={(el) => {
              sectionRefs.current[m.id] = el;
            }}
            aria-label={m.name}
          >
            <header className="ms-head">
              <div>
                <h2>{m.name}</h2>
                {(future ? plan.length : list.length) > 0 && (
                  <span className="muted small">
                    {mt.kcal} kcal · <MacroPills p={mt.protein} c={mt.carbs} f={mt.fat} />
                  </span>
                )}
              </div>
              <div className="ms-tools">
                <button className="icon-btn" aria-label={`More options for ${m.name}`} aria-haspopup="menu" aria-expanded={menu === m.id} onClick={() => setMenu(menu === m.id ? null : m.id)}>
                  <Icon name="more" />
                </button>
                <button className="add-round" onClick={() => setAdd({ meal: m.id, view: 'browse', plan: future })} aria-label={`${future ? 'Plan' : 'Add'} food for ${m.name}`}>
                  <Icon name="plus" size={18} />
                </button>
                {menu === m.id && (
                  <div className="menu" role="menu">
                    <button role="menuitem" onClick={() => (setMenu(null), setAdd({ meal: m.id, view: 'quick', plan: future }))}>
                      <Icon name="flame" size={16} /> Quick add calories
                    </button>
                    {date === today && (
                      <button role="menuitem" onClick={() => (setMenu(null), setAdd({ meal: m.id, view: 'browse', plan: true }))}>
                        <Icon name="calendar" size={16} /> Plan food for later today
                      </button>
                    )}
                    {prev.length > 0 && (
                      <button role="menuitem" onClick={() => (setMenu(null), copyFrom(m.id, prev))}>
                        <Icon name="copy" size={16} /> {future ? 'Plan' : 'Copy'} previous day’s {m.name.toLowerCase()}
                      </button>
                    )}
                    {list.length > 0 && date !== today && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenu(null);
                          const created = store.addEntries(list.map((e) => ({ date: today, meal: m.id, food: e.food, servingLabel: e.servingLabel, quantity: e.quantity, amount: e.amount, aiEstimated: e.aiEstimated })));
                          store.showToast(`Copied to today`, () => created.forEach((c) => store.deleteEntry(c.id)));
                        }}
                      >
                        <Icon name="copy" size={16} /> Copy to today
                      </button>
                    )}
                    {(future ? plan : list).length > 0 && (
                      <button role="menuitem" onClick={() => (setMenu(null), setSaveMeal({ meal: m.id, name: `My ${m.name.toLowerCase()}` }))}>
                        <Icon name="bookmark" size={16} /> Save as meal
                      </button>
                    )}
                    {list.length > 0 && (
                      <button
                        role="menuitem"
                        className="danger"
                        onClick={() => {
                          setMenu(null);
                          list.forEach((e) => store.deleteEntry(e.id));
                          store.showToast(`Cleared ${m.name.toLowerCase()}`, () => store.restoreEntries(list));
                        }}
                      >
                        <Icon name="trash" size={16} /> Clear {m.name.toLowerCase()}
                      </button>
                    )}
                    {plan.length > 0 && (
                      <button
                        role="menuitem"
                        className="danger"
                        onClick={() => {
                          setMenu(null);
                          plan.forEach((e) => store.deletePlanned(e.id));
                          store.showToast('Plan cleared', () => store.restorePlanned(plan));
                        }}
                      >
                        <Icon name="trash" size={16} /> Clear planned {m.name.toLowerCase()}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </header>

            {list.length > 0 && (
              <ul className="entry-list">
                {list.map((e) => (
                  <li key={e.id}>
                    <button className="entry" onClick={() => setEditing(e)}>
                      <span className="entry-main">
                        <span className="entry-name">{e.food.name}</span>
                        <span className="entry-sub muted small">
                          {formatAmount(e)}
                          {(e.aiEstimated || e.food.source === 'manual' || e.food.source === 'recipe') && (
                            <>
                              {' '}
                              <SourceTag source={e.food.source} ai={e.aiEstimated} />
                            </>
                          )}
                        </span>
                      </span>
                      <span className="entry-kcal">{e.nutrients.kcal}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {plan.length > 0 && (
              <div className="planned-block">
                {!future && (
                  <div className="planned-head">
                    <span className="muted small">Planned</span>
                    {date <= today && plan.length > 1 && (
                      <button className="link-btn" onClick={() => eat(plan)}>
                        Mark all eaten
                      </button>
                    )}
                  </div>
                )}
                <ul className="entry-list planned">
                  {plan.map((e) => (
                    <li key={e.id} className="planned-row">
                      <button className="entry" onClick={() => setPlanItem(e)}>
                        <span className="entry-main">
                          <span className="entry-name">{e.food.name}</span>
                          <span className="entry-sub muted small">{formatAmount(e)}</span>
                        </span>
                        <span className="entry-kcal">{e.nutrients.kcal}</span>
                      </button>
                      {!future && (
                        <button className="eat-btn" onClick={() => eat([e])} aria-label={`Mark ${e.food.name} as eaten`} title="Mark as eaten">
                          <Icon name="check" size={16} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!has && prev.length > 0 && (
              <button className="ghost-row" onClick={() => copyFrom(m.id, prev)}>
                <Icon name="copy" size={16} /> Same as the day before? {future ? 'Plan' : 'Copy'} {prev.length} item{prev.length === 1 ? '' : 's'}
              </button>
            )}
          </section>
        );
      })}

      {!future && entries.length === 0 && planned.length === 0 && (
        <EmptyState icon="utensils" title={date === today ? 'Nothing logged today' : 'Nothing logged this day'} text="Tap + on a meal to search foods, use a saved meal or recipe, or quick-add calories." />
      )}
      {future && planned.length === 0 && <EmptyState icon="calendar" title="Nothing planned yet" text="Tap + on a meal to plan it. On the day, tick each item when you eat it." />}

      {!future && <WaterCard date={date} />}

      <AddFoodSheet open={!!add} onClose={() => setAdd(null)} date={date} meal={add?.meal ?? 'snacks'} initialView={add?.view ?? 'browse'} plan={add?.plan ?? false} />
      <EntryEditor entry={editing} onClose={() => setEditing(null)} />

      <Sheet open={!!planItem} onClose={() => setPlanItem(null)} title="Planned food">
        {planItem && (
          <div className="form">
            <div>
              <h3 className="se-name">{planItem.food.name}</h3>
              <p className="muted small">
                {formatAmount(planItem)} · {planItem.nutrients.kcal} kcal · <MacroPills p={planItem.nutrients.protein} c={planItem.nutrients.carbs} f={planItem.nutrients.fat} />
              </p>
              <p className="muted small">
                {profile.meals.find((x) => x.id === planItem.meal)?.name} · {formatDay(planItem.date, today)}
              </p>
            </div>
            <div className="sheet-actions">
              <button
                className="btn btn-ghost danger"
                onClick={() => {
                  const item = planItem;
                  store.deletePlanned(item.id);
                  store.showToast('Removed from plan', () => store.restorePlanned([item]));
                  setPlanItem(null);
                }}
              >
                <Icon name="trash" size={16} /> Remove
              </button>
              {planItem.date <= today ? (
                <button
                  className="btn btn-primary grow"
                  onClick={() => {
                    eat([planItem]);
                    setPlanItem(null);
                  }}
                >
                  <Icon name="check" size={16} /> Mark as eaten
                </button>
              ) : (
                <button className="btn btn-secondary grow" onClick={() => setPlanItem(null)}>
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={!!saveMeal}
        onClose={() => setSaveMeal(null)}
        title="Save as meal"
        footer={
          <button
            className="btn btn-primary block"
            onClick={() => {
              if (!saveMeal) return;
              store.saveMeal(saveMeal.name, (future ? planned : entries).filter((e) => e.meal === saveMeal.meal));
              store.showToast('Meal saved — find it under Meals when adding food');
              setSaveMeal(null);
            }}
          >
            Save meal
          </button>
        }
      >
        <Field label="Name">
          <input value={saveMeal?.name ?? ''} onChange={(e) => setSaveMeal((s) => (s ? { ...s, name: e.target.value } : s))} maxLength={60} />
        </Field>
      </Sheet>
    </div>
  );
}
