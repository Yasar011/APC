"use client";

import { useState } from "react";
import { Building2, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { TripSettings } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Paying by bank transfer instead.
 *
 * UPI is the fast path, but it refuses people for reasons the club cannot
 * do anything about — a daily limit, a bank outage, an app that will not
 * move more than ₹2,000 in one go. A bank transfer has none of those
 * ceilings, so it is the way out when UPI has said no.
 *
 * Folded away by default: it is the fallback, not the front door, and
 * putting two payment methods side by side makes people hesitate over
 * which is "right" rather than just paying.
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
  const [open, setOpen] = useState(false);

  const account = settings.bankAccountNumber?.trim();
  const ifsc = settings.bankIfsc?.trim();
  const name = settings.bankAccountName?.trim();

  // Nothing useful to show without at least the number and the IFSC.
  if (!account || !ifsc) return null;

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
    <div className="rounded-xl border border-neutral-200">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Building2 className="h-4 w-4 shrink-0 text-neutral-500" />
        <span className="flex-1">
          <span className="block text-sm font-medium text-neutral-900">
            UPI not working? Pay by bank transfer
          </span>
          <span className="mt-0.5 block text-xs text-neutral-500">
            No ₹2,000 limit. NEFT, IMPS or your bank&apos;s app.
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-neutral-200 p-4">
          <dl className="space-y-2.5">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className="text-right font-mono text-sm font-semibold text-neutral-900">
                  {value}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-2.5">
              <dt className="text-xs text-neutral-500">Amount</dt>
              <dd className="text-right text-sm font-semibold text-neutral-900">
                {rupees(amount)}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={copyAll}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 py-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy all the details
          </button>

          {note && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              Put <strong>{note}</strong> in the remarks. A bank transfer
              carries no booking code of its own, so without it we&apos;re
              matching your money to your seat by the amount alone.
            </p>
          )}

          <p className="mt-3 text-xs text-neutral-500">
            Transfers can take a few hours to land. Upload the screenshot as
            soon as you&apos;ve sent it — your seat is held from then, not from
            when it clears.
          </p>
        </div>
      )}
    </div>
  );
}
