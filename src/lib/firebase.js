import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const fallbackConfig = {
  apiKey: 'AIzaSyAnvPUD8NmYUC-fA7ypMvlrfIdAngL0KF0',
  authDomain: 'cuarenta-dfbf1.firebaseapp.com',
  databaseURL: 'https://cuarenta-dfbf1-default-rtdb.firebaseio.com',
  projectId: 'cuarenta-dfbf1',
  storageBucket: 'cuarenta-dfbf1.firebasestorage.app',
  messagingSenderId: '78708075147',
  appId: '1:78708075147:web:3bffd7a9a76f0ed27fc28e',
  measurementId: 'G-QE2JKLQ686',
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || fallbackConfig.databaseURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || fallbackConfig.measurementId,
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const databaseUrl = firebaseConfig.databaseURL;
