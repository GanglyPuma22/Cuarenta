import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const liveConfig = {
  apiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  databaseURL: clean(import.meta.env.VITE_FIREBASE_DATABASE_URL),
  projectId: clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: clean(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
};

const requiredLiveFields = [
  'apiKey',
  'authDomain',
  'databaseURL',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingLiveFields = requiredLiveFields.filter((field) => !liveConfig[field]);
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
const emulatorHost = clean(import.meta.env.VITE_FIREBASE_EMULATOR_HOST) || '127.0.0.1';
const emulatorPort = Number(import.meta.env.VITE_FIREBASE_EMULATOR_PORT || 9000);
const authEmulatorHost = clean(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST) || emulatorHost;
const authEmulatorPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || 9099);

let app = null;
let auth = null;
let db = null;
let databaseUrl = '';
let firebaseMode = 'unconfigured';
let firebaseConfigError = '';

if (useEmulator) {
  const projectId = liveConfig.projectId || 'cuarenta-local';
  app = initializeApp({
    apiKey: liveConfig.apiKey || 'demo-api-key',
    authDomain: liveConfig.authDomain || `${projectId}.local`,
    databaseURL: liveConfig.databaseURL || `http://${emulatorHost}:${emulatorPort}?ns=${projectId}-default-rtdb`,
    projectId,
    storageBucket: liveConfig.storageBucket || `${projectId}.appspot.com`,
    messagingSenderId: liveConfig.messagingSenderId || '000000000000',
    appId: liveConfig.appId || `1:000000000000:web:${projectId}`,
    measurementId: liveConfig.measurementId || undefined,
  });
  auth = getAuth(app);
  db = getDatabase(app);
  try {
    connectAuthEmulator(auth, `http://${authEmulatorHost}:${authEmulatorPort}`, { disableWarnings: true });
  } catch {
    // Vite HMR can re-run this module after the auth instance is already connected.
  }
  try {
    connectDatabaseEmulator(db, emulatorHost, emulatorPort);
  } catch {
    // Vite HMR can re-run this module after the database instance is already connected.
  }
  databaseUrl = `http://${emulatorHost}:${emulatorPort}?ns=${projectId}-default-rtdb`;
  firebaseMode = 'emulator';
} else if (!missingLiveFields.length) {
  app = initializeApp(liveConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  databaseUrl = liveConfig.databaseURL;
  firebaseMode = 'live';
} else {
  firebaseConfigError = `Firebase is not configured. Copy .env.example and either point the app at the auth/database emulators or provide the VITE_FIREBASE_* web config for a project. Missing: ${missingLiveFields.join(', ')}`;
}

export { app, auth, db, databaseUrl, firebaseConfigError, firebaseMode };
export const hasFirebase = Boolean(db && auth);
