import { PricingBreakdown, PromoCode, TripSettings } from "./types";

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
