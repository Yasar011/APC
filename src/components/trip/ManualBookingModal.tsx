"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input, Modal } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { createManualBooking, isNiftIdTaken } from "@/lib/trip";
import { quote } from "@/lib/pricing";
import { TripSettings } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * Booking a seat for someone who hasn't used the site.
 *
 * Students pay in person, message a lead, or never get round to it — and a
 * club that cannot write those down keeps the real list somewhere else,
 * which is how a bus leaves with a name nobody checked.
 *
 * The booking is created against their **email address**. When they sign in
 * with it they are offered the seat and fill in the rest themselves. Only
 * the essentials are asked for here: blood group, allergies and emergency
 * contact are theirs to give, and a lead guessing at a blood group is worse
 * than a blank.
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
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [niftId, setNiftId] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const pricing = quote(settings, null);

  // Email is deliberately not required. A lead writing someone down at a
  // stall has a name and a phone number and nothing else, and refusing the
  // booking until an address turns up is how the real list ends up in a
  // notebook. The phone is required instead — without it there is no way
  // to reach them at all.
  const missing = [
    !name.trim() && "their name",
    !niftId.trim() && "their NIFT ID",
    !phone.trim() && "their phone number",
  ].filter(Boolean) as string[];

  function reset() {
    setEmail("");
    setName("");
    setNiftId("");
    setPhone("");
  }

  async function submit() {
    if (!user || missing.length > 0) return;

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("That doesn't look like an email address.");
      return;
    }

    setSaving(true);
    try {
      // Checked before writing so a clash reads as a plain message rather
      // than a rules rejection at the end.
      if (await isNiftIdTaken(niftId)) {
        toast.error(`${niftId.trim()} already has a seat.`);
        return;
      }

      const { bookingCode } = await createManualBooking({
        email: cleanEmail,
        name,
        niftId,
        phone,
        pricing,
        adminUid: user.uid,
        adminName: displayName,
      });

      toast.success(`Booked — ${bookingCode}`, {
        description: cleanEmail
          ? `${cleanEmail} takes it over when they sign in with that address.`
          : "Add their email on the booking when you have it, so they can claim it.",
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
    <Modal open={open} onClose={onClose} title="Book a seat for someone">
      <div className="space-y-4">
        <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-600">
          Write the seat down now with just a name, ID and phone. Add their
          email whenever you get it — the seat is then offered to them when
          they sign in with that address, and{" "}
          <strong>they</strong> fill in blood group, allergies and emergency
          contact themselves.
        </p>

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

        <Field label="Phone" required hint="How you reach them until there's an email.">
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
          />
        </Field>

        <Field
          label="Their email"
          hint="Optional now — add it on the booking later and they can claim the seat."
        >
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@gmail.com"
          />
        </Field>

        <p className="text-xs text-neutral-500">
          The seat is created unpaid at {rupees(pricing.total)}. If they&apos;ve
          already paid you, record it on the booking afterwards.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={missing.length > 0}>
            Create the booking
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
