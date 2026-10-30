import { useEffect, useState } from 'react';
import type { WeightEntry } from '../lib/types';
import { useStore } from '../lib/store';
import { todayKey, isValidDateKey } from '../lib/date';
import { weightToKg, weightValue } from '../lib/units';
import { MEASURES, fromDisplay, toDisplay, unitFor, type MeasureKey } from '../lib/measurements';
import { Field, NumberInput, Sheet, parseNum } from './ui';
import { Icon } from './Icon';

type MeasureInputs = Record<MeasureKey, string>;
const emptyMeasures = (): MeasureInputs => ({ waistCm: '', hipsCm: '', chestCm: '', armCm: '', thighCm: '', bodyFatPct: '' });

export function WeightSheet({ open, onClose, edit }: { open: boolean; onClose: () => void; edit?: WeightEntry | null }) {
  const store = useStore();
  const profile = store.profile!;
  const units = profile.units;
  const latest = [...store.data.weights].sort((a, b) => b.date.localeCompare(a.date))[0];
  const [val, setVal] = useState('');
  const [date, setDate] = useState(todayKey());
  const [measures, setMeasures] = useState<MeasureInputs>(emptyMeasures);
  const [showMore, setShowMore] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    const m = emptyMeasures();
    if (edit) {
      setVal(String(weightValue(edit.kg, units)));
      setDate(edit.date);
      for (const x of MEASURES) if (typeof edit[x.key] === 'number') m[x.key] = String(toDisplay(x, edit[x.key]!, units));
      setNote(edit.note ?? '');
    } else {
      setVal(latest ? String(weightValue(latest.kg, units)) : profile.startWeightKg ? String(weightValue(profile.startWeightKg, units)) : '');
      setDate(todayKey());
      setNote('');
    }
    setMeasures(m);
    setShowMore(MEASURES.some((x) => x.key !== 'waistCm' && m[x.key] !== ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit?.id]);

  const v = parseNum(val);
  const kg = Number.isFinite(v) ? weightToKg(v, units) : NaN;
  const measureErrors: Partial<Record<MeasureKey, string>> = {};
  const stored: Partial<Record<MeasureKey, number>> = {};
  for (const m of MEASURES) {
    const raw = measures[m.key];
    if (!raw) continue;
    const n = fromDisplay(m, parseNum(raw), units);
    if (!(n >= m.min && n <= m.max)) measureErrors[m.key] = `Check this value, or leave it empty`;
    else stored[m.key] = n;
  }
  const errors = {
    weight: !(kg > 20 && kg < 400) ? 'Enter a realistic weight' : null,
    date: !isValidDateKey(date) || date > todayKey() ? 'Choose today or an earlier date' : null,
  };
  const ok = !errors.weight && !errors.date && Object.keys(measureErrors).length === 0;

  const save = () => {
    if (!ok) return;
    const payload: Omit<WeightEntry, 'id' | 'createdAt'> = { date, kg: Math.round(kg * 100) / 100, note: note.trim() || undefined };
    for (const m of MEASURES) payload[m.key] = stored[m.key];
    if (edit) {
      store.updateWeight(edit.id, payload);
      store.showToast('Weigh-in updated');
    } else {
      // One weigh-in per day: logging again on the same date replaces that day's entry.
      const sameDay = store.data.weights.find((x) => x.date === date);
      if (sameDay) {
        const { id: _id, createdAt: _c, ...before } = sameDay;
        store.updateWeight(sameDay.id, payload);
        store.showToast('Updated that day’s weigh-in', () => store.updateWeight(sameDay.id, before));
      } else {
        store.addWeight(payload);
        store.showToast('Weigh-in saved');
      }
    }
    onClose();
  };

  const field = (key: MeasureKey) => {
    const m = MEASURES.find((x) => x.key === key)!;
    const unit = unitFor(m, units);
    return (
      <Field key={key} label={m.label} hint={m.hint} error={measureErrors[key]}>
        <NumberInput value={measures[key]} onChange={(s) => setMeasures((x) => ({ ...x, [key]: s }))} step={0.5} suffix={unit} ariaLabel={`${m.label} in ${unit}`} />
      </Field>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={edit ? 'Edit weigh-in' : 'Log weight'}>
      <div className="form">
        <Field label={`Weight (${units.weight})`} error={val ? errors.weight : null}>
          <NumberInput value={val} onChange={setVal} step={0.1} suffix={units.weight} ariaLabel={`Weight in ${units.weight}`} />
        </Field>
        <Field label="Date" error={errors.date}>
          <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {field('waistCm')}
        {showMore ? (
          <div className="row-2">{MEASURES.filter((m) => m.key !== 'waistCm').map((m) => field(m.key))}</div>
        ) : (
          <button type="button" className="ghost-row" onClick={() => setShowMore(true)}>
            <Icon name="plus" size={16} /> More measurements (hips, chest, arm, thigh, body fat)
          </button>
        )}
        <Field label="Note (optional)">
          <input value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after holiday, new routine" />
        </Field>
        <p className="muted small">For comparable numbers, weigh and measure at the same time of day — first thing in the morning works well. All measurements are optional.</p>
        <div className="sheet-actions">
          {edit && (
            <button
              className="btn btn-ghost danger"
              onClick={() => {
                const { id: _id, createdAt: _c, ...copy } = edit;
                store.deleteWeight(edit.id);
                store.showToast('Weigh-in deleted', () => store.addWeight(copy));
                onClose();
              }}
            >
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
          <button className="btn btn-primary grow" disabled={!ok} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}
