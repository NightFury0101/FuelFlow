import { useEffect, useState } from 'react';
import type { Food, FoodEntry, RecipeIngredient, SavedMeal } from '../lib/types';
import { useStore, type NewEntryInput } from '../lib/store';
import { buildRecipeFood, formatAmount, macroWarning, scaleNutrients, sumNutrients } from '../lib/nutrition';
import { uid } from '../lib/storage';
import { EmptyState, Field, MacroPills, NumberInput, Segmented, Sheet, parseNum } from './ui';
import { Icon } from './Icon';
import { ServingEditor, defaultServing, type ServingChoice } from './ServingEditor';
import { FoodRow, SearchBox, SearchResults, useFoodSearch } from './FoodSearch';

type View =
  | { kind: 'browse' }
  | { kind: 'detail'; food: Food }
  | { kind: 'create'; edit?: Food; name?: string }
  | { kind: 'recipe'; edit?: Food }
  | { kind: 'quick' };
type Tab = 'recent' | 'favorites' | 'mine' | 'meals';

/** Where added food goes: the diary (eaten) or the meal plan (not counted until eaten). */
interface Sink {
  plan: boolean;
  add: (items: NewEntryInput[]) => FoodEntry[];
  remove: (id: string) => void;
}

function useSink(plan: boolean): Sink {
  const store = useStore();
  return plan ? { plan, add: store.addPlanned, remove: store.deletePlanned } : { plan, add: store.addEntries, remove: store.deleteEntry };
}

export function AddFoodSheet({
  open,
  onClose,
  date,
  meal,
  initialView = 'browse',
  plan = false,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  meal: string;
  initialView?: 'browse' | 'quick' | 'create' | 'recipe';
  plan?: boolean;
}) {
  const store = useStore();
  const profile = store.profile!;
  const sink = useSink(plan);
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
  const title =
    view.kind === 'detail'
      ? plan
        ? 'Plan food'
        : 'Add food'
      : view.kind === 'create'
        ? view.edit
          ? 'Edit food'
          : 'Create a food'
        : view.kind === 'recipe'
          ? view.edit
            ? 'Edit recipe'
            : 'New recipe'
          : view.kind === 'quick'
            ? 'Quick add'
            : plan
              ? `Plan ${mealName.toLowerCase()}`
              : `Add to ${mealName}`;

  const back = () => (initialView === 'browse' ? setView({ kind: 'browse' }) : onClose());

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {plan && view.kind !== 'recipe' && view.kind !== 'create' && (
        <p className="plan-note">
          <Icon name="calendar" size={15} /> Planned food isn’t counted until you mark it as eaten.
        </p>
      )}
      {view.kind === 'browse' && (
        <Browse
          meal={currentMeal}
          date={date}
          sink={sink}
          added={added}
          onPick={(food) => setView({ kind: 'detail', food })}
          onCreate={(name) => setView({ kind: 'create', name })}
          onEditFood={(f) => setView(f.recipe ? { kind: 'recipe', edit: f } : { kind: 'create', edit: f })}
          onNewRecipe={() => setView({ kind: 'recipe' })}
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
          sink={sink}
          onBack={() => setView({ kind: 'browse' })}
          onAdded={(m) => {
            setCurrentMeal(m);
            setAdded((a) => a + 1);
            setView({ kind: 'browse' });
          }}
        />
      )}
      {view.kind === 'create' && <CreateFood edit={view.edit} initialName={view.name} onCancel={back} onSaved={(f) => setView({ kind: 'detail', food: f })} />}
      {view.kind === 'recipe' && <RecipeEditor edit={view.edit} onCancel={back} onSaved={(f) => setView({ kind: 'detail', food: f })} />}
      {view.kind === 'quick' && (
        <QuickAdd
          date={date}
          meal={currentMeal}
          sink={sink}
          onCancel={back}
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

function Browse({
  meal,
  date,
  sink,
  added,
  onPick,
  onCreate,
  onEditFood,
  onNewRecipe,
  onQuick,
  onAddedMeal,
  onDone,
}: {
  meal: string;
  date: string;
  sink: Sink;
  added: number;
  onPick: (f: Food) => void;
  onCreate: (name?: string) => void;
  onEditFood: (f: Food) => void;
  onNewRecipe: () => void;
  onQuick: () => void;
  onAddedMeal: (n: number) => void;
  onDone: () => void;
}) {
  const store = useStore();
  const { data } = store;
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const search = useFoodSearch(q);

  const addSavedMeal = (m: SavedMeal) => {
    const created = sink.add(m.items.map((it) => ({ date, meal, food: it.food, servingLabel: it.servingLabel, quantity: it.quantity, amount: it.amount })));
    onAddedMeal(created.length);
    store.showToast(`${sink.plan ? 'Planned' : 'Added'} “${m.name}”`, () => created.forEach((c) => sink.remove(c.id)));
  };

  const tabList: Record<Tab, Food[]> = { recent: data.recents, favorites: data.favorites, mine: data.customFoods, meals: [] };

  return (
    <div className="browse">
      <SearchBox value={q} onChange={setQ} placeholder="Search foods, e.g. tuna, rice, banana" />

      <div className="browse-actions">
        <button className="chip" onClick={onQuick}>
          <Icon name="flame" size={15} /> Quick add
        </button>
        <button className="chip" onClick={() => onCreate()}>
          <Icon name="plus" size={15} /> Create food
        </button>
        <button className="chip" onClick={onNewRecipe}>
          <Icon name="utensils" size={15} /> New recipe
        </button>
      </div>

      {search.query ? (
        <SearchResults search={search} onPick={onPick} onCreate={() => onCreate(search.query)} />
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
                      <button
                        className="icon-btn sm"
                        aria-label={`Delete saved meal ${m.name}`}
                        onClick={() => {
                          if (window.confirm(`Delete the saved meal “${m.name}”?`)) store.deleteSavedMeal(m.id);
                        }}
                      >
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
              title={tab === 'recent' ? 'Search to log your first food' : tab === 'favorites' ? 'No favourites yet' : 'No foods or recipes yet'}
              text={
                tab === 'recent'
                  ? 'Foods you log show up here for quick re-adding.'
                  : tab === 'favorites'
                    ? 'Tap the star on any food to keep it here.'
                    : 'Create foods for products we don’t have, or build a recipe from your own ingredients.'
              }
              action={
                tab === 'mine' ? (
                  <button className="btn btn-secondary" onClick={onNewRecipe}>
                    New recipe
                  </button>
                ) : undefined
              }
            />
          )}
        </>
      )}

      {added > 0 && (
        <div className="added-bar">
          <span>
            <Icon name="check" size={16} /> {added} {sink.plan ? 'planned' : 'added'}
          </span>
          <button className="btn btn-primary sm" onClick={onDone}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function Detail({ food, date, meal, sink, onBack, onAdded }: { food: Food; date: string; meal: string; sink: Sink; onBack: () => void; onAdded: (meal: string) => void }) {
  const store = useStore();
  const profile = store.profile!;
  const s = defaultServing(food);
  const [choice, setChoice] = useState<ServingChoice | null>({ servingLabel: s.label, quantity: 1, amount: s.amount, meal });
  const add = () => {
    if (!choice) return;
    const [e] = sink.add([{ date, meal: choice.meal, food, servingLabel: choice.servingLabel, quantity: choice.quantity, amount: choice.amount }]);
    store.showToast(`${sink.plan ? 'Planned' : 'Added'} ${food.name}`, () => sink.remove(e.id));
    onAdded(choice.meal);
  };
  const mealName = profile.meals.find((m) => m.id === choice?.meal)?.name ?? 'diary';
  return (
    <div>
      <button className="back-link" onClick={onBack}>
        <Icon name="left" size={16} /> Back to search
      </button>
      <ServingEditor food={food} meals={profile.meals} initial={{ servingLabel: s.label, quantity: 1, amount: s.amount, meal }} favorite={store.isFavorite(food.id)} onToggleFavorite={() => store.toggleFavorite(food)} onChange={setChoice} />
      {food.recipe && (
        <p className="muted small recipe-note">
          Recipe · makes {food.recipe.servings} serving{food.recipe.servings === 1 ? '' : 's'} · {food.recipe.ingredients.length} ingredient{food.recipe.ingredients.length === 1 ? '' : 's'}
        </p>
      )}
      <div className="sheet-actions">
        <button className="btn btn-primary block" disabled={!choice} onClick={add}>
          {sink.plan ? `Plan for ${mealName}` : `Add to ${mealName}`}
        </button>
      </div>
    </div>
  );
}

function CreateFood({ edit, initialName, onCancel, onSaved }: { edit?: Food; initialName?: string; onCancel: () => void; onSaved: (f: Food) => void }) {
  const store = useStore();
  const per = edit ? (edit.baseUnit === 'serving' ? edit.nutrients : scaleNutrients(edit, edit.servings[0]?.amount ?? edit.baseAmount)) : null;
  const [name, setName] = useState(edit?.name ?? initialName ?? '');
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
              if (!window.confirm(`Delete “${edit.name}” from My foods? Past diary entries stay as they are.`)) return;
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

function RecipeEditor({ edit, onCancel, onSaved }: { edit?: Food; onCancel: () => void; onSaved: (f: Food) => void }) {
  const store = useStore();
  const [name, setName] = useState(edit?.name ?? '');
  const [servings, setServings] = useState(String(edit?.recipe?.servings ?? 4));
  const [notes, setNotes] = useState(edit?.recipe?.notes ?? '');
  const [ingredients, setIngredients] = useState<Array<RecipeIngredient & { key: string }>>(() => (edit?.recipe?.ingredients ?? []).map((i) => ({ ...i, key: uid('ing-') })));
  const [picking, setPicking] = useState<{ food?: Food; editKey?: string } | null>(null);
  const [q, setQ] = useState('');
  const [choice, setChoice] = useState<ServingChoice | null>(null);
  const [tried, setTried] = useState(false);
  const search = useFoodSearch(q, { excludeId: edit?.id });

  const n = parseNum(servings);
  const servingsOk = Number.isInteger(n) && n >= 1 && n <= 100;
  const total = sumNutrients(ingredients.map((i) => ({ nutrients: scaleNutrients(i.food, i.amount) })));
  const per = servingsOk ? { kcal: Math.round(total.kcal / n), protein: total.protein / n, carbs: total.carbs / n, fat: total.fat / n } : null;
  const ok = name.trim() && servingsOk && ingredients.length > 0;

  const save = () => {
    setTried(true);
    if (!ok) return;
    const food = buildRecipeFood(
      edit?.id ?? uid('recipe-'),
      name.trim(),
      n,
      ingredients.map((i) => ({ food: i.food, servingLabel: i.servingLabel, quantity: i.quantity, amount: i.amount })),
      notes.trim() || undefined,
    );
    store.saveCustomFood(food);
    store.showToast(edit ? 'Recipe updated' : 'Recipe saved to My foods');
    onSaved(food);
  };

  if (picking) {
    if (picking.food) {
      const f = picking.food;
      const existing = picking.editKey ? ingredients.find((i) => i.key === picking.editKey) : undefined;
      const s = defaultServing(f);
      const initial = existing ? { servingLabel: existing.servingLabel, quantity: existing.quantity, amount: existing.amount, meal: '' } : { servingLabel: s.label, quantity: 1, amount: s.amount, meal: '' };
      return (
        <div>
          <button className="back-link" onClick={() => setPicking(existing ? null : {})}>
            <Icon name="left" size={16} /> {existing ? 'Back to recipe' : 'Back to search'}
          </button>
          <ServingEditor key={f.id + (picking.editKey ?? '')} food={f} meals={[]} hideMeal initial={initial} onChange={setChoice} />
          <div className="sheet-actions">
            <button
              className="btn btn-primary block"
              disabled={!choice}
              onClick={() => {
                const c = choice ?? initial;
                const item = { key: picking.editKey ?? uid('ing-'), food: f, servingLabel: c.servingLabel, quantity: c.quantity, amount: c.amount };
                setIngredients((list) => (picking.editKey ? list.map((i) => (i.key === picking.editKey ? item : i)) : [...list, item]));
                setPicking(null);
                setQ('');
              }}
            >
              {existing ? 'Update ingredient' : 'Add to recipe'}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="browse">
        <button className="back-link" onClick={() => (setPicking(null), setQ(''))}>
          <Icon name="left" size={16} /> Back to recipe
        </button>
        <SearchBox value={q} onChange={setQ} placeholder="Find an ingredient, e.g. rice, tuna, coconut" />
        {search.query ? (
          <SearchResults search={search} onPick={(food) => (setChoice(null), setPicking({ food }))} />
        ) : (
          <p className="muted small pad">Search the food list or your own foods. Weigh ingredients raw or cooked — just be consistent.</p>
        )}
      </div>
    );
  }

  return (
    <div className="form">
      <button className="back-link" onClick={onCancel}>
        <Icon name="left" size={16} /> Back
      </button>
      <Field label="Recipe name" error={tried && !name.trim() ? 'Give the recipe a name' : null}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tuna curry (garudhiya style)" maxLength={60} />
      </Field>
      <Field label="Number of servings it makes" error={!servingsOk ? 'Enter a whole number from 1 to 100' : null}>
        <NumberInput value={servings} onChange={setServings} step={1} min={1} ariaLabel="Servings" />
      </Field>

      <div>
        <p className="list-label">Ingredients</p>
        {ingredients.length === 0 ? (
          <p className={'muted small pad' + (tried ? ' warn-text' : '')}>Add at least one ingredient.</p>
        ) : (
          <ul className="plain-list">
            {ingredients.map((i) => (
              <li key={i.key} className="plain-row">
                <button className="ing-main" onClick={() => (setChoice(null), setPicking({ food: i.food, editKey: i.key }))}>
                  <strong>{i.food.name}</strong>
                  <span className="muted small block">
                    {formatAmount(i)} · {scaleNutrients(i.food, i.amount).kcal} kcal
                  </span>
                </button>
                <button className="icon-btn sm" aria-label={`Remove ${i.food.name}`} onClick={() => setIngredients((l) => l.filter((x) => x.key !== i.key))}>
                  <Icon name="x" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="ghost-row" onClick={() => (setQ(''), setPicking({}))}>
          <Icon name="plus" size={16} /> Add ingredient
        </button>
      </div>

      {ingredients.length > 0 && (
        <div className="recipe-total">
          <div>
            <span className="muted small">Whole recipe</span>
            <strong>{total.kcal.toLocaleString()} kcal</strong>
          </div>
          {per && (
            <div>
              <span className="muted small">Per serving</span>
              <strong className="accent">{per.kcal.toLocaleString()} kcal</strong>
              <MacroPills p={per.protein} c={per.carbs} f={per.fat} />
            </div>
          )}
        </div>
      )}

      <Field label="Notes (optional)">
        <textarea rows={2} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Method, tips, where it’s from…" />
      </Field>

      <div className="sheet-actions">
        {edit && (
          <button
            className="btn btn-ghost danger"
            onClick={() => {
              if (!window.confirm(`Delete the recipe “${edit.name}”? Past diary entries stay as they are.`)) return;
              store.deleteCustomFood(edit.id);
              store.showToast('Recipe deleted');
              onCancel();
            }}
          >
            Delete
          </button>
        )}
        <button className="btn btn-primary grow" onClick={save}>
          Save recipe
        </button>
      </div>
    </div>
  );
}

function QuickAdd({ date, meal, sink, onCancel, onAdded }: { date: string; meal: string; sink: Sink; onCancel: () => void; onAdded: () => void }) {
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
    const [e] = sink.add([{ date, meal: m, food, servingLabel: '1 serving', quantity: 1, amount: 1 }]);
    store.showToast(`${sink.plan ? 'Planned' : 'Added'} ${nutrients.kcal} kcal`, () => sink.remove(e.id));
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
          {sink.plan ? 'Plan' : 'Add'}
        </button>
      </div>
    </div>
  );
}
