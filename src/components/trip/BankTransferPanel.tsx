"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { TripSettings } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Paying by bank transfer instead.
 *
 * UPI refuses people for reasons the club cannot do anything about — a
 * daily limit, a bank outage, an app that will not move more than ₹2,000
 * in one go. A bank transfer has none of those ceilings, so it is the way
 * out when UPI has said no.
 *
 * Shown by the method tabs in <PaymentForm />, which is why it no longer
 * folds itself away: one method is visible at a time and the choice is
 * made above it, rather than two payment methods competing on one screen.
 */
export function BankTransferPanel({
  settings,
  amount,
  note,
}: {
  settings: TripSettings;
  amount: number;
  /** The booking code — it has to travel in the transfer's remarks. */
  note?: string;
}) {
  const account = settings.bankAccountNumber?.trim();
  const ifsc = settings.bankIfsc?.trim();
  const name = settings.bankAccountName?.trim();

  if (!account || !ifsc) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
        Bank details haven&apos;t been added yet. Pay by UPI, or message the
        trip leads.
      </p>
    );
  }

  const rows: [string, string][] = [
    ["Account name", name || "—"],
    ["Account number", account],
    ["IFSC", ifsc],
  ];
  if (settings.bankName?.trim()) rows.push(["Bank", settings.bankName.trim()]);
  if (note) rows.push(["Remarks", note]);

  function copyAll() {
    const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
    navigator.clipboard?.writeText(text);
    toast.success("Bank details copied");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs uppercase tracking-wider text-neutral-500">
          Transfer {rupees(amount)} to this account
        </p>
        <dl className="mt-3 space-y-2.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-xs text-neutral-500">{label}</dt>
              <dd className="text-right font-mono text-sm font-semibold break-all text-neutral-900">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          onClick={copyAll}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy all the details
        </button>
      </div>

      {note && (
        <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          Put <strong>{note}</strong> in the remarks. A bank transfer carries
          no booking code of its own, so without it we&apos;re matching your
          money to your seat by the amount alone.
        </p>
      )}

      <p className="text-xs text-neutral-500">
        NEFT and IMPS have no ₹2,000 limit. Transfers can take a few hours to
        land — upload the screenshot as soon as you&apos;ve sent it, your seat
        is held from then, not from when it clears.
      </p>
    </div>
  );
}
