"use client";

import { useRef, useState } from "react";
import { Check, CircleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Input } from "@/components/ui/primitives";
import { UpiPayPanel } from "@/components/trip/UpiPayPanel";
import { BankTransferPanel } from "@/components/trip/BankTransferPanel";
import { addPayment, setBookingPayee } from "@/lib/trip";
import { uploadScreenshot, validateScreenshot } from "@/lib/storage";
import { newPaymentId, paymentState } from "@/lib/payments";
import { Booking, PaymentProof, TripSettings, UpiAccount } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Paying for a seat, in as many transfers as the bank insists on.
 *
 * Two separate ₹2,000 caps bite here, and they have different fixes:
 *
 *  - **Paying from a QR picked out of the gallery** is capped by the apps
 *    themselves. On a phone this is the one students actually hit, because
 *    you cannot scan a QR that is on the screen you are looking at — so
 *    they screenshot it, open it from the gallery, and run straight into
 *    the cap. The fix is the app buttons, which carry the amount across
 *    without a QR at all, which is why they sit above the QR on mobile.
 *  - **The first payment to an ID you have never paid** is capped by some
 *    banks for 24 hours. Nothing avoids that one.
 *
 * So the form is built around paying in parts rather than treating it as an
 * error: pay what goes through, upload it, and the panel comes back asking
 * for the balance with the QR and buttons regenerated for the remaining
 * amount, so the second transfer is exact and needs no mental arithmetic.
 *
 * The amount is typed by the student and checked by an admin against the
 * screenshot. It is not trusted — it is a claim, made legible.
 */
export function PaymentForm({
  booking,
  settings,
  payee,
  onPayeeChange,
  onAdded,
}: {
  booking: Booking;
  settings: TripSettings;
  payee: UpiAccount | null;
  onPayeeChange: (next: UpiAccount) => void;
  onAdded: () => void | Promise<void>;
}) {
  const state = paymentState(booking);
  const [amount, setAmount] = useState(String(state.outstanding || state.due));
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typed = Math.round(Number(amount) || 0);
  const isFirstTransfer = state.transfers.length === 0;

  const missing = [
    typed <= 0 && "how much you paid",
    !reference.trim() && "the UPI reference number",
    !file && "a screenshot",
  ].filter(Boolean) as string[];

  async function submit() {
    if (!file || missing.length > 0) return;
    setSaving(true);
    try {
      const id = newPaymentId();
      // The image is uploaded under the payment's own id, so a second
      // transfer's proof cannot overwrite the first one's.
      const url = await uploadScreenshot(booking.bookerUid, booking.id, file, id);
      const payment: PaymentProof = {
        id,
        url,
        amount: typed,
        reference: reference.trim(),
        upiId: payee?.upiId ?? booking.payeeUpiId ?? null,
        at: Date.now(),
      };
      await addPayment(booking.id, payment);

      const nowPaid = state.paid + typed;
      if (nowPaid >= state.due) {
        toast.success("Sent for approval.");
      } else {
        toast.success(
          `₹${typed.toLocaleString("en-IN")} recorded — ${rupees(
            state.due - nowPaid
          )} still to pay.`
        );
      }
      setFile(null);
      setReference("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await onAdded();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed. Check your connection."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Said before they try, not after their bank refuses. */}
      {isFirstTransfer && state.due > 2000 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <CircleAlert className="h-4 w-4 shrink-0" />
            If your app won&apos;t send the full {rupees(state.due)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            UPI often won&apos;t move more than <strong>₹2,000</strong> in one
            payment — a saved QR opened from your gallery is capped there, and
            so is the first payment to an ID you&apos;ve never paid. That&apos;s
            normal and nothing is wrong with your account.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900">
            Two ways through, both fine:{" "}
            <strong>send ₹2,000, upload it, then pay the rest</strong> — both go
            on this same booking — or use the{" "}
            <strong>bank transfer</strong> option below, which has no such
            limit.
          </p>
        </div>
      )}

      {state.transfers.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Paid so far
          </p>
          <ul className="mt-2 space-y-1">
            {state.transfers.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-1.5 text-neutral-700">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  {rupees(item.amount)}
                </span>
                <span className="truncate font-mono text-xs text-neutral-500">
                  {item.reference}
                </span>
              </li>
            ))}
          </ul>
          <p
            className={`mt-2 border-t border-neutral-200 pt-2 text-sm font-semibold ${
              state.settled ? "text-emerald-700" : "text-amber-800"
            }`}
          >
            {state.settled
              ? `Fully paid — ${rupees(state.paid)}`
              : `${rupees(state.outstanding)} still to pay`}
          </p>
        </div>
      )}

      <UpiPayPanel
        settings={settings}
        account={payee}
        // The balance, not the total — so the second transfer is exact.
        amount={state.outstanding || state.due}
        note={booking.bookingCode}
        onSwitch={async (next) => {
          onPayeeChange(next);
          await setBookingPayee(booking.id, next.upiId, next.payeeName);
        }}
      />

      <BankTransferPanel
        settings={settings}
        amount={state.outstanding || state.due}
        note={booking.bookingCode}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="How much you paid"
          required
          hint="This one transfer, not the total."
        >
          <Input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </Field>
        <Field
          label="UPI reference number"
          required
          hint="The transaction or UTR number your app shows."
        >
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            required
          />
        </Field>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0] ?? null;
          if (!picked) return;
          const error = validateScreenshot(picked);
          if (error) {
            toast.error(error);
            event.target.value = "";
            return;
          }
          setFile(picked);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
      >
        {file ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" />
            {file.name}
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Screenshot of this payment
          </>
        )}
      </button>

      <Button
        className="w-full"
        onClick={submit}
        loading={saving}
        disabled={missing.length > 0}
      >
        {typed > 0 && typed < state.outstanding
          ? `Record ${rupees(typed)} and pay the rest after`
          : "Send for approval"}
      </Button>

      {/* A greyed-out button with no reason is just a dead end. */}
      {missing.length > 0 ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-amber-700">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          Add {missing.join(", ")} to send this.
        </p>
      ) : (
        <p className="text-center text-xs text-neutral-500">
          Your seat is held once an admin confirms the payment.
        </p>
      )}
    </div>
  );
}
