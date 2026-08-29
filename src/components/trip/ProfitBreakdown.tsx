"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { ProfitBreakdown as Split } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Cost and profit, side by side. **Admin-only** — this never renders on a
 * page a student can reach.
 *
 * The ticket price is two numbers wearing one hat: what the seat costs to
 * run, and what the club keeps. The cost has to be paid to suppliers
 * whatever happens, so a discount comes out of the margin — which is why
 * net profit can go negative while the cost line never moves.
 */
export function ProfitBreakdown({
  split,
  seats,
  baseCostPerPerson,
  className,
}: {
  split: Split;
  seats: number;
  baseCostPerPerson: number;
  className?: string;
}) {
  const losing = split.netProfit < 0;

  return (
    <div className={className}>
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-neutral-600">Collected from students</dt>
          <dd className="font-medium tabular-nums text-neutral-900">
            {rupees(split.collected)}
          </dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-neutral-600">
            Trip cost
            <span className="ml-1 text-xs text-neutral-400">
              {rupees(baseCostPerPerson)} &times; {seats}
            </span>
          </dt>
          <dd className="font-medium tabular-nums text-neutral-900">
            &minus;{rupees(split.cost)}
          </dd>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-2.5">
          <dt className="text-neutral-600">Margin before discount</dt>
          <dd className="tabular-nums text-neutral-700">{rupees(split.grossProfit)}</dd>
        </div>

        {split.discount > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-neutral-600">Discount given</dt>
            <dd className="tabular-nums text-amber-700">
              &minus;{rupees(split.discount)}
            </dd>
          </div>
        )}

        <div
          className={`flex items-center justify-between border-t border-neutral-200 pt-2.5 text-base font-semibold ${
            losing ? "text-red-700" : "text-emerald-700"
          }`}
        >
          <dt className="flex items-center gap-1.5">
            {losing ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            Club keeps
          </dt>
          <dd className="tabular-nums">{rupees(split.netProfit)}</dd>
        </div>
      </dl>

      {losing && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          This booking is below cost — the discount is bigger than the margin on{" "}
          {seats} {seats === 1 ? "seat" : "seats"}. The club pays the difference.
        </p>
      )}
    </div>
  );
}
