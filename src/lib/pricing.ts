import {
  PricingBreakdown,
  ProfitBreakdown,
  PromoCode,
  TripFinance,
  TripSettings,
} from "./types";

/**
 * What a booking costs. One seat per booking, so this is the ticket price
 * less a promo code if one was used.
 *
 * There was a group discount here - 199 off when five people booked
 * together - but bookings are one person now, so a "group" cannot exist and
 * the discount went with it. Promo codes are the only discount left.
 *
 * Every screen that shows a price calls this: the booking form, the
 * student's booking page and the admin verifier. Nobody can be shown one
 * number and charged another.
 */
export function quote(
  settings: Pick<TripSettings, "pricePerPerson">,
  promo?: PromoCode | null
): PricingBreakdown {
  const subtotal = settings.pricePerPerson;

  let promoDiscount = 0;
  if (promo && promo.active) {
    const raw =
      promo.type === "FLAT" ? promo.value : Math.round((subtotal * promo.value) / 100);
    promoDiscount = Math.max(0, Math.min(raw, subtotal));
  }

  return {
    seats: 1,
    pricePerPerson: settings.pricePerPerson,
    subtotal,
    promoCode: promoDiscount > 0 && promo ? promo.code : null,
    promoDiscount,
    discountApplied: promoDiscount > 0 ? "PROMO" : "NONE",
    discount: promoDiscount,
    total: subtotal - promoDiscount,
  };
}

/**
 * Splits a booking into what the trip costs and what the club keeps.
 *
 * The ticket price is one number to the student (2099), but it is really
 * two: the seat's actual cost (2000 - bus, food, safari) and the club's
 * margin (99). The cost is fixed and has to be paid to suppliers whatever
 * happens, so **a discount comes out of the margin, never out of the
 * cost**. A promo bigger than 99 therefore puts the booking below cost, and
 * netProfit goes negative to say so.
 *
 * Admin-only: students never see any of this. It is computed on demand from
 * jawaiTrip/finance rather than stored on the booking, so the margin cannot
 * leak through a booking the student is allowed to read.
 */
export function profit(
  pricing: PricingBreakdown,
  finance: Pick<TripFinance, "baseCostPerPerson">
): ProfitBreakdown {
  const cost = finance.baseCostPerPerson * pricing.seats;

  return {
    collected: pricing.total,
    cost,
    grossProfit: pricing.subtotal - cost,
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
