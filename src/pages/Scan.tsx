import { useEffect, useRef, useState } from 'react';
import type { Food } from '../lib/types';
import { useStore } from '../lib/store';
import { todayKey } from '../lib/date';
import { uid } from '../lib/storage';
import { compressImage, scanFood, validateImageFile, ScanError, type ScanItem } from '../lib/scanner';
import { sumNutrients } from '../lib/nutrition';
import { Card, Field, NumberInput, parseNum } from '../components/ui';
import { Icon } from '../components/Icon';
import { AddFoodSheet } from '../components/AddFoodSheet';
import { Link, navigate } from '../router';

interface EditItem extends ScanItem {
  key: string;
  base: { grams: number; kcal: number; protein: number; carbs: number; fat: number }; // for proportional scaling
  open: boolean;
}

type Phase = { kind: 'pick' } | { kind: 'working'; image: string } | { kind: 'review'; image: string } | { kind: 'error'; image?: string; message: string; retryable: boolean };

const toEdit = (it: ScanItem): EditItem => ({ ...it, key: uid('i-'), base: { grams: it.grams, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat }, open: false });

export function Scan() {
  const store = useStore();
  const profile = store.profile!;
  const endpoint = profile.scannerEndpoint;
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  const [items, setItems] = useState<EditItem[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [manual, setManual] = useState(false);
  const [meal, setMeal] = useState(() => {
    const h = new Date().getHours();
    const pick = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks';
    return profile.meals.some((m) => m.id === pick) ? pick : profile.meals[0].id;
  });
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const run = async (image: string, extra: string) => {
    if (!endpoint) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase({ kind: 'working', image });
    try {
      const r = await scanFood(endpoint, image, extra, c.signal);
      if (r.items.length === 0) {
        setPhase({ kind: 'error', image, message: 'No food was recognised in this photo. Try a clearer, top-down shot in good light — or log it manually.', retryable: true });
        return;
      }
      setItems(r.items.map(toEdit));
      setQuestions(r.questions);
      setPhase({ kind: 'review', image });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const se = e instanceof ScanError ? e : new ScanError('Something went wrong while scanning.');
      setPhase({ kind: 'error', image, message: se.message, retryable: se.retryable });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      setPhase({ kind: 'error', message: err, retryable: false });
      return;
    }
    try {
      const img = await compressImage(file);
      setDetails('');
      run(img, '');
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message, retryable: false });
    }
  };

  const update = (key: string, patch: Partial<EditItem>, rescale?: number) => {
    setItems((list) =>
      list.map((it) => {
        if (it.key !== key) return it;
        if (rescale != null && it.base.grams > 0) {
          const f = rescale / it.base.grams;
          return {
            ...it,
            grams: rescale,
            kcal: Math.round(it.base.kcal * f),
            protein: Math.round(it.base.protein * f * 10) / 10,
            carbs: Math.round(it.base.carbs * f * 10) / 10,
            fat: Math.round(it.base.fat * f * 10) / 10,
          };
        }
        const next = { ...it, ...patch };
        if (patch.kcal != null || patch.protein != null || patch.carbs != null || patch.fat != null) {
          next.base = { grams: next.grams, kcal: next.kcal, protein: next.protein, carbs: next.carbs, fat: next.fat };
        }
        if (rescale != null) next.grams = rescale;
        return next;
      }),
    );
  };

  const totals = sumNutrients(items.map((i) => ({ nutrients: { kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat } })));
  const validItems = items.filter((i) => i.name.trim() && i.kcal >= 0);

  const save = () => {
    const date = todayKey();
    const created = store.addEntries(
      validItems.map((i) => {
        const hasGrams = i.grams > 0;
        const food: Food = {
          id: uid('ai-'),
          name: i.name.trim(),
          source: 'ai-estimate',
          baseUnit: hasGrams ? 'g' : 'serving',
          baseAmount: hasGrams ? i.grams : 1,
          nutrients: { kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat },
          servings: [{ label: i.serving?.trim() || (hasGrams ? `${i.grams} g` : '1 serving'), amount: hasGrams ? i.grams : 1 }],
        };
        return { date, meal, food, servingLabel: food.servings[0].label, quantity: 1, amount: food.baseAmount, aiEstimated: true };
      }),
    );
    store.showToast(`Added ${created.length} item${created.length === 1 ? '' : 's'} to ${profile.meals.find((m) => m.id === meal)?.name}`, () => created.forEach((c) => store.deleteEntry(c.id)));
    setItems([]);
    setPhase({ kind: 'pick' });
    navigate('/');
  };

  const image = phase.kind !== 'pick' ? (phase as { image?: string }).image : undefined;

  return (
    <div className="page scan">
      <header className="page-head">
        <h1>Scan a meal</h1>
      </header>

      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />

      {!endpoint ? (
        <Card className="scan-setup">
          <div className="scan-hero" aria-hidden="true">
            <div className="scan-frame">
              <Icon name="scan" size={44} />
            </div>
          </div>
          <h2>The AI scanner isn’t connected yet</h2>
          <p className="muted">
            Photo scanning needs a small private server that keeps the AI key secret. Once it’s set up, paste its address in your profile and this screen starts working. Everything else in FuelFlow works without it.
          </p>
          <div className="stack">
            <Link to="/profile?section=scanner" className="btn btn-primary block">
              Set up the scanner
            </Link>
            <button className="btn btn-secondary block" onClick={() => setManual(true)}>
              Log food manually instead
            </button>
          </div>
        </Card>
      ) : (
        <>
          {phase.kind === 'pick' && (
            <Card className="scan-pick">
              <div className="scan-hero" aria-hidden="true">
                <div className="scan-frame">
                  <Icon name="camera" size={44} />
                </div>
              </div>
              <p className="muted center">Take a photo from above with the whole plate in frame. Good light helps.</p>
              <div className="stack">
                <button className="btn btn-primary block" onClick={() => camRef.current?.click()}>
                  <Icon name="camera" size={18} /> Take photo
                </button>
                <button className="btn btn-secondary block" onClick={() => fileRef.current?.click()}>
                  <Icon name="upload" size={18} /> Upload from gallery
                </button>
              </div>
              <p className="muted small center">Photos are sent only to your scanner for analysis and aren’t stored by FuelFlow.</p>
            </Card>
          )}

          {image && (
            <div className={'scan-photo' + (phase.kind === 'working' ? ' working' : '')}>
              <img src={image} alt="Your meal photo" />
              {phase.kind === 'working' && (
                <div className="scan-overlay" role="status" aria-live="polite">
                  <div className="scan-line" />
                  <span>Analysing your meal…</span>
                </div>
              )}
            </div>
          )}

          {phase.kind === 'working' && (
            <button className="btn btn-ghost block" onClick={() => (ctrl.current?.abort(), setPhase({ kind: 'pick' }))}>
              Cancel
            </button>
          )}

          {phase.kind === 'error' && (
            <Card className="scan-error">
              <p className="notice warn">
                <Icon name="alert" size={16} /> {phase.message}
              </p>
              <div className="stack">
                {phase.retryable && phase.image && (
                  <button className="btn btn-primary block" onClick={() => run(phase.image!, details)}>
                    <Icon name="refresh" size={16} /> Try again
                  </button>
                )}
                <button className="btn btn-secondary block" onClick={() => setPhase({ kind: 'pick' })}>
                  Choose another photo
                </button>
                <button className="btn btn-ghost block" onClick={() => setManual(true)}>
                  Log manually
                </button>
              </div>
            </Card>
          )}

          {phase.kind === 'review' && (
            <>
              <p className="notice">
                <Icon name="info" size={16} /> These are estimates from a photo. Portions, cooking oil and sauces are hard to see — check each item before saving.
              </p>

              {questions.length > 0 && (
                <Card className="scan-questions" title="A few questions" icon="sparkles">
                  <ul>
                    {questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card title={`Found ${items.length} item${items.length === 1 ? '' : 's'}`}>
                <ul className="scan-items">
                  {items.map((it) => (
                    <li key={it.key} className="scan-item">
                      <div className="si-top">
                        <input className="si-name" value={it.name} onChange={(e) => update(it.key, { name: e.target.value })} aria-label="Food name" />
                        <span className={`conf conf-${it.confidence}`} title="How sure the scanner is">
                          {it.confidence === 'high' ? 'Likely' : it.confidence === 'medium' ? 'Probably' : 'Unsure'}
                        </span>
                        <button className="icon-btn sm" aria-label={`Remove ${it.name}`} onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                      <div className="si-row">
                        <div className="si-grams">
                          <NumberInput value={String(it.grams)} onChange={(v) => update(it.key, {}, Math.max(0, Math.round(parseNum(v) || 0)))} suffix="g" ariaLabel={`Portion of ${it.name} in grams`} />
                        </div>
                        <span className="si-kcal">
                          <strong>{it.kcal}</strong> kcal
                        </span>
                        <button className="link-btn" onClick={() => update(it.key, { open: !it.open })} aria-expanded={it.open}>
                          {it.open ? 'Hide' : 'Edit'} macros
                        </button>
                      </div>
                      {it.serving && <p className="muted small">Looks like {it.serving}</p>}
                      {it.open && (
                        <div className="row-4">
                          <Field label="kcal">
                            <NumberInput value={String(it.kcal)} onChange={(v) => update(it.key, { kcal: Math.max(0, Math.round(parseNum(v) || 0)) })} ariaLabel="Calories" />
                          </Field>
                          <Field label="Protein">
                            <NumberInput value={String(it.protein)} onChange={(v) => update(it.key, { protein: Math.max(0, parseNum(v) || 0) })} ariaLabel="Protein" />
                          </Field>
                          <Field label="Carbs">
                            <NumberInput value={String(it.carbs)} onChange={(v) => update(it.key, { carbs: Math.max(0, parseNum(v) || 0) })} ariaLabel="Carbs" />
                          </Field>
                          <Field label="Fat">
                            <NumberInput value={String(it.fat)} onChange={(v) => update(it.key, { fat: Math.max(0, parseNum(v) || 0) })} ariaLabel="Fat" />
                          </Field>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <button className="ghost-row" onClick={() => setItems((l) => [...l, { ...toEdit({ name: '', serving: '', grams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0, confidence: 'high' }), open: true }])}>
                  <Icon name="plus" size={16} /> Add a missing item
                </button>
              </Card>

              <Card title="Add details and rescan" icon="refresh">
                <Field label="Anything the photo can’t show?" hint="e.g. cooked in 2 tbsp coconut oil, the rice was brown, half the plate">
                  <textarea rows={2} value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} />
                </Field>
                <button className="btn btn-secondary sm" disabled={!details.trim()} onClick={() => image && run(image, details)}>
                  Rescan with details
                </button>
              </Card>

              <div className="scan-save card">
                <div className="ss-total">
                  <span className="muted small">Total</span>
                  <strong>{totals.kcal} kcal</strong>
                  <span className="muted small">
                    P {Math.round(totals.protein)} · C {Math.round(totals.carbs)} · F {Math.round(totals.fat)}
                  </span>
                </div>
                <Field label="Meal">
                  <select value={meal} onChange={(e) => setMeal(e.target.value)}>
                    {profile.meals.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sheet-actions">
                  <button className="btn btn-ghost" onClick={() => (setItems([]), setPhase({ kind: 'pick' }))}>
                    Discard
                  </button>
                  <button className="btn btn-primary grow" disabled={validItems.length === 0} onClick={save}>
                    Save {validItems.length} item{validItems.length === 1 ? '' : 's'}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <AddFoodSheet open={manual} onClose={() => setManual(false)} date={todayKey()} meal={meal} />
    </div>
  );
}
