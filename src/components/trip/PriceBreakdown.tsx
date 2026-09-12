"use client";

import { Tag } from "lucide-react";
import { PricingBreakdown } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Shows exactly how the total was reached. Rendered identically for the
 * student and for the admin verifying the payment, so nobody is comparing
 * different numbers.
 */
export function PriceBreakdown({
  pricing,
  className,
}: {
  pricing: PricingBreakdown;
  className?: string;
}) {
  return (
    <div className={className}>
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between text-neutral-600">
          <dt>Seat</dt>
          <dd>{rupees(pricing.subtotal)}</dd>
        </div>

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
    </div>
  );
}
