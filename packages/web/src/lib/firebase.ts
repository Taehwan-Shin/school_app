import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBxeeZ-wEq8zWZsUAwQEFuXFfzIpY-7lmM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'school-app-5a636.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'school-app-5a636.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '953541048575',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:953541048575:web:f731ad4429ad3f22cc34ca',
};

export const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3');

if (import.meta.env.DEV) {
  const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8085);
    connectFunctionsEmulator(functions, host, 5001);
  } catch {
    // Already connected or running in test environment
  }
}
