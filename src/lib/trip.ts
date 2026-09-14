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
import { emailKey, newBookingCode, newTicketCode, niftIdKey } from "./codes";
import { DEFAULT_FINANCE, DEFAULT_SETTINGS, FOUNDER_ADMIN_UID } from "./constants";
import {
  Booking,
  PaymentProof,
  PromoCode,
  Role,
  Ticket,
  TripFinance,
  TripSettings,
} from "./types";

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

// ------------------------------------------------------------------- roles

/**
 * Roles come from APC's existing `roles` node - the same one movie night
 * uses - rather than a second list this app would own. Whoever is already
 * an admin there is an admin here, with nothing to set up.
 *
 * Note this reads `roles`, NOT `jawaiTrip/roles`: it is shared, org-wide
 * data that this app only ever reads.
 */
export async function readRole(uid: string): Promise<Role> {
  if (uid === FOUNDER_ADMIN_UID) return "admin";
  try {
    const snap = await get(ref(db, `roles/${uid}`));
    const value = snap.val();
    return value === "admin" || value === "staff" ? value : null;
  } catch {
    // The rules let someone read only their own role; a denial here just
    // means "no role", and must never block sign-in.
    return null;
  }
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
 * One seat per NIFT ID. Checked here for a clear error message, and enforced
 * by the rules, which only let an unclaimed key be written - so two people
 * submitting the same ID at the same moment cannot both get through.
 */
export async function isNiftIdTaken(niftId: string): Promise<boolean> {
  const snap = await get(ref(db, tripPath("niftIdIndex", niftIdKey(niftId))));
  return snap.exists();
}

/**
 * Creates the booking and all three of its indexes in one atomic multi-path
 * write: a booking can never exist without being findable by its owner and
 * by the code on its QR, and its NIFT ID is claimed in the same breath.
 *
 * If the ID is already claimed the whole write is rejected by the rules, so
 * a duplicate booking cannot be half-created.
 */
export async function createBooking(
  booking: Omit<Booking, "id">
): Promise<string> {
  const bookingId = push(ref(db, tripPath("bookings"))).key;
  if (!bookingId) throw new Error("Could not allocate a booking id");

  const updates: Record<string, unknown> = {
    [tripPath("bookings", bookingId)]: booking,
    [tripPath("bookingCodeIndex", booking.bookingCode)]: bookingId,
    [tripPath("niftIdIndex", niftIdKey(booking.niftId))]: bookingId,
  };

  // A booking an admin made for someone who hasn't signed in yet has no uid
  // to index against; it is found by email until they claim it.
  if (booking.bookerUid) {
    updates[tripPath("bookingsByUser", booking.bookerUid, bookingId)] = true;
  }
  if (booking.claimEmail) {
    updates[tripPath("claimIndex", emailKey(booking.claimEmail))] = bookingId;
  }

  await update(ref(db), updates);

  return bookingId;
}

/**
 * A seat a trip lead entered on someone's behalf.
 *
 * Students pay in person, message a lead, or simply never get round to the
 * site — and a club that cannot write those down ends up keeping the real
 * list somewhere else, which is how a bus leaves with a name nobody
 * checked. So the booking is created now, against their email address, and
 * they take it over when they sign in.
 *
 * Only the essentials are asked for. Blood group, allergies and emergency
 * contact are the student's to fill in once they claim it — a lead
 * guessing at a blood group is worse than a blank.
 */
export async function createManualBooking(input: {
  /** Optional. Often a lead has a name and a phone and nothing else. */
  email?: string;
  name: string;
  niftId: string;
  phone: string;
  pricing: Booking["pricing"];
  adminUid: string;
  adminName: string;
}): Promise<{ bookingId: string; bookingCode: string }> {
  const now = Date.now();
  const bookingCode = newBookingCode();
  const email = input.email?.trim().toLowerCase() || "";

  const booking: Omit<Booking, "id"> = {
    bookerUid: "",
    claimEmail: email || null,
    claimedAt: null,
    createdBy: input.adminUid,
    createdByName: input.adminName,
    bookerName: input.name.trim(),
    bookerEmail: email,
    bookerPhone: input.phone.trim(),
    niftId: input.niftId.trim(),
    seats: 1,
    travellers: [
      {
        name: input.name.trim(),
        phone: input.phone.trim(),
        niftId: input.niftId.trim(),
        programme: "",
        semester: "",
        age: "",
        gender: "",
        bloodGroup: "",
        medicalConditions: "",
        allergies: "",
        medications: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        emergencyContactRelation: "",
      },
    ],
    pricing: input.pricing,
    paymentScreenshotUrl: null,
    paymentRef: "",
    payeeUpiId: null,
    payeeName: null,
    status: "AWAITING_PAYMENT",
    rejectionReason: null,
    bookingCode,
    verifiedBy: null,
    verifiedByName: null,
    verifiedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const bookingId = await createBooking(booking);
  return { bookingId, bookingCode };
}

/**
 * Corrects what a transfer was actually worth.
 *
 * Students no longer type the amount — the page records what it asked for
 * and the admin sets the truth from the screenshot. Lowering it makes the
 * balance reappear on the student's page, so a short payment turns back
 * into an outstanding one rather than a silently under-paid seat.
 */
export async function setPaymentAmount(
  bookingId: string,
  paymentId: string,
  amount: number
) {
  await update(ref(db, tripPath("bookings", bookingId)), {
    [`payments/${paymentId}/amount`]: Math.max(0, Math.round(amount)),
    updatedAt: Date.now(),
  });
}

/**
 * Attaches an email address to a seat booked without one.
 *
 * The common case: a lead writes someone down from a name and a phone
 * number at a stall, and the address turns up later. Until it does the
 * booking simply cannot be claimed — there is nothing to match a sign-in
 * against — so this is what turns it into a seat somebody can take over.
 *
 * Changing an address moves the index entry rather than leaving the old
 * one pointing at this booking, which would let whoever owns that first
 * address claim a seat that is no longer theirs.
 */
export async function setClaimEmail(booking: Booking, email: string) {
  const clean = email.trim().toLowerCase();
  if (!clean) throw new Error("Give an email address.");

  const updates: Record<string, unknown> = {
    [tripPath("bookings", booking.id, "claimEmail")]: clean,
    [tripPath("bookings", booking.id, "bookerEmail")]: clean,
    [tripPath("bookings", booking.id, "updatedAt")]: Date.now(),
    [tripPath("claimIndex", emailKey(clean))]: booking.id,
  };
  if (booking.claimEmail && booking.claimEmail !== clean) {
    updates[tripPath("claimIndex", emailKey(booking.claimEmail))] = null;
  }

  await update(ref(db), updates);
}

/**
 * "Has someone already booked a seat for me?"
 *
 * A single key lookup on the email index — a student cannot list bookings,
 * so this is the only way they can find one made in their name.
 */
export async function findClaimableBooking(
  email: string
): Promise<Booking | null> {
  const snap = await get(ref(db, tripPath("claimIndex", emailKey(email))));
  if (!snap.exists()) return null;

  const booking = await readBooking(snap.val() as string);
  // Already taken over, by them or by anyone: nothing left to claim.
  return booking && !booking.bookerUid ? booking : null;
}

/** Takes over a booking a lead created. The rules check the email matches. */
export async function claimBooking(booking: Booking, uid: string) {
  const now = Date.now();
  await update(ref(db), {
    [tripPath("bookings", booking.id, "bookerUid")]: uid,
    [tripPath("bookings", booking.id, "claimedAt")]: now,
    [tripPath("bookings", booking.id, "updatedAt")]: now,
    [tripPath("bookingsByUser", uid, booking.id)]: true,
  });
}

/**
 * Records which of the club's UPI IDs the student is actually paying into,
 * written as soon as they switch rather than at submit - if they pay and
 * then close the tab, the booking still says where the money went.
 */
export async function setBookingPayee(
  bookingId: string,
  payeeUpiId: string,
  payeeName: string
) {
  await update(ref(db, tripPath("bookings", bookingId)), {
    payeeUpiId,
    payeeName,
    updatedAt: Date.now(),
  });
}

/**
 * Records one transfer against a booking and hands it to an admin.
 *
 * Appends rather than replaces: the first payment to a new UPI ID is
 * capped by the bank, so a seat is often paid in two goes and both
 * screenshots have to survive. The legacy single-screenshot fields are
 * kept pointing at the most recent transfer, so anything still reading
 * them shows the newest proof rather than nothing.
 */
export async function addPayment(bookingId: string, payment: PaymentProof) {
  const updates: Record<string, unknown> = {
    [`payments/${payment.id}`]: payment,
    paymentRef: payment.reference,
    status: "PENDING_VERIFICATION",
    rejectionReason: null,
    updatedAt: Date.now(),
  };
  // Cash has no screenshot. Leave the legacy field pointing at the last
  // image there actually was rather than blanking it - an admin looking at
  // an older transfer's proof should not lose it because the balance was
  // later settled in cash.
  if (payment.url) updates.paymentScreenshotUrl = payment.url;

  await update(ref(db, tripPath("bookings", bookingId)), updates);
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
