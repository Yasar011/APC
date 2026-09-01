/** Shared with the rest of APC via the top-level `roles` node. */
export type Role = "admin" | "staff" | null;

export type BookingStatus =
  | "AWAITING_PAYMENT"
  | "PENDING_VERIFICATION"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED";

export type DiscountKind = "NONE" | "GROUP" | "PROMO";

export type PromoType = "FLAT" | "PERCENT";

export interface TripSettings {
  tripName: string;
  tagline: string;
  destination: string;
  startDate: string;
  endDate: string;
  /** Per head, before any discount. */
  pricePerPerson: number;
  /** Seats needed to earn the group discount. */
  groupSize: number;
  /** Flat amount off the WHOLE booking once groupSize is reached. */
  groupDiscountAmount: number;
  maxSeatsPerBooking: number;
  totalSeats: number;
  seatsBooked: number;
  bookingsOpen: boolean;
  upiId: string;
  upiPayeeName: string;
  paymentQrUrl: string | null;
  contactName: string;
  contactPhone: string;
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
  /** Margin before any discount came off. */
  grossProfit: number;
  /** What came off the price. Discounts eat the margin, not the cost. */
  discount: number;
  /** grossProfit - discount. Negative means this booking loses money. */
  netProfit: number;
}

export interface PricingBreakdown {
  seats: number;
  pricePerPerson: number;
  subtotal: number;
  groupDiscount: number;
  promoCode: string | null;
  promoDiscount: number;
  /** Which discount actually applied — they never stack. */
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
  seats: number;
  travellers: Traveller[];
  pricing: PricingBreakdown;
  paymentScreenshotUrl: string | null;
  paymentRef: string;
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
