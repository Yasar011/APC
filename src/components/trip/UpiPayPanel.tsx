"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { activeUpiAccounts, nextUpiAccount, upiAppLinks, upiPayUri } from "@/lib/upi";
import { qrDataUrl } from "@/lib/qr";
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
  note,
  onSwitch,
}: {
  settings: TripSettings;
  account: UpiAccount | null;
  amount: number;
  /** Shown in the payer's statement — the booking code, so it reconciles. */
  note?: string;
  onSwitch: (next: UpiAccount) => void | Promise<void>;
}) {
  const [switching, setSwitching] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const accounts = activeUpiAccounts(settings);

  const payUri = account ? upiPayUri(account, amount, note) : null;
  const appLinks = account ? upiAppLinks(account, amount, note) : [];

  // The QR is generated from the payment link rather than uploaded, so the
  // amount is always right and there is no image to keep in sync.
  useEffect(() => {
    if (!payUri) {
      setQr(null);
      return;
    }
    let active = true;
    qrDataUrl(payUri, 260)
      .then((url) => active && setQr(url))
      .catch(() => active && setQr(null));
    return () => {
      active = false;
    };
  }, [payUri]);

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

      {/* A pasted image wins if one is set, otherwise the generated QR. */}
      {(account.qrUrl || qr) && (
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={account.qrUrl || qr || ""}
            alt={`UPI QR code for ${account.upiId}`}
            className="h-56 w-56 rounded-xl border border-neutral-200 bg-white object-contain p-2"
          />
          {!account.qrUrl && (
            <>
              <p className="mt-2 hidden text-center text-xs text-neutral-500 sm:block">
                <strong>On a laptop?</strong> Open GPay, PhonePe or any UPI app on
                your phone, scan this, and pay. The amount is already filled in.
              </p>
              <p className="mt-2 text-center text-xs text-neutral-500 sm:hidden">
                Scan with any UPI app — the amount is already filled in.
              </p>
            </>
          )}
        </div>
      )}

      {/* One tap straight into the app they use, amount already filled in.
          Android only - iOS ignores these schemes, which is why the QR
          above is always shown and never hidden behind a button. */}
      {appLinks.length > 0 && (
        <div className="sm:hidden">
          <p className="mb-2 text-center text-xs text-neutral-500">
            Or open your app directly
          </p>
          <div className="grid grid-cols-2 gap-2">
            {appLinks.map((app) => (
              <a
                key={app.name}
                href={app.href}
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: app.tint }}
              >
                <Smartphone className="h-4 w-4" />
                {app.name}
              </a>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-neutral-500">
            Nothing opened? Scan the QR above instead.
          </p>
        </div>
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
