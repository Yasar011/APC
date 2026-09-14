"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input, Modal, Select } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import {
  addPayment,
  confirmBooking,
  createManualBooking,
  isNiftIdTaken,
} from "@/lib/trip";
import { quote } from "@/lib/pricing";
import { newPaymentId } from "@/lib/payments";
import { PaymentMethod, TripSettings } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Booking a seat for someone at the desk.
 *
 * This is the in-person path, and in person the money usually changes
 * hands in the same breath as the name — so it asks for both. Creating the
 * seat and then hunting for it in the list to record ₹2,099 you are
 * holding is how a cash payment ends up remembered rather than written
 * down.
 *
 * No email is asked for. A lead has a name and a number; the address turns
 * up later if it turns up at all, and it can be linked from the booking
 * itself then. Blood group, allergies and emergency contact are the
 * student's to give — a lead guessing at a blood group is worse than a
 * blank, so the roster shows the gap instead.
 */
export function ManualBookingModal({
  open,
  onClose,
  settings,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  settings: TripSettings;
  onCreated: () => void | Promise<void>;
}) {
  const { user, displayName } = useAuth();
  const pricing = quote(settings, null);

  const [name, setName] = useState("");
  const [niftId, setNiftId] = useState("");
  const [phone, setPhone] = useState("");

  const [collected, setCollected] = useState(String(pricing.total));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [saving, setSaving] = useState(false);

  const paid = Math.max(0, Math.round(Number(collected) || 0));
  const fullyPaid = paid >= pricing.total;

  const missing = [
    !name.trim() && "their name",
    !niftId.trim() && "their NIFT ID",
    !phone.trim() && "their phone number",
  ].filter(Boolean) as string[];

  function reset() {
    setName("");
    setNiftId("");
    setPhone("");
    setCollected(String(pricing.total));
    setMethod("CASH");
    setNote("");
    setConfirmNow(true);
  }

  async function submit() {
    if (!user || missing.length > 0) return;
    setSaving(true);
    try {
      // Checked before writing so a clash reads as a plain message rather
      // than a rules rejection at the end.
      if (await isNiftIdTaken(niftId)) {
        toast.error(`${niftId.trim()} already has a seat.`);
        return;
      }

      const { bookingId, bookingCode, booking } = await createManualBooking({
        name,
        niftId,
        phone,
        pricing,
        adminUid: user.uid,
        adminName: displayName,
      });

      if (paid > 0) {
        const payment = {
          id: newPaymentId(),
          url: "",
          amount: paid,
          reference: note.trim(),
          upiId: null,
          at: Date.now(),
          method,
          // Cash has no statement behind it. Whoever entered it is the
          // only record of who is holding the money.
          recordedBy: user.uid,
          recordedByName: displayName,
          note: note.trim() || null,
        };
        await addPayment(bookingId, payment);

        if (confirmNow && fullyPaid) {
          // Nothing to verify — the lead took the money themselves — so the
          // ticket is issued now rather than queued behind a screenshot
          // that will never arrive.
          await confirmBooking(
            { ...booking, payments: { [payment.id]: payment } },
            user.uid,
            displayName
          );
        }
      }

      toast.success(`Booked — ${bookingCode}`, {
        description:
          paid > 0
            ? `${rupees(paid)} recorded${
                confirmNow && fullyPaid ? " and the seat is confirmed." : "."
              }`
            : "Nothing collected yet.",
        duration: 8000,
      });
      reset();
      onClose();
      await onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create that booking."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Book a seat at the desk">
      <div className="space-y-5">
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="NIFT ID" required hint="One seat per ID.">
              <Input
                value={niftId}
                onChange={(event) => setNiftId(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Phone" required hint="How you reach them about the trip.">
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
            />
          </Field>
        </section>

        <section className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              Money collected
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              The seat costs {rupees(pricing.total)}. Set this to 0 if
              they&apos;re paying later.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount taken">
              <Input
                type="number"
                inputMode="numeric"
                value={collected}
                onChange={(event) => setCollected(event.target.value)}
              />
            </Field>
            <Field label="How">
              <Select
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as PaymentMethod)
                }
              >
                <option value="CASH">Cash, in person</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank transfer</option>
              </Select>
            </Field>
          </div>

          <Field label="Note" hint="Optional — a UTR, or where you took it.">
            <Input value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>

          {paid > 0 && paid < pricing.total && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
              {rupees(pricing.total - paid)} will still be owed. They can pay the
              rest on their booking page, or you can record it here later.
            </p>
          )}

          {fullyPaid && paid > 0 && (
            <label className="flex items-start gap-2.5 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={confirmNow}
                onChange={(event) => setConfirmNow(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                <strong>Confirm the seat now and issue the ticket.</strong> You
                took the money yourself, so there&apos;s no screenshot to check.
              </span>
            </label>
          )}

          {paid > 0 && (
            <p className="text-xs text-neutral-500">
              Recorded as taken by <strong>{displayName}</strong>. With cash
              that&apos;s the only record of who has it — let whoever collected
              it enter it.
            </p>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={missing.length > 0}>
            {paid > 0 ? `Book and record ${rupees(paid)}` : "Book the seat"}
          </Button>
        </div>

        {missing.length > 0 && (
          <p className="text-right text-xs text-amber-700">
            Add {missing.join(", ")}.
          </p>
        )}
      </div>
    </Modal>
  );
}
