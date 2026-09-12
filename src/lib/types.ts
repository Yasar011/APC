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

export interface Booking {
  id: string;
  bookerUid: string;
  bookerName: string;
  bookerEmail: string;
  bookerPhone: string;
  niftId: string;
  /** Always 1. */
  seats: number;
  /** Exactly one entry — the person travelling, who is also the booker. */
  travellers: Traveller[];
  pricing: PricingBreakdown;
  paymentScreenshotUrl: string | null;
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
