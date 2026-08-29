import {
  PricingBreakdown,
  ProfitBreakdown,
  PromoCode,
  TripFinance,
  TripSettings,
} from "./types";

/**
 * The single source of truth for what a booking costs. The booking form,
 * the student's status page and the admin verifier all call this, so a
 * discount can never be shown one way and charged another.
 *
 * Two discounts exist and they DO NOT STACK - whichever saves more wins:
 *
 *   - group: a flat amount off the whole booking once the group is full
 *     (99 off at 5 seats, so 5 x 2099 = 10,495 becomes 10,396)
 *   - promo: a flat amount or a percentage, from a code
 *
 * A tie goes to the group discount, so a promo code can never be "used up"
 * without actually saving anyone money.
 */
export function quote(
  seats: number,
  settings: Pick<TripSettings, "pricePerPerson" | "groupSize" | "groupDiscountAmount">,
  promo?: PromoCode | null
): PricingBreakdown {
  const safeSeats = Math.max(0, Math.floor(seats));
  const subtotal = settings.pricePerPerson * safeSeats;

  const groupDiscount =
    safeSeats >= settings.groupSize
      ? Math.min(settings.groupDiscountAmount, subtotal)
      : 0;

  let promoDiscount = 0;
  if (promo && promo.active) {
    const raw =
      promo.type === "FLAT" ? promo.value : Math.round((subtotal * promo.value) / 100);
    promoDiscount = Math.max(0, Math.min(raw, subtotal));
  }

  const discount = Math.max(groupDiscount, promoDiscount);
  const discountApplied =
    discount === 0 ? "NONE" : promoDiscount > groupDiscount ? "PROMO" : "GROUP";

  return {
    seats: safeSeats,
    pricePerPerson: settings.pricePerPerson,
    subtotal,
    groupDiscount,
    promoCode: discountApplied === "PROMO" && promo ? promo.code : null,
    promoDiscount,
    discountApplied,
    discount,
    total: subtotal - discount,
  };
}

/**
 * Splits a booking into what the trip costs and what the club keeps.
 *
 * The ticket price is one number to the student (2099), but it is really
 * two: the seat's actual cost (2000 - bus, stay, safari) and the club's
 * margin (99). The cost is fixed and has to be paid to suppliers whatever
 * happens, so **a discount comes out of the margin, never out of the
 * cost**. Five seats at a 199 group discount collects 10,296, of which
 * 10,000 is cost and 296 is what the club actually keeps.
 *
 * Admin-only: students never see any of this. It is computed on demand
 * from jawaiTrip/finance rather than stored on the booking, so the margin
 * cannot leak through a booking the student is allowed to read.
 */
export function profit(
  pricing: PricingBreakdown,
  finance: Pick<TripFinance, "baseCostPerPerson">
): ProfitBreakdown {
  const cost = finance.baseCostPerPerson * pricing.seats;
  const grossProfit = pricing.subtotal - cost;

  return {
    collected: pricing.total,
    cost,
    grossProfit,
    discount: pricing.discount,
    netProfit: pricing.total - cost,
  };
}

/** Why a promo code was refused, or null if it is good to use. */
export function promoRejectionReason(promo: PromoCode | null): string | null {
  if (!promo) return "That promo code doesn't exist.";
  if (!promo.active) return "That promo code is no longer active.";
  if (promo.expiresAt && promo.expiresAt < Date.now()) return "That promo code has expired.";
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    return "That promo code has been fully used.";
  }
  return null;
}
