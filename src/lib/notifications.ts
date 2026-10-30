// Talks to the phone's notification system in the store apps, through Capacitor's
// LocalNotifications plugin (installed natively by scripts/ios-prepare.sh). We call the native
// bridge directly so the website doesn't need to ship any Capacitor code.

import { isNativeApp } from './platform';
import type { PlannedReminder } from './reminders';

const PLUGIN = 'LocalNotifications';

type Bridge = {
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
  nativeCallback?: (plugin: string, method: string, options: unknown, cb: (data: unknown, err?: unknown) => void) => string;
  PluginHeaders?: Array<{ name: string }>;
};

function bridge(): Bridge | undefined {
  return (window as Window & { Capacitor?: Bridge }).Capacitor;
}

function call<T>(method: string, options?: unknown): Promise<T> {
  const b = bridge();
  if (!b?.nativePromise) return Promise.reject(new Error('Notifications are only available in the app.'));
  return b.nativePromise(PLUGIN, method, options ?? {}) as Promise<T>;
}

/** True when this is the store app and its notification plugin is installed. */
export function remindersSupported(): boolean {
  if (!isNativeApp()) return false;
  const b = bridge();
  if (!b?.nativePromise) return false;
  // PluginHeaders lists the native plugins compiled into the app (absent in older bridges).
  return !b.PluginHeaders || b.PluginHeaders.some((p) => p.name === PLUGIN);
}

export type Permission = 'granted' | 'denied' | 'prompt';

export async function checkPermission(): Promise<Permission> {
  const r = await call<{ display?: string }>('checkPermissions');
  return r?.display === 'granted' ? 'granted' : r?.display === 'denied' ? 'denied' : 'prompt';
}

export async function requestPermission(): Promise<Permission> {
  const r = await call<{ display?: string }>('requestPermissions');
  return r?.display === 'granted' ? 'granted' : r?.display === 'denied' ? 'denied' : 'prompt';
}

/** Replace every pending FuelFlow reminder with this plan. */
export async function applyPlan(plan: PlannedReminder[]): Promise<void> {
  const pending = await call<{ notifications?: Array<{ id: number | string }> }>('getPending').catch(() => ({ notifications: [] }));
  const ids = (pending?.notifications ?? []).map((n) => ({ id: Number(n.id) })).filter((n) => Number.isFinite(n.id));
  if (ids.length) await call('cancel', { notifications: ids });
  if (!plan.length) return;
  await call('schedule', {
    notifications: plan.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      // A real Date object: the iPhone bridge passes it through as a native date.
      schedule: { at: p.at, allowWhileIdle: true },
      extra: { route: p.route },
    })),
  });
}

/** Run `onOpen(route)` when someone taps a reminder. Returns nothing: lives as long as the app. */
export function listenForTaps(onOpen: (route: string) => void): void {
  const b = bridge();
  if (!b?.nativeCallback) return;
  try {
    b.nativeCallback(PLUGIN, 'addListener', { eventName: 'localNotificationActionPerformed' }, (data) => {
      const route = (data as { notification?: { extra?: { route?: unknown } } })?.notification?.extra?.route;
      if (typeof route === 'string' && route.startsWith('/')) onOpen(route);
    });
  } catch {
    /* plugin missing — tapping just opens the app */
  }
}
