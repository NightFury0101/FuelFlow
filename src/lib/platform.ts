// Where FuelFlow is running. The iPhone/Android app (built with Capacitor) loads the same web
// code inside a native shell; Capacitor adds `window.Capacitor` before the app's scripts run.

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

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

/**
 * Whether the Premium screen should be shown. App stores only allow paid features sold through
 * their own in-app purchases, and plans you can't buy can get the app rejected, so the store
 * apps hide Premium until in-app purchases are added.
 */
export function showPremium(): boolean {
  return !isNativeApp();
}
