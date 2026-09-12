import { Booking, PaymentMethod, PaymentProof } from "./types";

/**
 * A booking can be paid in more than one go.
 *
 * This is not a nicety. Paying a UPI ID you have never paid before is
 * capped by the bank — commonly ₹2,000 for the first 24 hours — so a
 * student trying to send ₹2,099 to the club's ID gets refused, or can only
 * push ₹2,000 through. Before this, that was a dead end: one screenshot
 * field, one amount, and a student staring at a payment their app would
 * not make.
 *
 * So a booking carries a *list* of payments. Pay what the bank allows,
 * upload it, and the page asks for the rest — the QR regenerates for the
 * balance, so the second transfer is exact. The admin sees every transfer
 * and the running total against what is owed.
 *
 * The same machinery covers a student who simply paid the wrong amount,
 * which used to be invisible until someone eyeballed a screenshot.
 */

/**
 * Payments as a sorted list.
 *
 * Stored as a record keyed by payment id, because Realtime Database turns
 * arrays into records the moment anything is deleted from the middle.
 * Both shapes are read so old bookings keep working.
 */
export function paymentList(
  booking: Pick<Booking, "payments"> | null | undefined
): PaymentProof[] {
  const raw = booking?.payments;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return list
    .filter((item): item is PaymentProof => Boolean(item && item.id))
    .sort((a, b) => a.at - b.at);
}

export interface PaymentState {
  /** What the booking costs. */
  due: number;
  /** Sum of every transfer recorded against it. */
  paid: number;
  /** Still owed. Zero once settled, never negative. */
  outstanding: number;
  /** Paid beyond the total — a refund conversation, not a rounding error. */
  overpaid: number;
  /** Enough money is in. */
  settled: boolean;
  transfers: PaymentProof[];
}

export function paymentState(booking: Booking): PaymentState {
  const transfers = paymentList(booking);
  const due = booking.pricing.total;

  // Rounded to whole rupees. Screenshots are read by eye and UPI settles in
  // paise; leaving a floating-point tail here would show a student "₹0.004
  // still to pay" and refuse to let them finish.
  const paid = Math.round(
    transfers.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  );

  const balance = due - paid;
  return {
    due,
    paid,
    outstanding: Math.max(0, balance),
    overpaid: Math.max(0, -balance),
    settled: balance <= 0,
    transfers,
  };
}

/**
 * Legacy bookings — made before payments were a list — carry a single
 * screenshot and no amount. Treat that as one transfer of the full amount,
 * which is what it was, so the totals don't read as unpaid.
 */
export function withLegacyPayment(booking: Booking): Booking {
  if (paymentList(booking).length > 0) return booking;
  if (!booking.paymentScreenshotUrl) return booking;

  const legacy: PaymentProof = {
    id: "legacy",
    url: booking.paymentScreenshotUrl,
    amount: booking.pricing.total,
    reference: booking.paymentRef || "",
    upiId: booking.payeeUpiId ?? null,
    at: booking.updatedAt || booking.createdAt,
  };
  return { ...booking, payments: { legacy } };
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  UPI: "UPI",
  CASH: "Cash",
  BANK: "Bank transfer",
};

/** Anything written before cash existed was a UPI transfer. */
export function paymentMethod(payment: PaymentProof): PaymentMethod {
  return payment.method ?? "UPI";
}

/**
 * Cash needs a name against it.
 *
 * There is no bank record behind a note handed over at a desk, so the only
 * account of where ₹2,099 went is which admin said they took it. Anything
 * else is reconcilable from a statement; this is not.
 */
export function needsCollector(payment: PaymentProof): boolean {
  return paymentMethod(payment) === "CASH" && !payment.recordedByName;
}

/** New payment id. Only has to be unique within one booking. */
export function newPaymentId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
