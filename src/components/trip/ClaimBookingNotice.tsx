"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { claimBooking, findClaimableBooking } from "@/lib/trip";
import { Booking } from "@/lib/types";
import { rupees } from "@/lib/utils";

/**
 * "A seat is already booked for you."
 *
 * Shown when a trip lead created a booking against this person's email
 * before they ever signed in. Claiming attaches it to their account; the
 * database rules do the real check, comparing the booking's `claimEmail`
 * against the email on their token, so the button cannot take a seat that
 * was meant for someone else.
 *
 * It goes above the booking form, because a student who books a second
 * seat without noticing this one has claimed two of eighty-nine and paid
 * for one.
 */
export function ClaimBookingNotice() {
  const { user, emailVerified } = useAuth();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Read out of `user` first: depending on the whole object makes the
  // lookup re-run on every auth refresh, and the React Compiler refuses to
  // optimise a hook whose stated dependency is narrower than its inferred
  // one.
  const email = user?.email ?? null;

  const look = useCallback(async () => {
    if (!email) return;
    try {
      setBooking(await findClaimableBooking(email));
    } catch {
      // A missing claim index, or rules that haven't been republished yet.
      // Nothing here is worth blocking the booking form over.
      setBooking(null);
    }
  }, [email]);

  useEffect(() => {
    look();
  }, [look]);

  if (!user || !booking) return null;

  async function claim() {
    if (!user || !booking) return;
    setClaiming(true);
    try {
      await claimBooking(booking, user.uid);
      toast.success("That seat is yours.", {
        description: "Add your details and pay to confirm it.",
      });
      router.push(`/booking/${booking.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.toLowerCase().includes("permission")
          ? "Couldn't claim that seat — verify your email address first."
          : "Couldn't claim that seat. Message the trip leads."
      );
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <Ticket className="h-4 w-4 shrink-0" />
        A seat is already booked for you
      </p>
      <p className="mt-1 text-xs leading-relaxed text-emerald-900">
        {booking.createdByName || "A trip lead"} booked{" "}
        <strong>{booking.bookingCode}</strong> for {booking.niftId} at{" "}
        {rupees(booking.pricing.total)}. Take it over rather than booking a
        second one — one seat per NIFT ID, and a duplicate will be turned away.
      </p>
      <Button
        size="sm"
        className="mt-3"
        onClick={claim}
        loading={claiming}
        disabled={!emailVerified}
      >
        This is mine — claim it
      </Button>
      {!emailVerified && (
        <p className="mt-2 text-xs text-emerald-800">
          Verify your email address first — that&apos;s what proves the seat is
          yours.
        </p>
      )}
    </div>
  );
}
