import { useState } from 'react';
import { useStore } from '../lib/store';
import { displayWater, waterToMl, ML_PER_FLOZ } from '../lib/units';
import { Bar } from './charts';
import { Card, Field, NumberInput, Sheet, parseNum } from './ui';
import { Icon } from './Icon';

export function WaterCard({ date }: { date: string }) {
  const store = useStore();
  const profile = store.profile!;
  const [open, setOpen] = useState(false);
  const entries = store.data.water.filter((w) => w.date === date);
  const total = entries.reduce((s, w) => s + w.ml, 0);
  const target = profile.targets.waterMl;

  const add = (ml: number) => {
    const w = store.addWater(ml, date);
    store.showToast(`+${displayWater(ml, profile.units)} water`, () => store.deleteWater(w.id));
  };

  return (
    <Card
      title="Water"
      icon="drop"
      className="water-card"
      action={
        <button className="link-btn" onClick={() => setOpen(true)}>
          Details
        </button>
      }
    >
      <div className="water-top">
        <p className="water-amount">
          <strong>{displayWater(total, profile.units)}</strong>
          <span className="muted"> / {displayWater(target, profile.units)}</span>
        </p>
        {total >= target && target > 0 && <span className="pill pill-water">Goal reached</span>}
      </div>
      <Bar value={total} max={target} color="var(--water)" label="Water progress" />
      <div className="water-actions">
        {profile.waterQuickAdds.map((ml) => (
          <button key={ml} className="chip chip-water" onClick={() => add(ml)}>
            <Icon name="plus" size={14} /> {displayWater(ml, profile.units)}
          </button>
        ))}
        <button className="chip" onClick={() => setOpen(true)}>
          Custom
        </button>
      </div>
      <WaterSheet open={open} onClose={() => setOpen(false)} date={date} />
    </Card>
  );
}

export function WaterSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const store = useStore();
  const profile = store.profile!;
  const unit = profile.units.water === 'floz' ? 'fl oz' : 'ml';
  const [val, setVal] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const entries = store.data.water.filter((w) => w.date === date).sort((a, b) => b.createdAt - a.createdAt);
  const v = parseNum(val);
  const ml = Number.isFinite(v) ? waterToMl(v, profile.units) : 0;
  const ok = ml > 0 && ml <= 3000;
  const toDisplay = (m: number) => (profile.units.water === 'floz' ? String(Math.round(m / ML_PER_FLOZ)) : String(m));

  return (
    <Sheet open={open} onClose={onClose} title="Water">
      <p className="muted small">Count plain water here. Other drinks with calories belong in your food diary.</p>
      <div className="row-add">
        <Field label={`Amount (${unit})`} error={val && !ok ? 'Enter an amount up to 3 litres' : null}>
          <NumberInput value={val} onChange={setVal} suffix={unit} ariaLabel={`Water amount in ${unit}`} />
        </Field>
        <button
          className="btn btn-primary"
          disabled={!ok}
          onClick={() => {
            store.addWater(ml, date);
            setVal('');
            store.showToast(`+${displayWater(ml, profile.units)} water`);
          }}
        >
          Add
        </button>
      </div>
      <p className="list-label">Logged</p>
      {entries.length === 0 ? (
        <p className="muted small pad">No water logged for this day.</p>
      ) : (
        <ul className="plain-list">
          {entries.map((w) => (
            <li key={w.id} className="plain-row">
              {editId === w.id ? (
                <>
                  <NumberInput value={editVal} onChange={setEditVal} suffix={unit} ariaLabel="Edit amount" />
                  <button
                    className="icon-btn"
                    aria-label="Save"
                    onClick={() => {
                      const n = waterToMl(parseNum(editVal), profile.units);
                      if (n > 0 && n <= 3000) store.updateWater(w.id, n);
                      setEditId(null);
                    }}
                  >
                    <Icon name="check" />
                  </button>
                </>
              ) : (
                <>
                  <span>
                    <strong>{displayWater(w.ml, profile.units)}</strong>
                    <span className="muted small"> · {new Date(w.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                  </span>
                  <span className="row-tools">
                    <button
                      className="icon-btn sm"
                      aria-label="Edit"
                      onClick={() => {
                        setEditId(w.id);
                        setEditVal(toDisplay(w.ml));
                      }}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      className="icon-btn sm"
                      aria-label="Delete"
                      onClick={() => {
                        store.deleteWater(w.id);
                        store.showToast('Water entry removed', () => store.addWater(w.ml, w.date));
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
