/**
 * APC's Firebase project (`apc-movie`) — the same one behind movie night.
 *
 * Deliberately free of any Firebase SDK import, so the **server** can read
 * these values without initialising the browser SDK. That separation is not
 * cosmetic: the API routes used `process.env.NEXT_PUBLIC_FIREBASE_API_KEY`
 * directly, and since the whole point of committing the config was that
 * nobody has to set those variables, the key was `undefined` in production.
 * Every request to verify a caller's token went to
 * `...accounts:lookup?key=undefined`, failed, and came back "Unauthorized" —
 * which broke sending a confirmation email and signing a Cloudinary upload,
 * silently, for anyone who had followed the setup instructions correctly.
 *
 * These values are committed on purpose. A Firebase web config is not a
 * secret: it is compiled into the JavaScript every visitor downloads. What
 * protects the data is the database rules, never the config being hidden.
 */
const DEFAULTS = {
  apiKey: "AIzaSyCEDUyZD20PYvHMe-CX-_n2MWRvENiggd8",
  authDomain: "apc-movie.firebaseapp.com",
  databaseURL: "https://apc-movie-default-rtdb.firebaseio.com",
  projectId: "apc-movie",
  storageBucket: "apc-movie.firebasestorage.app",
  messagingSenderId: "849582804075",
  appId: "1:849582804075:web:44831ccf1309b106a2b52e",
};

/** Environment variables still win, so a throwaway project can be used. */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || DEFAULTS.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULTS.authDomain,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || DEFAULTS.databaseURL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULTS.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULTS.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    DEFAULTS.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || DEFAULTS.appId,
};
