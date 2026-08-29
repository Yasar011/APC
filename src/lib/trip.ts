import {
  get,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from "firebase/database";
import { db, tripPath } from "./firebase";
import { newTicketCode } from "./codes";
import { DEFAULT_FINANCE, DEFAULT_SETTINGS } from "./constants";
import { Booking, PromoCode, Ticket, TripFinance, TripSettings } from "./types";

/**
 * Every read and write this app performs, in one place.
 *
 * All of it sits under the `jawaiTrip` key. APC's movie-night and
 * attraction data shares this database but lives under different keys and
 * is never touched here.
 *
 * The shape is built for single-key lookups rather than queries: the bus
 * scanner reads one ticket by its code, which is one round trip and works
 * on a weak signal at Jawai.
 */

// ---------------------------------------------------------------- settings

export async function readSettings(): Promise<TripSettings> {
  const snap = await get(ref(db, tripPath("settings")));
  return { ...DEFAULT_SETTINGS, ...(snap.val() ?? {}) } as TripSettings;
}

/** Live settings, so the public page's seat count updates as people book. */
export function subscribeSettings(
  onChange: (settings: TripSettings) => void,
  onError?: (error: Error) => void
) {
  return onValue(
    ref(db, tripPath("settings")),
    (snap) => onChange({ ...DEFAULT_SETTINGS, ...(snap.val() ?? {}) } as TripSettings),
    (error) => onError?.(error)
  );
}

export async function saveSettings(settings: Partial<TripSettings>) {
  await update(ref(db, tripPath("settings")), { ...settings, updatedAt: Date.now() });
}

// ----------------------------------------------------------------- finance

/**
 * What a seat costs the club, kept out of `settings` because settings are
 * world-readable. Admin-only, so a denied read here just means "not an
 * admin" and the caller falls back to the default.
 */
export async function readFinance(): Promise<TripFinance> {
  try {
    const snap = await get(ref(db, tripPath("finance")));
    return { ...DEFAULT_FINANCE, ...(snap.val() ?? {}) } as TripFinance;
  } catch {
    return DEFAULT_FINANCE as TripFinance;
  }
}

export async function saveFinance(finance: Partial<TripFinance>) {
  await update(ref(db, tripPath("finance")), { ...finance, updatedAt: Date.now() });
}

// ------------------------------------------------------------------ admins

export async function readIsAdmin(uid: string): Promise<boolean> {
  const snap = await get(ref(db, tripPath("admins", uid)));
  return snap.val() === true;
}

// ---------------------------------------------------------------- bookings

function withId(id: string, value: Record<string, unknown>): Booking {
  return { ...(value as unknown as Booking), id, travellers: value.travellers as Booking["travellers"] };
}

/**
 * One active booking per account. Anything rejected or cancelled doesn't
 * count, so a student whose payment bounced can start over.
 */
export async function readMyBooking(uid: string): Promise<Booking | null> {
  const indexSnap = await get(ref(db, tripPath("bookingsByUser", uid)));
  const ids = Object.keys(indexSnap.val() ?? {});
  if (ids.length === 0) return null;

  const bookings = await Promise.all(ids.map((id) => readBooking(id)));
  const live = bookings.filter(
    (b): b is Booking => !!b && b.status !== "CANCELLED" && b.status !== "REJECTED"
  );
  const pool = live.length > 0 ? live : bookings.filter((b): b is Booking => !!b);
  return pool.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

export async function readBooking(bookingId: string): Promise<Booking | null> {
  const snap = await get(ref(db, tripPath("bookings", bookingId)));
  if (!snap.exists()) return null;
  return withId(bookingId, snap.val());
}

export async function listBookings(): Promise<Booking[]> {
  const snap = await get(ref(db, tripPath("bookings")));
  const value = (snap.val() ?? {}) as Record<string, Record<string, unknown>>;
  return Object.entries(value)
    .map(([id, data]) => withId(id, data))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Creates the booking and both of its indexes in one atomic multi-path
 * write, so a booking can never exist without being findable by its owner
 * or by the code on its QR.
 */
export async function createBooking(
  booking: Omit<Booking, "id">
): Promise<string> {
  const bookingId = push(ref(db, tripPath("bookings"))).key;
  if (!bookingId) throw new Error("Could not allocate a booking id");

  await update(ref(db), {
    [tripPath("bookings", bookingId)]: booking,
    [tripPath("bookingsByUser", booking.bookerUid, bookingId)]: true,
    [tripPath("bookingCodeIndex", booking.bookingCode)]: bookingId,
  });

  return bookingId;
}

/** Student attaches proof of payment and hands the booking to an admin. */
export async function attachPayment(
  bookingId: string,
  paymentScreenshotUrl: string,
  paymentRef: string
) {
  await update(ref(db, tripPath("bookings", bookingId)), {
    paymentScreenshotUrl,
    paymentRef,
    status: "PENDING_VERIFICATION",
    rejectionReason: null,
    updatedAt: Date.now(),
  });
}

// ----------------------------------------------------------------- tickets

/**
 * Confirming a booking issues one ticket per traveller. The whole set is
 * written in a single atomic update alongside the status change, so a
 * confirmed booking always has exactly as many tickets as it has seats.
 */
export async function confirmBooking(
  booking: Booking,
  adminUid: string,
  adminName: string
): Promise<Ticket[]> {
  const now = Date.now();
  const tickets: Ticket[] = booking.travellers.map((traveller, index) => ({
    ticketCode: newTicketCode(),
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    bookerUid: booking.bookerUid,
    travellerIndex: index,
    name: traveller.name,
    phone: traveller.phone,
    niftId: traveller.niftId,
    bloodGroup: traveller.bloodGroup,
    medicalConditions: traveller.medicalConditions || "",
    allergies: traveller.allergies || "",
    emergencyContactName: traveller.emergencyContactName,
    emergencyContactPhone: traveller.emergencyContactPhone,
    boarded: false,
    boardedAt: null,
    boardedBy: null,
    createdAt: now,
  }));

  const updates: Record<string, unknown> = {
    [tripPath("bookings", booking.id, "status")]: "CONFIRMED",
    [tripPath("bookings", booking.id, "rejectionReason")]: null,
    [tripPath("bookings", booking.id, "verifiedBy")]: adminUid,
    [tripPath("bookings", booking.id, "verifiedByName")]: adminName,
    [tripPath("bookings", booking.id, "verifiedAt")]: now,
    [tripPath("bookings", booking.id, "updatedAt")]: now,
  };
  for (const ticket of tickets) {
    updates[tripPath("tickets", ticket.ticketCode)] = ticket;
    updates[tripPath("ticketsByBooking", booking.id, ticket.ticketCode)] = true;
  }

  await update(ref(db), updates);

  // Counters are deliberately outside the atomic write: they are running
  // totals, not correctness-critical, and a transaction on each keeps them
  // right when two admins confirm at the same moment.
  await runTransaction(ref(db, tripPath("settings", "seatsBooked")), (current) =>
    (current ?? 0) + booking.seats
  );
  if (booking.pricing.discountApplied === "PROMO" && booking.pricing.promoCode) {
    await runTransaction(
      ref(db, tripPath("promoCodes", booking.pricing.promoCode, "usedCount")),
      (current) => (current ?? 0) + 1
    );
  }

  return tickets;
}

export async function rejectBooking(
  booking: Booking,
  reason: string,
  adminUid: string,
  adminName: string
) {
  await update(ref(db, tripPath("bookings", booking.id)), {
    status: "REJECTED",
    rejectionReason: reason,
    verifiedBy: adminUid,
    verifiedByName: adminName,
    verifiedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function readTicket(ticketCode: string): Promise<Ticket | null> {
  const snap = await get(ref(db, tripPath("tickets", ticketCode)));
  return snap.exists() ? (snap.val() as Ticket) : null;
}

export async function readTicketsForBooking(bookingId: string): Promise<Ticket[]> {
  const indexSnap = await get(ref(db, tripPath("ticketsByBooking", bookingId)));
  const codes = Object.keys(indexSnap.val() ?? {});
  const tickets = await Promise.all(codes.map((code) => readTicket(code)));
  return tickets
    .filter((t): t is Ticket => !!t)
    .sort((a, b) => a.travellerIndex - b.travellerIndex);
}

export async function listTickets(): Promise<Ticket[]> {
  const snap = await get(ref(db, tripPath("tickets")));
  const value = (snap.val() ?? {}) as Record<string, Ticket>;
  return Object.values(value).sort((a, b) => a.name.localeCompare(b.name));
}

/** The booking-level QR carries the booking code, not the booking id. */
export async function resolveBookingCode(bookingCode: string): Promise<string | null> {
  const snap = await get(ref(db, tripPath("bookingCodeIndex", bookingCode)));
  return snap.exists() ? (snap.val() as string) : null;
}

export async function markBoarded(ticketCode: string, adminUid: string) {
  await update(ref(db, tripPath("tickets", ticketCode)), {
    boarded: true,
    boardedAt: Date.now(),
    boardedBy: adminUid,
  });
}

// -------------------------------------------------------------- promo codes

/**
 * Read one code by key. The rules grant read on an individual code but not
 * on the parent, so a student can check a code they were given while
 * nobody can list them all.
 */
export async function readPromo(code: string): Promise<PromoCode | null> {
  const snap = await get(ref(db, tripPath("promoCodes", code)));
  return snap.exists() ? (snap.val() as PromoCode) : null;
}

export async function listPromos(): Promise<PromoCode[]> {
  const snap = await get(ref(db, tripPath("promoCodes")));
  const value = (snap.val() ?? {}) as Record<string, PromoCode>;
  return Object.values(value).sort((a, b) => b.createdAt - a.createdAt);
}

export async function savePromo(promo: PromoCode) {
  await set(ref(db, tripPath("promoCodes", promo.code)), promo);
}

export async function deletePromo(code: string) {
  await remove(ref(db, tripPath("promoCodes", code)));
}
