/**
 * Unambiguous alphabet - no O/0 or I/1, so a code read off a phone screen
 * and typed into the manual-entry box at the bus can't be mistyped into a
 * different valid code.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * The QR payload for one traveller, and the database key its ticket is
 * stored under - so scanning is a single key lookup rather than a query.
 * 10 characters of a 32-symbol alphabet is ~50 bits: not guessable.
 */
export function newTicketCode() {
  return randomCode(10);
}

/** Shown to the student and encoded in the booking-level QR. */
export function newBookingCode() {
  return `JW${randomCode(6)}`;
}

/** Codes are stored and compared uppercased, with spaces stripped. */
export function normalisePromoCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Realtime Database keys cannot contain . $ # [ ] / or control characters.
 * Promo codes become keys, so they are validated before use.
 */
export function isValidKey(value: string) {
  return value.length > 0 && !/[.$#\[\]/]/.test(value);
}
