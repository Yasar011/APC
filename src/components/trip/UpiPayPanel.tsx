"use client";

import { useEffect, useState } from "react";
import { Copy, MessageCircle, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import {
  UpiPlatform,
  activeUpiAccounts,
  detectUpiPlatform,
  nextUpiAccount,
  upiAppLinks,
  upiPayUri,
} from "@/lib/upi";
import { qrDataUrl } from "@/lib/qr";
import { contactPhone } from "@/lib/contact";
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

  // Read after mount: the server has no user agent, and rendering Android
  // links into an iPhone (or the reverse) is exactly how these buttons
  // ended up showing an error page.
  const [platform, setPlatform] = useState<UpiPlatform>("other");
  useEffect(() => setPlatform(detectUpiPlatform()), []);

  const payUri = account ? upiPayUri(account, amount, note) : null;
  const appLinks = account
    ? upiAppLinks(account, amount, note, {
        platform,
        fallbackUrl:
          typeof window === "undefined" ? undefined : window.location.href,
      })
    : [];

  // Carries the booking code and the failing ID, so a lead can act on the
  // message without a round of "which one? whose booking?".
  const reportPhone = contactPhone(settings).replace(/\D/g, "");
  const reportHref = `https://wa.me/${
    reportPhone.length > 10 ? reportPhone : `91${reportPhone}`
  }?text=${encodeURIComponent(
    [
      `Hi! The UPI ID isn't accepting my payment for the Jawai trip.`,
      note ? `Booking: ${note}` : "",
      account ? `UPI ID shown: ${account.upiId}` : "",
      `Amount: ₹${amount}`,
    ]
      .filter(Boolean)
      .join("\n")
  )}`;

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

      {/* One tap straight into the app they use, amount already filled in.
          Android only - iOS ignores these schemes, which is why the QR
          above is always shown and never hidden behind a button. */}
      {appLinks.length > 0 && (
        <div className="sm:hidden">
          <p className="mb-2 text-center text-xs font-medium text-neutral-700">
            Tap your app — the amount goes straight across
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
          {/* The path with no scheme, no app and nothing to go wrong. When
              a deep link fails, this is what actually gets someone paid. */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(account.upiId);
              toast.success("UPI ID copied", {
                description: `Open any UPI app, paste it, and send ${rupees(
                  amount
                )}.`,
                duration: 7000,
              });
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 py-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Nothing opened? Copy the UPI ID and pay manually
          </button>
        </div>
      )}

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
              {/* Saving this and picking it from the gallery is what runs
                  into the apps' own ₹2,000 cap on gallery QRs - and on a
                  phone you cannot scan your own screen, so that is exactly
                  what a student would otherwise do. */}
              <p className="mt-2 text-center text-xs text-neutral-500 sm:hidden">
                Scan this from <em>another</em> device. Don&apos;t screenshot it
                and open it from your gallery — apps cap that at ₹2,000.
              </p>
            </>
          )}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-neutral-500">
        <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Pay the exact amount to the ID above, then upload the screenshot. Pay the one shown
        here — it&apos;s how we match your payment to your seat.
      </p>

      {/* Always shown. This was gated on there being a second account to
          switch to, which meant a club running one UPI ID - the normal case
          at the start - had no way at all to say "this isn't working", and
          a student whose payment kept failing just gave up. Reporting it is
          useful even when there is nothing to switch to: it is how the
          leads find out an ID has stopped accepting money. */}
      <div className="rounded-lg border border-dashed border-neutral-300 p-3 text-center">
        <p className="text-xs text-neutral-500">
          This UPI ID not accepting your payment?
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {accounts.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={useNextAccount}
              loading={switching}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Use a different UPI ID
            </Button>
          )}
          <a
            href={reportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:bg-neutral-50"
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            Tell the trip leads it&apos;s not working
          </a>
        </div>
        {accounts.length <= 1 && (
          <p className="mt-2 text-xs text-neutral-400">
            There&apos;s only one UPI ID set up right now, so there&apos;s
            nothing to switch to — message the leads and they&apos;ll add
            another.
          </p>
        )}
      </div>
    </div>
  );
}
