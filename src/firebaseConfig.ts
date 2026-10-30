// Firebase web config — paste the values from:
// Firebase console → Project settings → General → Your apps → Web app → "firebaseConfig".
//
// These values are PUBLIC by design (they identify the project, they are not secrets).
// Who can read or write what is enforced by the Firestore security rules in /firestore.rules.
// Never put a service-account key or any "private_key" here.
//
// While this is null, FuelFlow works exactly as before: everything stays on the device.

export interface FirebaseWebConfig {
  apiKey: string;
  projectId: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export const firebaseConfig: FirebaseWebConfig | null = null;
