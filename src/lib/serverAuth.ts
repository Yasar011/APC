import "server-only";

/**
 * Checking who is calling an API route, without a Firebase Admin SDK.
 *
 * Rather than keeping a second copy of the admin check here — which would
 * quietly drift out of step with the published database rules — routes read
 * what they need **as the caller**, using that person's own ID token
 * against the Realtime Database REST API. The rules already deployed do the
 * authorising, and there is exactly one definition of who may read what.
 *
 * So a route that must be admin-only reads a node only an admin may read.
 * `jawaiTrip/bookings` is the useful one: the rules grant a student read on
 * a single booking but never on the parent, so a successful read of the
 * whole node *is* proof of admin.
 */

const DB_URL =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://apc-movie-default-rtdb.firebaseio.com";

/** Confirms the token is a real, current login on this Firebase project. */
async function verifyIdToken(idToken: string): Promise<boolean> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  return response.ok;
}

/** The caller's ID token, or null if they aren't signed in. */
export async function requireSignedIn(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  const idToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) return null;
  return (await verifyIdToken(idToken)) ? idToken : null;
}

/** Reads a node as the caller, so the published rules do the authorising. */
export async function readAs<T>(path: string, idToken: string): Promise<T | null> {
  const response = await fetch(
    `${DB_URL}/${path}.json?auth=${encodeURIComponent(idToken)}`
  );
  if (!response.ok) return null;
  const value = await response.json();
  return (value ?? null) as T | null;
}
