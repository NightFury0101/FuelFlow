import { useEffect, useMemo, useRef, useState } from 'react';
import type { Food, SavedMeal } from '../lib/types';
import { useStore } from '../lib/store';
import { searchReference } from '../lib/referenceFoods';
import { searchOpenFoodFacts } from '../lib/foodSearch';
import { scaleNutrients, macroWarning, sumNutrients } from '../lib/nutrition';
import { uid } from '../lib/storage';
import { EmptyState, Field, NumberInput, Segmented, Sheet, SourceTag, parseNum } from './ui';
import { Icon } from './Icon';
import { ServingEditor, defaultServing, type ServingChoice } from './ServingEditor';

type View = { kind: 'browse' } | { kind: 'detail'; food: Food } | { kind: 'create'; edit?: Food } | { kind: 'quick' };
type Tab = 'recent' | 'favorites' | 'mine' | 'meals';

export function AddFoodSheet({ open, onClose, date, meal, initialView = 'browse' }: { open: boolean; onClose: () => void; date: string; meal: string; initialView?: 'browse' | 'quick' | 'create' }) {
  const store = useStore();
  const profile = store.profile!;
  const [view, setView] = useState<View>({ kind: initialView } as View);
  const [added, setAdded] = useState(0);
  const [currentMeal, setCurrentMeal] = useState(meal);

  useEffect(() => {
    if (open) {
      setView({ kind: initialView } as View);
      setAdded(0);
      setCurrentMeal(meal);
    }
  }, [open, initialView, meal]);

  const mealName = profile.meals.find((m) => m.id === currentMeal)?.name ?? 'Meal';
  const title = view.kind === 'detail' ? 'Add food' : view.kind === 'create' ? (view.edit ? 'Edit food' : 'Create a food') : view.kind === 'quick' ? 'Quick add' : `Add to ${mealName}`;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {view.kind === 'browse' && (
        <Browse
          meal={currentMeal}
          date={date}
          added={added}
          onPick={(food) => setView({ kind: 'detail', food })}
          onCreate={() => setView({ kind: 'create' })}
          onEditFood={(f) => setView({ kind: 'create', edit: f })}
          onQuick={() => setView({ kind: 'quick' })}
          onAddedMeal={(n) => setAdded((a) => a + n)}
          onDone={onClose}
        />
      )}
      {view.kind === 'detail' && (
        <Detail
          food={view.food}
          date={date}
          meal={currentMeal}
          onBack={() => setView({ kind: 'browse' })}
          onAdded={(m) => {
            setCurrentMeal(m);
            setAdded((a) => a + 1);
            setView({ kind: 'browse' });
          }}
        />
      )}
      {view.kind === 'create' && (
        <CreateFood
          edit={view.edit}
          onCancel={() => setView({ kind: 'browse' })}
          onSaved={(f) => setView({ kind: 'detail', food: f })}
        />
      )}
      {view.kind === 'quick' && (
        <QuickAdd
          date={date}
          meal={currentMeal}
          onCancel={() => (initialView === 'quick' ? onClose() : setView({ kind: 'browse' }))}
          onAdded={() => {
            setAdded((a) => a + 1);
            if (initialView === 'quick') onClose();
            else setView({ kind: 'browse' });
          }}
        />
      )}
    </Sheet>
  );
}

function FoodRow({ food, onPick, trailing }: { food: Food; onPick: () => void; trailing?: React.ReactNode }) {
  const s = defaultServing(food);
  const n = scaleNutrients(food, s.amount);
  return (
    <li className="food-row">
      <button className="food-row-main" onClick={onPick}>
        <span className="fr-name">{food.name}</span>
        <span className="fr-sub">
          {food.brand && <span className="fr-brand">{food.brand} · </span>}
          {s.label === food.baseUnit ? `${food.baseAmount} ${food.baseUnit}` : s.label} · {n.kcal} kcal
        </span>
        <SourceTag source={food.source} />
      </button>
      {trailing}
    </li>
  );
}

function Browse({ meal, date, added, onPick, onCreate, onEditFood, onQuick, onAddedMeal, onDone }: { meal: string; date: string; added: number; onPick: (f: Food) => void; onCreate: () => void; onEditFood: (f: Food) => void; onQuick: () => void; onAddedMeal: (n: number) => void; onDone: () => void }) {
  const store = useStore();
  const { data } = store;
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const [remote, setRemote] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; foods: Food[]; error?: string }>({ status: 'idle', foods: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const query = q.trim();
  const local = useMemo(() => {
    if (!query) return [];
    const l = query.toLowerCase();
    const mine = [...data.customFoods, ...data.favorites, ...data.recents].filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i && f.name.toLowerCase().includes(l));
    const ref = searchReference(query).filter((f) => !mine.some((m) => m.id === f.id));
    return [...mine.slice(0, 6), ...ref];
  }, [query, data.customFoods, data.favorites, data.recents]);

  useEffect(() => {
    if (query.length < 3) {
      setRemote({ status: 'idle', foods: [] });
      return;
    }
    if (!navigator.onLine) {
      setRemote({ status: 'error', foods: [], error: 'You’re offline. Showing foods saved on this device.' });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setRemote({ status: 'loading', foods: [] });
      try {
        const foods = await searchOpenFoodFacts(query, ctrl.signal);
        setRemote({ status: 'done', foods });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setRemote({ status: 'error', foods: [], error: 'The product database isn’t responding right now. Try again, or create the food yourself.' });
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const addSavedMeal = (m: SavedMeal) => {
    const created = store.addEntries(m.items.map((it) => ({ date, meal, food: it.food, servingLabel: it.servingLabel, quantity: it.quantity, amount: it.amount })));
    onAddedMeal(created.length);
    store.showToast(`Added “${m.name}”`, () => created.forEach((c) => store.deleteEntry(c.id)));
  };

  const tabList: Record<Tab, Food[]> = { recent: data.recents, favorites: data.favorites, mine: data.customFoods, meals: [] };

  return (
    <div className="browse">
      <div className="search-box">
        <Icon name="search" size={18} />
        <input ref={inputRef} type="search" placeholder="Search foods, e.g. tuna, rice, banana" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods" enterKeyHint="search" />
        {q && (
          <button className="icon-btn sm" onClick={() => setQ('')} aria-label="Clear search">
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      <div className="browse-actions">
        <button className="chip" onClick={onQuick}>
          <Icon name="flame" size={15} /> Quick add calories
        </button>
        <button className="chip" onClick={onCreate}>
          <Icon name="plus" size={15} /> Create food
        </button>
      </div>

      {query ? (
        <>
          {local.length > 0 && (
            <ul className="food-list" aria-label="Matching foods">
              {local.map((f) => (
                <FoodRow key={f.id} food={f} onPick={() => onPick(f)} />
              ))}
            </ul>
          )}
          {query.length >= 3 && (
            <div className="remote">
              <p className="list-label">Packaged products · Open Food Facts</p>
              {remote.status === 'loading' && (
                <div className="skeletons" aria-label="Searching">
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
              )}
              {remote.status === 'error' && <p className="notice">{remote.error}</p>}
              {remote.status === 'done' && remote.foods.length === 0 && <p className="muted small pad">No products found for “{query}”.</p>}
              {remote.status === 'done' && remote.foods.length > 0 && (
                <ul className="food-list">
                  {remote.foods.map((f) => (
                    <FoodRow key={f.id} food={f} onPick={() => onPick(f)} />
                  ))}
                </ul>
              )}
            </div>
          )}
          {local.length === 0 && remote.status !== 'loading' && (remote.status !== 'done' || remote.foods.length === 0) && (
            <EmptyState
              icon="search"
              title={`No match for “${query}”`}
              text={query.length < 3 ? 'Keep typing to search packaged products too.' : 'Create it once and it’ll be here next time.'}
              action={
                <button className="btn btn-secondary" onClick={onCreate}>
                  Create “{query}”
                </button>
              }
            />
          )}
        </>
      ) : (
        <>
          <Segmented<Tab>
            label="Food lists"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'recent', label: 'Recent' },
              { value: 'favorites', label: 'Favourites' },
              { value: 'mine', label: 'My foods' },
              { value: 'meals', label: 'Meals' },
            ]}
          />
          {tab === 'meals' ? (
            data.savedMeals.length ? (
              <ul className="food-list">
                {data.savedMeals.map((m) => {
                  const t = sumNutrients(m.items.map((i) => ({ nutrients: scaleNutrients(i.food, i.amount) })));
                  return (
                    <li key={m.id} className="food-row">
                      <button className="food-row-main" onClick={() => addSavedMeal(m)}>
                        <span className="fr-name">{m.name}</span>
                        <span className="fr-sub">
                          {m.items.length} items · {t.kcal} kcal
                        </span>
                      </button>
                      <button className="icon-btn sm" aria-label={`Delete saved meal ${m.name}`} onClick={() => store.deleteSavedMeal(m.id)}>
                        <Icon name="trash" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon="bookmark" title="No saved meals yet" text="In your diary, open a meal’s menu and choose “Save as meal” to reuse it in one tap." />
            )
          ) : tabList[tab].length ? (
            <ul className="food-list">
              {tabList[tab].map((f) => (
                <FoodRow
                  key={f.id}
                  food={f}
                  onPick={() => onPick(f)}
                  trailing={
                    tab === 'mine' ? (
                      <button className="icon-btn sm" aria-label={`Edit ${f.name}`} onClick={() => onEditFood(f)}>
                        <Icon name="edit" size={16} />
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={tab === 'favorites' ? 'star' : tab === 'mine' ? 'utensils' : 'search'}
              title={tab === 'recent' ? 'Search to log your first food' : tab === 'favorites' ? 'No favourites yet' : 'No custom foods yet'}
              text={tab === 'recent' ? 'Foods you log show up here for quick re-adding.' : tab === 'favorites' ? 'Tap the star on any food to keep it here.' : 'Create foods for home cooking or products we don’t have.'}
            />
          )}
        </>
      )}

      {added > 0 && (
        <div className="added-bar">
          <span>
            <Icon name="check" size={16} /> {added} added
          </span>
          <button className="btn btn-primary sm" onClick={onDone}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function Detail({ food, date, meal, onBack, onAdded }: { food: Food; date: string; meal: string; onBack: () => void; onAdded: (meal: string) => void }) {
  const store = useStore();
  const profile = store.profile!;
  const s = defaultServing(food);
  const [choice, setChoice] = useState<ServingChoice | null>({ servingLabel: s.label, quantity: 1, amount: s.amount, meal });
  const add = () => {
    if (!choice) return;
    const [e] = store.addEntries([{ date, meal: choice.meal, food, servingLabel: choice.servingLabel, quantity: choice.quantity, amount: choice.amount }]);
    store.showToast(`Added ${food.name}`, () => store.deleteEntry(e.id));
    onAdded(choice.meal);
  };
  return (
    <div>
      <button className="back-link" onClick={onBack}>
        <Icon name="left" size={16} /> Back to search
      </button>
      <ServingEditor food={food} meals={profile.meals} initial={{ servingLabel: s.label, quantity: 1, amount: s.amount, meal }} favorite={store.isFavorite(food.id)} onToggleFavorite={() => store.toggleFavorite(food)} onChange={setChoice} />
      <div className="sheet-actions">
        <button className="btn btn-primary block" disabled={!choice} onClick={add}>
          Add to {profile.meals.find((m) => m.id === choice?.meal)?.name ?? 'diary'}
        </button>
      </div>
    </div>
  );
}

function CreateFood({ edit, onCancel, onSaved }: { edit?: Food; onCancel: () => void; onSaved: (f: Food) => void }) {
  const store = useStore();
  const per = edit ? (edit.baseUnit === 'serving' ? edit.nutrients : scaleNutrients(edit, edit.servings[0]?.amount ?? edit.baseAmount)) : null;
  const [name, setName] = useState(edit?.name ?? '');
  const [brand, setBrand] = useState(edit?.brand ?? '');
  const [servingLabel, setServingLabel] = useState(edit?.servings[0]?.label ?? '1 serving');
  const [grams, setGrams] = useState(edit && edit.baseUnit === 'g' ? String(edit.servings[0]?.amount ?? '') : '');
  const [kcal, setKcal] = useState(per ? String(per.kcal) : '');
  const [p, setP] = useState(per ? String(per.protein) : '');
  const [c, setC] = useState(per ? String(per.carbs) : '');
  const [f, setF] = useState(per ? String(per.fat) : '');
  const [tried, setTried] = useState(false);

  const nums = { kcal: parseNum(kcal), protein: parseNum(p) || 0, carbs: parseNum(c) || 0, fat: parseNum(f) || 0 };
  const g = parseNum(grams);
  const errors = {
    name: !name.trim() ? 'Give the food a name' : null,
    kcal: !(nums.kcal >= 0 && nums.kcal < 5000) ? 'Enter calories per serving' : null,
    grams: grams && !(g > 0 && g < 5000) ? 'Enter a weight in grams, or leave empty' : null,
  };
  const warn = Number.isFinite(nums.kcal) ? macroWarning(nums) : null;
  const ok = !errors.name && !errors.kcal && !errors.grams;

  const save = () => {
    setTried(true);
    if (!ok) return;
    const label = servingLabel.trim() || '1 serving';
    const food: Food =
      g > 0
        ? { id: edit?.id ?? uid('custom-'), name: name.trim(), brand: brand.trim() || undefined, source: 'custom', baseUnit: 'g', baseAmount: g, nutrients: nums, servings: [{ label, amount: g }] }
        : { id: edit?.id ?? uid('custom-'), name: name.trim(), brand: brand.trim() || undefined, source: 'custom', baseUnit: 'serving', baseAmount: 1, nutrients: nums, servings: [{ label, amount: 1 }] };
    store.saveCustomFood(food);
    store.showToast(edit ? 'Food updated' : 'Food saved to My foods');
    onSaved(food);
  };

  return (
    <div className="form">
      <button className="back-link" onClick={onCancel}>
        <Icon name="left" size={16} /> Back
      </button>
      <Field label="Name" error={tried ? errors.name : null}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mum’s mas huni" />
      </Field>
      <Field label="Brand (optional)">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} />
      </Field>
      <div className="row-2">
        <Field label="Serving name">
          <input value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="1 bowl" />
        </Field>
        <Field label="Serving weight" hint="Optional — lets you log by grams" error={errors.grams}>
          <NumberInput value={grams} onChange={setGrams} suffix="g" ariaLabel="Serving weight in grams" />
        </Field>
      </div>
      <p className="list-label">Nutrition per serving</p>
      <div className="row-2">
        <Field label="Calories" error={tried ? errors.kcal : null}>
          <NumberInput value={kcal} onChange={setKcal} suffix="kcal" ariaLabel="Calories" />
        </Field>
        <Field label="Protein">
          <NumberInput value={p} onChange={setP} suffix="g" step={0.1} ariaLabel="Protein grams" />
        </Field>
        <Field label="Carbs">
          <NumberInput value={c} onChange={setC} suffix="g" step={0.1} ariaLabel="Carbohydrate grams" />
        </Field>
        <Field label="Fat">
          <NumberInput value={f} onChange={setF} suffix="g" step={0.1} ariaLabel="Fat grams" />
        </Field>
      </div>
      {warn && <p className="notice warn">{warn}</p>}
      <div className="sheet-actions">
        {edit && (
          <button
            className="btn btn-ghost danger"
            onClick={() => {
              store.deleteCustomFood(edit.id);
              store.showToast('Food deleted');
              onCancel();
            }}
          >
            Delete
          </button>
        )}
        <button className="btn btn-primary grow" onClick={save}>
          {edit ? 'Save changes' : 'Save food'}
        </button>
      </div>
    </div>
  );
}

function QuickAdd({ date, meal, onCancel, onAdded }: { date: string; meal: string; onCancel: () => void; onAdded: () => void }) {
  const store = useStore();
  const profile = store.profile!;
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [m, setM] = useState(meal);
  const k = parseNum(kcal);
  const ok = k > 0 && k < 5000;
  const add = () => {
    if (!ok) return;
    const nutrients = { kcal: Math.round(k), protein: parseNum(p) || 0, carbs: parseNum(c) || 0, fat: parseNum(f) || 0 };
    const food: Food = { id: uid('manual-'), name: name.trim() || 'Quick add', source: 'manual', baseUnit: 'serving', baseAmount: 1, nutrients, servings: [{ label: '1 serving', amount: 1 }] };
    const [e] = store.addEntries([{ date, meal: m, food, servingLabel: '1 serving', quantity: 1, amount: 1 }]);
    store.showToast(`Added ${nutrients.kcal} kcal`, () => store.deleteEntry(e.id));
    onAdded();
  };
  return (
    <div className="form">
      <p className="muted small">For restaurant meals or anything you only know the calories of.</p>
      <Field label="Description (optional)">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dinner out" />
      </Field>
      <Field label="Calories">
        <NumberInput value={kcal} onChange={setKcal} suffix="kcal" ariaLabel="Calories" />
      </Field>
      <div className="row-3">
        <Field label="Protein">
          <NumberInput value={p} onChange={setP} suffix="g" ariaLabel="Protein grams" />
        </Field>
        <Field label="Carbs">
          <NumberInput value={c} onChange={setC} suffix="g" ariaLabel="Carbohydrate grams" />
        </Field>
        <Field label="Fat">
          <NumberInput value={f} onChange={setF} suffix="g" ariaLabel="Fat grams" />
        </Field>
      </div>
      <Field label="Meal">
        <select value={m} onChange={(e) => setM(e.target.value)}>
          {profile.meals.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="sheet-actions">
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary grow" disabled={!ok} onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}
