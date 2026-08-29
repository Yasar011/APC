import { BookingStatus } from "./types";

export const BLOOD_GROUPS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Don't know",
];

export const GENDERS = ["Female", "Male", "Other", "Prefer not to say"];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PENDING_VERIFICATION: "Waiting for approval",
  CONFIRMED: "Confirmed",
  REJECTED: "Payment rejected",
  CANCELLED: "Cancelled",
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  AWAITING_PAYMENT: "bg-neutral-100 text-neutral-700",
  PENDING_VERIFICATION: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-neutral-200 text-neutral-600",
};

/**
 * What a seat costs the club to run. Admin-only - lives in jawaiTrip/finance,
 * not in the world-readable settings node.
 */
export const DEFAULT_FINANCE = {
  baseCostPerPerson: 2000,
  updatedAt: 0,
};

/** Used only until an admin saves real settings to the database. */
export const DEFAULT_SETTINGS = {
  tripName: "Jawai Safari",
  tagline: "Leopard country, granite hills, and a day off campus.",
  destination: "Jawai Bandh, Pali, Rajasthan",
  startDate: "",
  endDate: "",
  pricePerPerson: 2099,
  groupSize: 5,
  groupDiscountAmount: 199,
  maxSeatsPerBooking: 5,
  totalSeats: 89,
  seatsBooked: 0,
  bookingsOpen: true,
  upiId: "",
  upiPayeeName: "APC Club",
  paymentQrUrl: null,
  contactName: "",
  contactPhone: "",
  pickupPoint: "NIFT Jodhpur main gate",
  departureTime: "",
  updatedAt: 0,
};
