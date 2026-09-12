"use client";

import { useState } from "react";
import { Copy, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { activeUpiAccounts, nextUpiAccount } from "@/lib/upi";
import { TripSettings, UpiAccount } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Where to send the money.
 *
 * The club collects on several UPI IDs because one hits receiving limits
 * partway through a bus. Students are spread across them automatically, but
 * a given ID can still refuse a payment - limit reached, app playing up - so
 * there is a button to move to the next one. Switching is recorded straight
 * away, so the booking always says which ID the money actually went to.
 */
export function UpiPayPanel({
  settings,
  account,
  amount,
  onSwitch,
}: {
  settings: TripSettings;
  account: UpiAccount | null;
  amount: number;
  onSwitch: (next: UpiAccount) => void | Promise<void>;
}) {
  const [switching, setSwitching] = useState(false);
  const accounts = activeUpiAccounts(settings);

  if (!account) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Payment details haven&apos;t been set up yet. Message the trip leads
        {settings.contactPhone ? ` on ${settings.contactPhone}` : ""} before paying.
      </p>
    );
  }

  async function useNextAccount() {
    const next = nextUpiAccount(settings, account?.upiId ?? null);
    if (!next || next.upiId === account?.upiId) {
      toast.message("That's the only UPI ID set up right now.", {
        description: settings.contactPhone
          ? `Message the trip leads on ${settings.contactPhone}.`
          : "Message the trip leads.",
      });
      return;
    }
    setSwitching(true);
    try {
      await onSwitch(next);
      toast.success(`Switched to ${next.upiId}`);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs uppercase tracking-wider text-neutral-500">
          Pay {rupees(amount)} to this UPI ID
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="text-base font-semibold text-neutral-900">
            {account.upiId}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(account.upiId);
              toast.success("UPI ID copied");
            }}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
            aria-label="Copy UPI ID"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        {account.payeeName && (
          <p className="mt-1 text-xs text-neutral-500">Payee: {account.payeeName}</p>
        )}
      </div>

      {account.qrUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={account.qrUrl}
          alt={`UPI QR code for ${account.upiId}`}
          className="mx-auto h-56 w-56 rounded-xl border border-neutral-200 bg-white object-contain p-2"
        />
      )}

      <p className="flex items-start gap-2 text-xs text-neutral-500">
        <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Pay the exact amount to the ID above, then upload the screenshot. Pay the one shown
        here — it&apos;s how we match your payment to your seat.
      </p>

      {accounts.length > 1 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-3 text-center">
          <p className="text-xs text-neutral-500">
            This UPI ID not accepting your payment?
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={useNextAccount}
            loading={switching}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Use a different UPI ID
          </Button>
        </div>
      )}
    </div>
  );
}
