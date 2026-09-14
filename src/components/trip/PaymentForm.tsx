"use client";

import { useRef, useState } from "react";
import { Check, CircleAlert, Clock, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Input } from "@/components/ui/primitives";
import { UpiPayPanel } from "@/components/trip/UpiPayPanel";
import { BankTransferPanel } from "@/components/trip/BankTransferPanel";
import { addPayment, setBookingPayee } from "@/lib/trip";
import { uploadScreenshot, validateScreenshot } from "@/lib/storage";
import { newPaymentId, paymentState } from "@/lib/payments";
import {
  Booking,
  PaymentMethod,
  PaymentProof,
  TripSettings,
  UpiAccount,
} from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Paying for a seat.
 *
 * Two ₹2,000 caps bite on UPI: a QR picked out of the gallery is capped by
 * the apps themselves, and some banks cap the first payment to an ID you
 * have never paid. So a ₹2,099 seat often cannot go in one transfer, and
 * the form is built around that rather than treating it as an error — pay
 * what goes through, upload it, and it comes back asking for the balance
 * with the QR regenerated for exactly that. A bank transfer, which has no
 * such ceiling, is the other tab.
 *
 * The screen is ordered as the two things a student actually does: **pay**,
 * then **tell us about it**. Before this they were interleaved — a "paid so
 * far" box, then a QR, then the form — and the method was a dropdown buried
 * under the upload, so the instructions on screen could be for UPI while
 * the payment being recorded said bank.
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

  // What is actually still owed. This used to fall back to the full price
  // when it hit zero, so a booking already paid in full displayed a QR
  // demanding the whole amount a second time.
  const remaining = state.outstanding;

  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  // A settled booking hides the payment screen, but a rejected payment or a
  // transfer that silently failed still needs a way back in.
  const [payingAgain, setPayingAgain] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // What the page asked for. An admin corrects it against the screenshot.
  const typed = remaining;
  const byBank = method === "BANK";
  const bankAvailable = Boolean(
    settings.bankAccountNumber?.trim() && settings.bankIfsc?.trim()
  );

  const missing = [
    !reference.trim() && "the reference number",
    !file && "a screenshot",
  ].filter(Boolean) as string[];

  async function submit() {
    if (!file || missing.length > 0) return;
    setSaving(true);
    try {
      const id = newPaymentId();
      // Uploaded under the payment's own id, so a second transfer's proof
      // cannot overwrite the first one's.
      const url = await uploadScreenshot(booking.bookerUid, booking.id, file, id);
      const payment: PaymentProof = {
        id,
        url,
        amount: typed,
        reference: reference.trim(),
        // Only a UPI payment belongs against a UPI ID.
        upiId: byBank ? null : payee?.upiId ?? booking.payeeUpiId ?? null,
        at: Date.now(),
        method,
      };
      await addPayment(booking.id, payment);

      const nowPaid = state.paid + typed;
      toast.success(
        nowPaid >= state.due
          ? "Sent for approval."
          : `${rupees(typed)} recorded — ${rupees(state.due - nowPaid)} still to pay.`
      );
      setFile(null);
      setReference("");
      setPayingAgain(false);
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

  /* ------------------------------------------------ already paid in full */

  if (state.settled && !payingAgain) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <Check className="h-4 w-4 shrink-0" />
            Paid in full — {rupees(state.paid)}
          </p>
          <p className="mt-1 flex items-start gap-2 text-xs leading-relaxed text-emerald-900">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Nothing more to pay. A trip lead checks your screenshot, and your
            ticket appears on this page once it&apos;s approved.
          </p>
        </div>

        <TransferList state={state} />

        <button
          type="button"
          onClick={() => setPayingAgain(true)}
          className="w-full text-center text-xs text-neutral-500 underline"
        >
          Something went wrong and you need to send more?
        </button>
      </div>
    );
  }

  /* -------------------------------------------------------- still to pay */

  return (
    <div className="space-y-5">
      {state.transfers.length > 0 && <TransferList state={state} />}

      {/* Said before they try, not after their app refuses. */}
      {state.transfers.length === 0 && remaining > 2000 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <CircleAlert className="h-4 w-4 shrink-0" />
            If UPI won&apos;t send the full {rupees(remaining)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            UPI often won&apos;t move more than <strong>₹2,000</strong> at once.
            That&apos;s normal. Either{" "}
            <strong>send ₹2,000, upload it, then pay the rest</strong> — both go
            on this booking — or switch to <strong>Bank transfer</strong>, which
            has no such limit.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------- 1. pay */}
      <section>
        <Step number={1} title={`Pay ${rupees(remaining)}`} />

        {bankAvailable && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1">
            {(
              [
                ["UPI", "UPI / QR"],
                ["BANK", "Bank transfer"],
              ] as [PaymentMethod, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMethod(value)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  method === value
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {byBank ? (
          <BankTransferPanel
            settings={settings}
            amount={remaining}
            note={booking.bookingCode}
          />
        ) : (
          <UpiPayPanel
            settings={settings}
            account={payee}
            amount={remaining}
            note={booking.bookingCode}
            onSwitch={async (next) => {
              onPayeeChange(next);
              await setBookingPayee(booking.id, next.upiId, next.payeeName);
            }}
          />
        )}
      </section>

      {/* --------------------------------------------------- 2. tell us */}
      <section className="border-t border-neutral-200 pt-5">
        <Step number={2} title="Tell us you've paid" />

        <div className="space-y-4">
          {/* The amount is not asked for. It is the one number a student
              has no reason to get right and every reason to mistype, and
              the admin reads it off the screenshot anyway - so the page
              records what it asked for and the admin corrects it if the
              screenshot disagrees. */}
          <Field
            label={byBank ? "Transaction reference" : "UPI reference number"}
            required
            hint={
              byBank
                ? "The UTR your bank shows for the transfer."
                : "The transaction or UTR number your app shows."
            }
          >
            <Input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              required
            />
          </Field>

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
            Send for approval
          </Button>

          {/* A greyed-out button with no reason is just a dead end. */}
          {missing.length > 0 ? (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-amber-700">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
              Add {listOf(missing)} to send this.
            </p>
          ) : (
            <p className="text-center text-xs text-neutral-500">
              Your seat is held once a trip lead confirms the payment.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/** "a, b and c" — a comma-joined list reads as a broken sentence. */
function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Step({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
        {number}
      </span>
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
    </div>
  );
}

function TransferList({ state }: { state: ReturnType<typeof paymentState> }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Paid so far
      </p>
      <ul className="mt-2 space-y-1">
        {state.transfers.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-neutral-700">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              {rupees(item.amount)}
            </span>
            <span className="truncate font-mono text-xs text-neutral-500">
              {item.reference}
            </span>
          </li>
        ))}
      </ul>
      {!state.settled && (
        <p className="mt-2 border-t border-neutral-200 pt-2 text-sm font-semibold text-amber-800">
          {rupees(state.outstanding)} still to pay
        </p>
      )}
    </div>
  );
}
