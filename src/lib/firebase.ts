import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { firebaseConfig } from "./firebaseConfig";
import { getStorage } from "firebase/storage";

/**
 * APC's Firebase project (`apc-movie`) — the same one behind movie night, so
 * students sign in with the accounts they already have.
 *
 * These values are committed on purpose. A Firebase web config is not a
 * secret: it is compiled into the JavaScript every visitor downloads, so
 * anyone who opens the site can already read it. What protects the data is
 * the Realtime Database and Storage rules, never the config being hidden.
 * Committing it means a fresh clone runs with no setup, and Vercel needs no
 * environment variables.
 *
 * Environment variables still win where they are set, so a throwaway
 * Firebase project can be pointed at for testing without touching code.
 */
const config = firebaseConfig;

/**
 * True in normal use, now that the config ships with the code. Kept as a
 * guard so that blanking the values out still degrades into a readable setup
 * banner rather than an `auth/invalid-api-key` crash during the production
 * build. See <SetupNotice /> in the root layout.
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
