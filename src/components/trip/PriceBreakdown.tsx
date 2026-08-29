"use client";

import { Tag, Users } from "lucide-react";
import { PricingBreakdown } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Shows exactly how the total was reached — including which discount was
 * applied and, when both were available, that the other one was the smaller
 * of the two. Rendered identically for the student and for the admin
 * verifying the payment, so nobody is comparing different numbers.
 */
export function PriceBreakdown({
  pricing,
  groupSize,
  className,
}: {
  pricing: PricingBreakdown;
  groupSize: number;
  className?: string;
}) {
  const bothAvailable = pricing.groupDiscount > 0 && pricing.promoDiscount > 0;

  return (
    <div className={className}>
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between text-neutral-600">
          <dt>
            {rupees(pricing.pricePerPerson)} &times; {pricing.seats}{" "}
            {pricing.seats === 1 ? "seat" : "seats"}
          </dt>
          <dd>{rupees(pricing.subtotal)}</dd>
        </div>

        {pricing.discountApplied === "GROUP" && (
          <div className="flex items-center justify-between text-emerald-700">
            <dt className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Group of {groupSize} discount
            </dt>
            <dd>&minus;{rupees(pricing.groupDiscount)}</dd>
          </div>
        )}

        {pricing.discountApplied === "PROMO" && (
          <div className="flex items-center justify-between text-emerald-700">
            <dt className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Promo {pricing.promoCode}
            </dt>
            <dd>&minus;{rupees(pricing.promoDiscount)}</dd>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-neutral-200 pt-2.5 text-base font-semibold text-neutral-900">
          <dt>Total</dt>
          <dd>{rupees(pricing.total)}</dd>
        </div>
      </dl>

      {bothAvailable && (
        <p className="mt-3 text-xs text-neutral-500">
          You qualified for both the group discount and a promo code. They don&apos;t stack,
          so the bigger one was applied —{" "}
          {pricing.discountApplied === "GROUP"
            ? `the group discount saves you ${rupees(
                pricing.groupDiscount - pricing.promoDiscount
              )} more.`
            : `the promo saves you ${rupees(
                pricing.promoDiscount - pricing.groupDiscount
              )} more.`}
        </p>
      )}
    </div>
  );
}
