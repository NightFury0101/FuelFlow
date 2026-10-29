import { useState } from 'react';
import type { FoodEntry } from '../lib/types';
import { useStore } from '../lib/store';
import { Sheet } from './ui';
import { ServingEditor, type ServingChoice } from './ServingEditor';
import { Icon } from './Icon';
import { todayKey } from '../lib/date';

export function EntryEditor({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  return (
    <Sheet open={!!entry} onClose={onClose} title="Edit entry">
      {entry && <Inner key={entry.id} entry={entry} onClose={onClose} />}
    </Sheet>
  );
}

function Inner({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const store = useStore();
  const profile = store.profile!;
  const [choice, setChoice] = useState<ServingChoice | null>({ servingLabel: entry.servingLabel, quantity: entry.quantity, amount: entry.amount, meal: entry.meal });

  const save = () => {
    if (!choice) return;
    store.updateEntry(entry.id, { meal: choice.meal, servingLabel: choice.servingLabel, quantity: choice.quantity, amount: choice.amount });
    store.showToast('Entry updated');
    onClose();
  };
  const remove = () => {
    store.deleteEntry(entry.id);
    store.showToast(`Removed ${entry.food.name}`, () => store.restoreEntries([entry]));
    onClose();
  };
  const duplicate = (date: string) => {
    const [e] = store.addEntries([{ date, meal: choice?.meal ?? entry.meal, food: entry.food, servingLabel: entry.servingLabel, quantity: entry.quantity, amount: entry.amount, aiEstimated: entry.aiEstimated }]);
    store.showToast(date === entry.date ? 'Duplicated' : 'Copied to today', () => store.deleteEntry(e.id));
    onClose();
  };

  return (
    <div>
      {entry.aiEstimated && (
        <p className="notice">
          <Icon name="sparkles" size={15} /> This came from a photo estimate. Adjust the amount if it looks off.
        </p>
      )}
      <ServingEditor
        food={entry.food}
        meals={profile.meals}
        initial={{ servingLabel: entry.servingLabel, quantity: entry.quantity, amount: entry.amount, meal: entry.meal }}
        favorite={entry.food.source !== 'manual' && entry.food.source !== 'ai-estimate' ? store.isFavorite(entry.food.id) : undefined}
        onToggleFavorite={entry.food.source !== 'manual' && entry.food.source !== 'ai-estimate' ? () => store.toggleFavorite(entry.food) : undefined}
        onChange={setChoice}
      />
      <div className="entry-tools">
        <button className="chip" onClick={() => duplicate(entry.date)}>
          <Icon name="copy" size={15} /> Duplicate
        </button>
        {entry.date !== todayKey() && (
          <button className="chip" onClick={() => duplicate(todayKey())}>
            <Icon name="copy" size={15} /> Copy to today
          </button>
        )}
      </div>
      <div className="sheet-actions">
        <button className="btn btn-ghost danger" onClick={remove}>
          <Icon name="trash" size={16} /> Delete
        </button>
        <button className="btn btn-primary grow" disabled={!choice} onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
