import { User } from "firebase/auth";
import { isNiftIdTaken } from "./trip";

/**
 * Why a booking write was refused.
 *
 * The database gives back one undifferentiated "permission denied" for
 * every rule that could have rejected the write, and guessing at which one
 * sent a student a message about their NIFT ID when the real problem was a
 * stale token — twice. So instead of guessing, each precondition is
 * checked and the one that actually failed is named.
 *
 * The important check is the token. The rules read
 * `auth.token.email_verified`, which is baked into the ID token when it is
 * minted — not `user.emailVerified`, which `reload()` updates. Verify your
 * address and the page unlocks while the token still says otherwise, and
 * nothing on screen can explain the refusal. Reading the claim back is the
 * only way to see that from the browser.
 */
export async function diagnoseBookingFailure(
  user: User,
  niftId: string
): Promise<string> {
  // Forced refresh: a cached token is exactly the state being tested for,
  // and if this call fixes it the retry below will succeed.
  let verifiedInToken: boolean | null = null;
  try {
    const token = await user.getIdTokenResult(true);
    verifiedInToken = token.claims.email_verified === true;
  } catch {
    // Offline, or the refresh itself failed. Fall through to the checks
    // that don't need the network.
  }

  if (!user.emailVerified) {
    return "Verify your email address before booking — open the link we sent you, then press “I've clicked the link”.";
  }

  if (verifiedInToken === false) {
    return "Your sign-in is out of date. Sign out, sign back in, and your seat will book.";
  }

  const taken = await isNiftIdTaken(niftId).catch(() => false);
  if (taken) {
    return `${niftId} already has a seat. If a trip lead booked it for you, ask them to link your email address and it'll appear here.`;
  }

  return "The booking was refused and we can't tell why. Send this to the trip leads and they'll sort it out.";
}
