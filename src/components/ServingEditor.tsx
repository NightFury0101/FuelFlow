import { useMemo, useState } from 'react';
import type { Food, MealSlot } from '../lib/types';
import { amountFor, scaleNutrients, servingOptions } from '../lib/nutrition';
import { Field, MacroPills, NumberInput, SourceTag, parseNum } from './ui';
import { Icon } from './Icon';

export interface ServingChoice {
  servingLabel: string;
  quantity: number;
  amount: number;
  meal: string;
}

export function defaultServing(food: Food) {
  const opts = servingOptions(food);
  return opts[0];
}

export function ServingEditor({
  food,
  meals,
  initial,
  favorite,
  onToggleFavorite,
  onChange,
}: {
  food: Food;
  meals: MealSlot[];
  initial: ServingChoice;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onChange: (c: ServingChoice | null) => void;
}) {
  const options = useMemo(() => servingOptions(food), [food]);
  const [label, setLabel] = useState(initial.servingLabel);
  const [qty, setQty] = useState(String(initial.quantity));
  const [meal, setMeal] = useState(initial.meal);

  const serving = options.find((o) => o.label === label) ?? options[0];
  const q = parseNum(qty);
  const valid = q > 0 && q <= 10000;
  const amount = valid ? amountFor(serving, q) : 0;
  const n = scaleNutrients(food, amount);

  const emit = (l: string, qs: string, m: string) => {
    const s = options.find((o) => o.label === l) ?? options[0];
    const qq = parseNum(qs);
    onChange(qq > 0 && qq <= 10000 ? { servingLabel: s.label, quantity: qq, amount: amountFor(s, qq), meal: m } : null);
  };

  const isRawUnit = serving.label === food.baseUnit;

  return (
    <div className="serving-editor">
      <div className="se-head">
        <div>
          <h3 className="se-name">{food.name}</h3>
          <div className="se-meta">
            {food.brand && <span>{food.brand}</span>}
            <SourceTag source={food.source} />
          </div>
        </div>
        {onToggleFavorite && (
          <button className={'icon-btn fav' + (favorite ? ' on' : '')} onClick={onToggleFavorite} aria-pressed={favorite} aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}>
            <Icon name="star" filled={favorite} />
          </button>
        )}
      </div>

      <div className="se-big">
        <span className="se-kcal">{valid ? n.kcal : '—'}</span>
        <span className="se-unit">kcal</span>
      </div>
      <div className="se-macros">
        <div>
          <span className="dot-p" />
          Protein <strong>{valid ? n.protein : '—'} g</strong>
        </div>
        <div>
          <span className="dot-c" />
          Carbs <strong>{valid ? n.carbs : '—'} g</strong>
        </div>
        <div>
          <span className="dot-f" />
          Fat <strong>{valid ? n.fat : '—'} g</strong>
        </div>
      </div>

      <div className="row-2">
        <Field label={isRawUnit ? `Amount (${food.baseUnit})` : 'Quantity'} error={!valid ? 'Enter an amount above 0' : null}>
          <NumberInput
            value={qty}
            step={isRawUnit ? 1 : 0.25}
            ariaLabel="Quantity"
            onChange={(v) => {
              setQty(v);
              emit(label, v, meal);
            }}
          />
        </Field>
        <Field label="Serving">
          <select
            value={serving.label}
            onChange={(e) => {
              const next = options.find((o) => o.label === e.target.value)!;
              // Switching to grams: keep the same total amount so numbers don't jump.
              let nq = qty;
              if (next.label === food.baseUnit && valid) nq = String(Math.round(amount));
              else if (serving.label === food.baseUnit && valid) nq = String(Math.round((amount / next.amount) * 100) / 100 || 1);
              setLabel(next.label);
              setQty(nq);
              emit(next.label, nq, meal);
            }}
          >
            {options.map((o) => (
              <option key={o.label} value={o.label}>
                {o.label === food.baseUnit ? (food.baseUnit === 'g' ? 'grams' : 'millilitres') : o.label}
                {o.label !== food.baseUnit && food.baseUnit !== 'serving' && !/\d\s?(g|ml)\b/.test(o.label) ? ` (${Math.round(o.amount)} ${food.baseUnit})` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {valid && !isRawUnit && food.baseUnit !== 'serving' && (
        <p className="muted small">
          {Math.round(amount)} {food.baseUnit} total
        </p>
      )}

      <Field label="Meal">
        <select
          value={meal}
          onChange={(e) => {
            setMeal(e.target.value);
            emit(label, qty, e.target.value);
          }}
        >
          {meals.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      <p className="per-base muted small">
        Per {food.baseUnit === 'serving' ? (food.servings[0]?.label ?? 'serving') : `${food.baseAmount} ${food.baseUnit}`}: {food.nutrients.kcal} kcal ·{' '}
        <MacroPills p={food.nutrients.protein} c={food.nutrients.carbs} f={food.nutrients.fat} />
      </p>
    </div>
  );
}
