"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { addPayment } from "@/lib/trip";
import { newPaymentId, paymentState } from "@/lib/payments";
import { Booking, PaymentMethod } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * An admin recording money that never went through the site.
 *
 * Plenty of students will simply hand over cash, or transfer straight to a
 * trip lead's account. Before this there was no way to record that: a
 * booking could only be paid by uploading a screenshot, so a paid-up
 * student with cash in hand stayed stuck at "awaiting payment".
 *
 * It goes into the same list of transfers as a UPI payment, so the running
 * total, the shortfall banner and the spreadsheet all work identically and
 * a seat paid half in UPI and half in cash adds up correctly.
 *
 * **Cash records who took it.** There is no bank record behind a note
 * handed over at a desk, so the signed-in admin's name is the only account
 * of where the money went — which is exactly why it is captured
 * automatically rather than typed.
 */
export function RecordPaymentForm({
  booking,
  onAdded,
}: {
  booking: Booking;
  onAdded: () => void | Promise<void>;
}) {
  const { user, displayName } = useAuth();
  const state = paymentState(booking);

  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState(String(state.outstanding || state.due));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const typed = Math.round(Number(amount) || 0);

  async function submit() {
    if (!user || typed <= 0) return;
    setSaving(true);
    try {
      await addPayment(booking.id, {
        id: newPaymentId(),
        url: "",
        amount: typed,
        reference: note.trim(),
        upiId: method === "UPI" ? booking.payeeUpiId ?? null : null,
        at: Date.now(),
        method,
        recordedBy: user.uid,
        recordedByName: displayName,
        note: note.trim() || null,
      });
      toast.success(`${rupees(typed)} recorded.`);
      setNote("");
      setOpen(false);
      await onAdded();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not record that payment."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <HandCoins className="h-4 w-4" />
        Record cash or a direct transfer
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div>
        <p className="text-sm font-semibold text-neutral-900">
          Record a payment made outside the site
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Cash at a desk, or a transfer straight to a trip lead. It goes on the
          same running total as anything paid through the site.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How they paid">
          <Select
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            <option value="CASH">Cash, in person</option>
            <option value="BANK">Bank transfer</option>
            <option value="UPI">UPI, to a lead&apos;s own ID</option>
          </Select>
        </Field>
        <Field label="Amount" required>
          <Input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </Field>
      </div>

      <Field
        label={method === "CASH" ? "Note (optional)" : "Reference or note"}
        hint={
          method === "CASH"
            ? "e.g. paid at the stall on Tuesday."
            : "The UTR, or whose account it landed in."
        }
      >
        <Input value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>

      {/* Not a formality. Cash has no statement behind it, so this name is
          the only record of who took the money. */}
      <p className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-600">
        Recorded as taken by <strong>{displayName}</strong>. With cash this is
        the only record of who has the money, so let someone else enter it if
        they collected it.
      </p>

      <div className="flex gap-2">
        <Button onClick={submit} loading={saving} disabled={typed <= 0}>
          Record {typed > 0 ? rupees(typed) : "payment"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
