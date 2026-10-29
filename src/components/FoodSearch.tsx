import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Food } from '../lib/types';
import { useStore } from '../lib/store';
import { searchReference } from '../lib/referenceFoods';
import { searchOpenFoodFacts } from '../lib/foodSearch';
import { scaleNutrients } from '../lib/nutrition';
import { EmptyState, SourceTag } from './ui';
import { Icon } from './Icon';
import { defaultServing } from './ServingEditor';

type Remote = { status: 'idle' | 'loading' | 'done' | 'error'; foods: Food[]; error?: string };

/** Search across the user's own foods, the built-in reference list, and Open Food Facts. */
export function useFoodSearch(query: string, opts: { excludeId?: string } = {}) {
  const { data } = useStore();
  const [remote, setRemote] = useState<Remote>({ status: 'idle', foods: [] });
  const q = query.trim();

  const local = useMemo(() => {
    if (!q) return [];
    const l = q.toLowerCase();
    const mine = [...data.customFoods, ...data.favorites, ...data.recents].filter(
      (f, i, a) => f.id !== opts.excludeId && a.findIndex((x) => x.id === f.id) === i && f.name.toLowerCase().includes(l),
    );
    const ref = searchReference(q).filter((f) => !mine.some((m) => m.id === f.id));
    return [...mine.slice(0, 6), ...ref];
  }, [q, data.customFoods, data.favorites, data.recents, opts.excludeId]);

  useEffect(() => {
    if (q.length < 3) {
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
        setRemote({ status: 'done', foods: await searchOpenFoodFacts(q, ctrl.signal) });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setRemote({ status: 'error', foods: [], error: 'The product database isn’t responding right now. Try again, or create the food yourself.' });
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return { query: q, local, remote };
}

export function FoodRow({ food, onPick, trailing }: { food: Food; onPick: () => void; trailing?: ReactNode }) {
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

export function SearchBox({ value, onChange, placeholder, autoFocus = true }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => ref.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [autoFocus]);
  return (
    <div className="search-box">
      <Icon name="search" size={18} />
      <input ref={ref} type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Search foods" enterKeyHint="search" />
      {value && (
        <button className="icon-btn sm" onClick={() => onChange('')} aria-label="Clear search">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

/** Results for a non-empty query: local matches, then packaged products. */
export function SearchResults({ search, onPick, onCreate }: { search: ReturnType<typeof useFoodSearch>; onPick: (f: Food) => void; onCreate?: () => void }) {
  const { query, local, remote } = search;
  return (
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
            onCreate && (
              <button className="btn btn-secondary" onClick={onCreate}>
                Create “{query}”
              </button>
            )
          }
        />
      )}
    </>
  );
}
