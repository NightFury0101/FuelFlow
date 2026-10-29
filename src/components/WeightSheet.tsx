import { useEffect, useState } from 'react';
import type { WeightEntry } from '../lib/types';
import { useStore } from '../lib/store';
import { todayKey, isValidDateKey } from '../lib/date';
import { weightToKg, weightValue } from '../lib/units';
import { Field, NumberInput, Sheet, parseNum } from './ui';
import { Icon } from './Icon';

export function WeightSheet({ open, onClose, edit }: { open: boolean; onClose: () => void; edit?: WeightEntry | null }) {
  const store = useStore();
  const profile = store.profile!;
  const units = profile.units;
  const latest = [...store.data.weights].sort((a, b) => b.date.localeCompare(a.date))[0];
  const [val, setVal] = useState('');
  const [date, setDate] = useState(todayKey());
  const [waist, setWaist] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setVal(String(weightValue(edit.kg, units)));
      setDate(edit.date);
      setWaist(edit.waistCm ? String(edit.waistCm) : '');
      setNote(edit.note ?? '');
    } else {
      setVal(latest ? String(weightValue(latest.kg, units)) : profile.startWeightKg ? String(weightValue(profile.startWeightKg, units)) : '');
      setDate(todayKey());
      setWaist('');
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit?.id]);

  const v = parseNum(val);
  const kg = Number.isFinite(v) ? weightToKg(v, units) : NaN;
  const w = parseNum(waist);
  const errors = {
    weight: !(kg > 20 && kg < 400) ? 'Enter a realistic weight' : null,
    date: !isValidDateKey(date) || date > todayKey() ? 'Choose today or an earlier date' : null,
    waist: waist && !(w > 30 && w < 300) ? 'Enter waist in cm, or leave empty' : null,
  };
  const ok = !errors.weight && !errors.date && !errors.waist;

  const save = () => {
    if (!ok) return;
    const payload = { date, kg: Math.round(kg * 100) / 100, waistCm: waist ? w : undefined, note: note.trim() || undefined };
    if (edit) {
      store.updateWeight(edit.id, payload);
      store.showToast('Weigh-in updated');
    } else {
      // One weigh-in per day: logging again on the same date replaces that day's entry.
      const sameDay = store.data.weights.find((x) => x.date === date);
      if (sameDay) {
        store.updateWeight(sameDay.id, payload);
        store.showToast('Updated that day’s weigh-in', () => store.updateWeight(sameDay.id, { kg: sameDay.kg, waistCm: sameDay.waistCm, note: sameDay.note }));
      } else {
        store.addWeight(payload);
        store.showToast('Weigh-in saved');
      }
    }
    onClose();
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
        <Field label="Waist (optional)" error={errors.waist}>
          <NumberInput value={waist} onChange={setWaist} step={0.5} suffix="cm" ariaLabel="Waist in centimetres" />
        </Field>
        <Field label="Note (optional)">
          <input value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after holiday, new routine" />
        </Field>
        <p className="muted small">For comparable numbers, weigh at the same time of day — first thing in the morning works well.</p>
        <div className="sheet-actions">
          {edit && (
            <button
              className="btn btn-ghost danger"
              onClick={() => {
                store.deleteWeight(edit.id);
                store.showToast('Weigh-in deleted', () => store.addWeight({ date: edit.date, kg: edit.kg, waistCm: edit.waistCm, note: edit.note }));
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
