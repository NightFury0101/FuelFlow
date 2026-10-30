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

export const firebaseConfig: FirebaseWebConfig | null = {
  apiKey: 'AIzaSyDKQW0OPdIwbtW4dDThQyydNmDAlTI43RY',
  authDomain: 'fuelflow-30262.firebaseapp.com',
  projectId: 'fuelflow-30262',
  storageBucket: 'fuelflow-30262.firebasestorage.app',
  messagingSenderId: '807509373114',
  appId: '1:807509373114:web:2df47b3d775f4e279ed283',
};
