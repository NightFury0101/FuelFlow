import { useEffect, useRef } from 'react';
import { useStore } from './store';
import { navigate } from '../router';
import { loadReminders, planReminders, REMINDER_EVENT } from './reminders';
import { applyPlan, listenForTaps, remindersSupported } from './notifications';

/**
 * Keeps the phone's scheduled reminders in step with the diary (store apps only):
 * re-plans after food or water is logged, when settings change and when the app comes back
 * to the front. Tapping a reminder opens the matching screen.
 */
export function useReminderSync(): void {
  const store = useStore();
  const supported = remindersSupported();
  const latest = useRef(store);
  latest.current = store;
  const timer = useRef<number | undefined>(undefined);
  const lastPlan = useRef('');

  const sync = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const s = latest.current;
      const profile = s.profile;
      if (!profile?.onboarded) return;
      const settings = loadReminders(profile.meals);
      const plan = planReminders({ settings, meals: profile.meals, entries: s.data.entries, water: s.data.water, waterGoalMl: profile.targets.waterMl });
      const sig = JSON.stringify(plan.map((p) => [p.id, p.at.getTime(), p.title]));
      if (sig === lastPlan.current) return;
      applyPlan(plan)
        .then(() => {
          lastPlan.current = sig;
        })
        .catch(() => undefined);
    }, 1200);
  };

  useEffect(() => {
    if (!supported) return;
    listenForTaps((route) => navigate(route));
    const onVisible = () => document.visibilityState === 'visible' && ((lastPlan.current = ''), sync());
    window.addEventListener(REMINDER_EVENT, sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(REMINDER_EVENT, sync);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  // Re-plan whenever the diary, water or meal setup changes.
  useEffect(() => {
    if (supported) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, store.data.entries, store.data.water, store.profile?.meals, store.profile?.targets.waterMl, store.profile?.onboarded]);
}
