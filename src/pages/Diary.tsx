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

export function Diary() {
  const store = useStore();
  const profile = store.profile!;
  const route = useRoute();
  const today = todayKey();
  const qd = route.query.get('date') || '';
  const date = isValidDateKey(qd) && qd <= today ? qd : today;
  const setDate = (d: string) => navigate(`/diary?date=${d}`, { replace: true });

  const [add, setAdd] = useState<{ meal: string; view: 'browse' | 'quick' } | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [saveMeal, setSaveMeal] = useState<{ meal: string; name: string } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const entries = useMemo(() => entriesForDay(store.data.entries, date), [store.data.entries, date]);
  const yesterdayEntries = useMemo(() => entriesForDay(store.data.entries, addDays(date, -1)), [store.data.entries, date]);
  const totals = sumNutrients(entries);
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

  const copyFrom = (meal: string, from: FoodEntry[]) => {
    const created = store.addEntries(from.map((e) => ({ date, meal, food: e.food, servingLabel: e.servingLabel, quantity: e.quantity, amount: e.amount, aiEstimated: e.aiEstimated })));
    store.showToast(`Copied ${created.length} item${created.length === 1 ? '' : 's'}`, () => created.forEach((c) => store.deleteEntry(c.id)));
  };

  return (
    <div className="page diary">
      <header className="page-head">
        <h1>Diary</h1>
        <label className="date-pick">
          <Icon name="calendar" size={18} />
          <span className="sr-only">Pick a date</span>
          <input type="date" value={date} max={today} onChange={(e) => isValidDateKey(e.target.value) && setDate(e.target.value)} />
        </label>
      </header>

      <div className="day-nav">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          <Icon name="left" />
        </button>
        <div className="week-strip" role="list">
          {week.map((d) => {
            const future = d > today;
            return (
              <button
                key={d}
                role="listitem"
                disabled={future}
                className={'wday' + (d === date ? ' on' : '') + (d === today ? ' today' : '')}
                onClick={() => setDate(d)}
                aria-label={formatDay(d, today)}
                aria-current={d === date ? 'date' : undefined}
              >
                <span className="wd">{parseDateKey(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                <span className="dn">{parseDateKey(d).getDate()}</span>
                <span className={'logged-dot' + (loggedDays.has(d) ? ' on' : '')} />
              </button>
            );
          })}
        </div>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day">
          <Icon name="right" />
        </button>
      </div>
      <p className="day-title">
        {formatDay(date, today)}
        {date !== today && (
          <button className="link-btn" onClick={() => setDate(today)}>
            Back to today
          </button>
        )}
      </p>

      <Card className="day-summary">
        <div className="ds-top">
          <span>
            <strong className="ds-kcal">{totals.kcal.toLocaleString()}</strong> <span className="muted">/ {t.kcal.toLocaleString()} kcal</span>
          </span>
          <span className={totals.kcal > t.kcal ? 'warn-text small' : 'muted small'}>{totals.kcal > t.kcal ? `${(totals.kcal - t.kcal).toLocaleString()} over` : `${(t.kcal - totals.kcal).toLocaleString()} left`}</span>
        </div>
        <Bar value={totals.kcal} max={t.kcal} color={totals.kcal > t.kcal ? 'var(--warn)' : 'var(--accent)'} label="Calories for the day" />
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
      </Card>

      {profile.meals.map((m) => {
        const list = entries.filter((e) => e.meal === m.id);
        const mt = sumNutrients(list);
        const prev = yesterdayEntries.filter((e) => e.meal === m.id);
        return (
          <section key={m.id} className="meal-section card" ref={(el) => {
              sectionRefs.current[m.id] = el;
            }} aria-label={m.name}>
            <header className="ms-head">
              <div>
                <h2>{m.name}</h2>
                {list.length > 0 && (
                  <span className="muted small">
                    {mt.kcal} kcal · <MacroPills p={mt.protein} c={mt.carbs} f={mt.fat} />
                  </span>
                )}
              </div>
              <div className="ms-tools">
                <button className="icon-btn" aria-label={`More options for ${m.name}`} aria-haspopup="menu" onClick={() => setMenu(menu === m.id ? null : m.id)}>
                  <Icon name="more" />
                </button>
                <button className="add-round" onClick={() => setAdd({ meal: m.id, view: 'browse' })} aria-label={`Add food to ${m.name}`}>
                  <Icon name="plus" size={18} />
                </button>
                {menu === m.id && (
                  <div className="menu" role="menu" onMouseLeave={() => setMenu(null)}>
                    <button role="menuitem" onClick={() => (setMenu(null), setAdd({ meal: m.id, view: 'quick' }))}>
                      <Icon name="flame" size={16} /> Quick add calories
                    </button>
                    {prev.length > 0 && (
                      <button role="menuitem" onClick={() => (setMenu(null), copyFrom(m.id, prev))}>
                        <Icon name="copy" size={16} /> Copy previous day’s {m.name.toLowerCase()}
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
                    {list.length > 0 && (
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
                  </div>
                )}
              </div>
            </header>
            {list.length > 0 ? (
              <ul className="entry-list">
                {list.map((e) => (
                  <li key={e.id}>
                    <button className="entry" onClick={() => setEditing(e)}>
                      <span className="entry-main">
                        <span className="entry-name">{e.food.name}</span>
                        <span className="entry-sub muted small">
                          {formatAmount(e)}
                          {(e.aiEstimated || e.food.source === 'manual') && (
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
            ) : prev.length > 0 ? (
              <button className="ghost-row" onClick={() => copyFrom(m.id, prev)}>
                <Icon name="copy" size={16} /> Same as the day before? Copy {prev.length} item{prev.length === 1 ? '' : 's'}
              </button>
            ) : null}
          </section>
        );
      })}

      {entries.length === 0 && <EmptyState icon="utensils" title={date === today ? 'Nothing logged today' : 'Nothing logged this day'} text="Tap + on a meal to search foods, or scan a photo of your plate." />}

      <WaterCard date={date} />

      <AddFoodSheet open={!!add} onClose={() => setAdd(null)} date={date} meal={add?.meal ?? 'snacks'} initialView={add?.view ?? 'browse'} />
      <EntryEditor entry={editing} onClose={() => setEditing(null)} />
      <Sheet
        open={!!saveMeal}
        onClose={() => setSaveMeal(null)}
        title="Save as meal"
        footer={
          <button
            className="btn btn-primary block"
            onClick={() => {
              if (!saveMeal) return;
              store.saveMeal(saveMeal.name, entries.filter((e) => e.meal === saveMeal.meal));
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
