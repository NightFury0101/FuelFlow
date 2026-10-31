// Where FuelFlow is running. The iPhone/Android app (built with Capacitor) loads the same web
// code inside a native shell; Capacitor adds `window.Capacitor` before the app's scripts run.

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

export type Platform = 'ios' | 'android' | 'web';

function cap(): CapacitorGlobal | undefined {
  return typeof window === 'undefined' ? undefined : (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True inside the App Store / Play Store app, false in a normal browser. */
export function isNativeApp(): boolean {
  try {
    return !!cap()?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** 'ios' or 'android' inside the store apps, 'web' in a browser. */
export function getPlatform(): Platform {
  if (!isNativeApp()) return 'web';
  try {
    return cap()?.getPlatform?.() === 'android' ? 'android' : 'ios';
  } catch {
    return 'ios';
  }
}

/** The app store this copy of the app came from, for wording like "charged to your Apple ID". */
export function storeName(): 'Apple' | 'Google Play' {
  return getPlatform() === 'android' ? 'Google Play' : 'Apple';
}
