import { firebaseConfig, type FirebaseWebConfig } from '../../firebaseConfig';

const DEV_KEY = 'fuelflow:dev-firebase';

/**
 * The Firebase project to use, or null when accounts aren't set up.
 * On localhost only, a config supplied through localStorage (for testing) takes precedence.
 */
export function getFirebaseConfig(): FirebaseWebConfig | null {
  try {
    if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      const raw = localStorage.getItem(DEV_KEY);
      if (raw) {
        const c = JSON.parse(raw) as FirebaseWebConfig;
        if (c.apiKey && c.projectId) return c;
      }
    }
  } catch {
    /* ignore */
  }
  if (firebaseConfig?.apiKey && firebaseConfig.projectId) return firebaseConfig;
  return null;
}

export function cloudEnabled(): boolean {
  return getFirebaseConfig() !== null;
}
