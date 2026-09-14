/** Shared with the rest of APC via the top-level `roles` node. */
export type Role = "admin" | "staff" | null;

export type BookingStatus =
  | "AWAITING_PAYMENT"
  | "PENDING_VERIFICATION"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED";

export type DiscountKind = "NONE" | "PROMO";

export type PromoType = "FLAT" | "PERCENT";

/**
 * One of the club's collection accounts. Several exist because a single
 * personal UPI ID hits receiving limits well before a full bus has paid.
 */
export interface UpiAccount {
  /** Stable key, so renaming the UPI ID doesn't orphan past bookings. */
  id: string;
  upiId: string;
  payeeName: string;
  /** Optional payment QR image for this account. */
  qrUrl: string | null;
  /** Paused accounts stay on old bookings but are handed to nobody new. */
  active: boolean;
}

export interface TripSettings {
  tripName: string;
  tagline: string;
  destination: string;
  startDate: string;
  endDate: string;
  /** Per head, before any discount. One seat per booking. */
  pricePerPerson: number;
  totalSeats: number;
  seatsBooked: number;
  bookingsOpen: boolean;
  /** Students are spread across these. See src/lib/upi.ts. */
  upiAccounts: UpiAccount[];
  /** @deprecated Single-account settings from before there were several.
   *  Still read as a fallback so old settings keep working. */
  upiId?: string;
  /** @deprecated See upiId. */
  upiPayeeName?: string;
  /** @deprecated See upiId. */
  paymentQrUrl?: string | null;
  /**
   * Bank transfer details, for anyone whose UPI won't cooperate.
   *
   * Kept here rather than in the code because `settings` lives in the
   * database while the repository is public — an account number committed
   * to git is in its history permanently, and a repo is a bad place for
   * one even though it is not a secret.
   */
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  contactName: string;
  /** e.g. "APC President" - shown next to the name. */
  contactRole: string;
  contactPhone: string;
  /** Invite link for the trip group. Only ever shown to a confirmed
   *  student, so the group stays people who have actually paid. */
  whatsappGroupUrl: string;
  pickupPoint: string;
  departureTime: string;
  updatedAt: number;
}

export interface Traveller {
  name: string;
  phone: string;
  niftId: string;
  programme: string;
  semester: string;
  age: string;
  gender: string;
  bloodGroup: string;
  medicalConditions: string;
  allergies: string;
  medications: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

/**
 * Money that is never shown to students.
 *
 * Kept in its own database node (jawaiTrip/finance) rather than in
 * settings, because settings are world-readable so the public trip page
 * can show the price - and the margin is nobody's business but the club's.
 */
export interface TripFinance {
  /** What one seat actually costs the club to run: buses, stay, safari. */
  baseCostPerPerson: number;
  updatedAt: number;
}

/** Cost vs profit for one booking. Admin-only; computed, never stored. */
export interface ProfitBreakdown {
  /** What the students actually paid, after any discount. */
  collected: number;
  /** baseCostPerPerson x seats - the part that goes straight back out. */
  cost: number;
  /** Margin before any promo came off. */
  grossProfit: number;
  /** What came off the price. A discount eats the margin, not the cost. */
  discount: number;
  /** grossProfit - discount. Negative means this booking loses money. */
  netProfit: number;
}

export interface PricingBreakdown {
  /** Always 1 — a booking is one person. Kept so tickets and the roster,
   *  which count seats, keep working if that ever changes. */
  seats: number;
  pricePerPerson: number;
  subtotal: number;
  promoCode: string | null;
  promoDiscount: number;
  discountApplied: DiscountKind;
  discount: number;
  total: number;
}

/**
 * One transfer against a booking.
 *
 * A list rather than a single field because the first payment to a new UPI
 * ID is capped by the bank (commonly 2,000 in the first 24 hours), so a
 * 2,099 seat often cannot be paid in one go. See src/lib/payments.ts.
 */
/** How the money reached the club. */
export type PaymentMethod = "UPI" | "CASH" | "BANK";

export interface PaymentProof {
  /** Unique within the booking; also the key the image is stored under. */
  id: string;
  /** Cloudinary URL, STORED_IN_DB, or "" for cash handed over in person. */
  url: string;
  /** What this transfer was for, in rupees. */
  amount: number;
  /** UTR / transaction reference the student's app showed. */
  reference: string;
  /** Which of the club's UPI IDs it went to. */
  upiId: string | null;
  at: number;
  /** Defaults to UPI - the only kind that existed before cash was added. */
  method?: PaymentMethod;
  /**
   * Who recorded it, for anything an admin entered by hand.
   *
   * Cash has no bank record behind it, so the only account of who took
   * ₹2,099 off a student is this. Never optional in practice for CASH:
   * the form requires an admin to be signed in to write one.
   */
  recordedBy?: string | null;
  recordedByName?: string | null;
  /** Free text for a bank reference, "paid at the desk", and so on. */
  note?: string | null;
}

export interface Booking {
  id: string;
  /**
   * Empty string on a booking an admin made for someone who has not signed
   * in yet — see `claimEmail`. Set to their uid when they claim it.
   */
  bookerUid: string;
  /**
   * Set when a trip lead booked a seat on someone's behalf: the address
   * they must sign in with to take it over. Cleared on nothing — it stays
   * as the record of how the booking started.
   */
  claimEmail?: string | null;
  claimedAt?: number | null;
  /** Which admin entered it, for a booking nobody made themselves. */
  createdBy?: string | null;
  createdByName?: string | null;
  bookerName: string;
  bookerEmail: string;
  bookerPhone: string;
  niftId: string;
  /** Always 1. */
  seats: number;
  /** Exactly one entry — the person travelling, who is also the booker. */
  travellers: Traveller[];
  pricing: PricingBreakdown;
  /** Every transfer made against this booking. */
  payments?: Record<string, PaymentProof> | PaymentProof[];
  /** @deprecated The most recent payment's screenshot, kept in step with
   *  `payments` so bookings made before it was a list still render. */
  paymentScreenshotUrl: string | null;
  /** @deprecated See paymentScreenshotUrl. */
  paymentRef: string;
  /** Which of the club's UPI IDs this student was told to pay into. */
  payeeUpiId: string | null;
  payeeName: string | null;
  status: BookingStatus;
  rejectionReason: string | null;
  bookingCode: string;
  verifiedBy: string | null;
  verifiedByName: string | null;
  verifiedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Ticket {
  ticketCode: string;
  bookingId: string;
  bookingCode: string;
  bookerUid: string;
  travellerIndex: number;
  name: string;
  phone: string;
  niftId: string;
  bloodGroup: string;
  medicalConditions: string;
  allergies: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  boarded: boolean;
  boardedAt: number | null;
  boardedBy: string | null;
  createdAt: number;
}

export interface PromoCode {
  code: string;
  type: PromoType;
  value: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  /** Epoch ms, or null for no expiry. */
  expiresAt: number | null;
  createdAt: number;
}
