import { TripSettings, UpiAccount } from "./types";

/**
 * The club collects on several UPI IDs, because one personal ID hits
 * receiving limits long before 89 students have paid into it.
 *
 * Which ID a student sees is decided by hashing their uid, not by a counter:
 * a counter would need every client to read and write shared state, and
 * students cannot read each other's bookings. Hashing spreads them evenly,
 * costs nothing, and is stable - the same student always sees the same ID,
 * so reopening the page doesn't move their payment target mid-transfer.
 */
function hash(value: string) {
  let result = 0;
  for (let i = 0; i < value.length; i++) {
    result = (result * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(result);
}

/**
 * Settings may hold the accounts as an array or, once Realtime Database has
 * round-tripped a deletion, as an object with gaps. Older settings saved
 * before there were several accounts hold a single `upiId` instead. This
 * flattens all three into one list so nothing else has to care.
 */
export function upiAccounts(settings: Partial<TripSettings>): UpiAccount[] {
  // Typed as an array, but Realtime Database hands back an object with
  // numeric keys once an entry has been removed, so normalise both.
  const raw = settings.upiAccounts as
    | UpiAccount[]
    | Record<string, UpiAccount>
    | undefined;
  const list: UpiAccount[] = raw ? Object.values(raw).filter(Boolean) : [];

  if (list.length === 0 && settings.upiId) {
    // Legacy single-account settings, still perfectly valid.
    return [
      {
        id: "legacy",
        upiId: settings.upiId,
        payeeName: settings.upiPayeeName ?? "",
        qrUrl: settings.paymentQrUrl ?? null,
        active: true,
      },
    ];
  }

  return list;
}

export function activeUpiAccounts(settings: Partial<TripSettings>): UpiAccount[] {
  return upiAccounts(settings).filter((account) => account.active !== false);
}

/**
 * The account this person should pay into. Stable per uid, so a student who
 * refreshes mid-payment is not sent to a different ID.
 */
export function pickUpiForUser(
  settings: Partial<TripSettings>,
  uid: string
): UpiAccount | null {
  const accounts = activeUpiAccounts(settings);
  if (accounts.length === 0) return null;
  return accounts[hash(uid) % accounts.length];
}

/**
 * The next account along, for the "this one isn't working" button. Wraps
 * around, and returns the same account when there is only one, so the
 * button can be hidden rather than doing nothing.
 */
export function nextUpiAccount(
  settings: Partial<TripSettings>,
  currentUpiId: string | null
): UpiAccount | null {
  const accounts = activeUpiAccounts(settings);
  if (accounts.length === 0) return null;

  const index = accounts.findIndex((account) => account.upiId === currentUpiId);
  return accounts[(index + 1) % accounts.length];
}

/** Looks an account up by the UPI ID recorded on a booking. */
export function findUpiAccount(
  settings: Partial<TripSettings>,
  upiId: string | null
): UpiAccount | null {
  if (!upiId) return null;
  return upiAccounts(settings).find((account) => account.upiId === upiId) ?? null;
}

export function newUpiAccountId() {
  return `upi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * A standard UPI payment link: `upi://pay?pa=...&am=...`.
 *
 * Rendering this as a QR means the club never has to upload a QR image per
 * account, and — more usefully — the **amount and a note are baked in**, so
 * the student cannot fat-finger the figure and the booking code lands in
 * the payer's statement, which is what makes reconciling 89 payments
 * bearable.
 *
 * Built by hand rather than with URLSearchParams, which encodes spaces as
 * "+" — several UPI apps then show the payee name with plus signs in it.
 */
export function upiPayUri(
  account: Pick<UpiAccount, "upiId" | "payeeName">,
  amount: number,
  note?: string
) {
  return `upi://pay?${payParams(account, amount, note)}`;
}

function payParams(
  account: Pick<UpiAccount, "upiId" | "payeeName">,
  amount: number,
  note?: string
) {
  const params = [
    `pa=${encodeURIComponent(account.upiId)}`,
    `pn=${encodeURIComponent(account.payeeName || "APC Club")}`,
    `cu=INR`,
  ];
  if (amount > 0) params.push(`am=${amount.toFixed(2)}`);
  if (note) params.push(`tn=${encodeURIComponent(note)}`);
  return params.join("&");
}
