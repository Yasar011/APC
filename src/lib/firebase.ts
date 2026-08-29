import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

/**
 * APC's existing Firebase project — the same one behind movie night and
 * attractions. Every value comes from the environment; nothing is hardcoded,
 * so this repo can be public.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Whether real credentials are present. `getAuth()` throws
 * `auth/invalid-api-key` on an empty key, which would crash the production
 * build during prerendering — so unconfigured builds fall back to a
 * syntactically valid placeholder and the app shows a setup screen instead
 * of a stack trace. See <FirebaseNotConfigured /> in the root layout.
 */
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.databaseURL && config.projectId
);

const resolved = isFirebaseConfigured
  ? config
  : {
      ...config,
      apiKey: "not-configured",
      authDomain: "not-configured.firebaseapp.com",
      databaseURL: "https://not-configured.firebaseio.com",
      projectId: "not-configured",
      appId: "1:0:web:0",
    };

export const firebaseApp = getApps().length ? getApp() : initializeApp(resolved);
export const auth = getAuth(firebaseApp);
export const db = getDatabase(firebaseApp);
export const storage = getStorage(firebaseApp);

/**
 * Root key for everything this app owns. APC's movie-night and attraction
 * data lives elsewhere in the same tree and is never read or written here.
 */
export const TRIP_ROOT = "jawaiTrip";

export function tripPath(...segments: (string | number)[]) {
  return [TRIP_ROOT, ...segments].join("/");
}
