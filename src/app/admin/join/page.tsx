"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, MessageCircle, Search, X } from "lucide-react";
import {
  Card,
  CardBody,
  Field,
  FullPageSpinner,
  Input,
} from "@/components/ui/primitives";
import { listBookings, readSettings } from "@/lib/trip";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { Booking, TripSettings } from "@/lib/types";

/**
 * Who is allowed into the trip WhatsApp group.
 *
 * **A WhatsApp invite link cannot be made to work for one person only.**
 * Every `chat.whatsapp.com` link works for anyone holding it, and there is
 * no per-person variant — so a student who forwards theirs to a friend has
 * let that friend in, and no amount of code on our side changes that.
 *
 * What does work is WhatsApp's own **"Approve new participants"** setting:
 * every join becomes a request an admin has to accept, showing the number
 * asking. That turns the problem into "is this number on the list?", which
 * is a question this page can answer instantly — against confirmed
 * bookings only, so someone who never paid is never let in.
 */

/** Compares the last 10 digits: stored numbers may or may not carry +91. */
function digits(value: string): string {
  const only = value.replace(/\D/g, "");
  return only.slice(-10);
}

export default function JoinCheckPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<TripSettings>(
    DEFAULT_SETTINGS as TripSettings
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [all, tripSettings] = await Promise.all([listBookings(), readSettings()]);
      setBookings(all);
      setSettings(tripSettings);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load the bookings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Confirmed only — an unpaid booking is not a ticket into the group. */
  const allowed = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const booking of bookings) {
      if (booking.status !== "CONFIRMED") continue;
      for (const number of [
        booking.travellers[0]?.phone,
        booking.bookerPhone,
      ]) {
        const key = digits(number || "");
        if (key.length === 10) map.set(key, booking);
      }
    }
    return map;
  }, [bookings]);

  const typed = digits(query);
  const complete = typed.length === 10;
  const match = complete ? allowed.get(typed) : undefined;

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#16323f]">
          WhatsApp group requests
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Check a number against confirmed bookings before you let it in.
        </p>
      </div>

      {loadError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {loadError}
        </p>
      )}

      <Card className="rounded-2xl">
        <CardBody>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <CircleAlert className="h-4 w-4 shrink-0" />
              An invite link can&apos;t be locked to one person
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              WhatsApp has no per-person invite — any link works for anyone
              holding it, so a forwarded link lets a friend in and nothing on
              our side can stop that. Do this instead, once:
            </p>
            <p className="mt-2 text-xs leading-relaxed text-amber-900">
              Open the group &rarr; <strong>Group settings</strong> &rarr;
              <strong> Approve new participants</strong>, and turn it on. Every
              join then waits for your approval and shows you the number. Check
              it here before you accept.
            </p>
          </div>

          <div className="mt-5">
            <Field
              label="Phone number asking to join"
              hint="Paste it from the join request. The last 10 digits are what's matched."
            >
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="98765 43210"
                inputMode="tel"
                autoFocus
              />
            </Field>
          </div>

          {!complete ? (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-3 text-sm text-neutral-500">
              <Search className="h-4 w-4 shrink-0" />
              {typed.length === 0
                ? "Type or paste a number to check it."
                : `${10 - typed.length} more digit${
                    10 - typed.length === 1 ? "" : "s"
                  } to go.`}
            </p>
          ) : match ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Check className="h-4 w-4 shrink-0" />
                Let them in
              </p>
              <dl className="mt-3 space-y-1 text-sm text-emerald-900">
                <div className="flex gap-2">
                  <dt className="text-emerald-700">Name</dt>
                  <dd className="font-semibold">
                    {match.travellers[0]?.name || match.bookerName}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-emerald-700">NIFT ID</dt>
                  <dd className="font-mono">{match.niftId}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-emerald-700">Booking</dt>
                  <dd className="font-mono">{match.bookingCode}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
                <X className="h-4 w-4 shrink-0" />
                Not a confirmed booking
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-800">
                No confirmed seat has this number. They may have booked and not
                paid yet, or given a different number — check Bookings before
                turning anyone away.
              </p>
            </div>
          )}

          <p className="mt-5 flex items-center gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            {allowed.size} confirmed number{allowed.size === 1 ? "" : "s"} can be
            let in.
            {settings.whatsappGroupUrl
              ? " The group link is shown to each student once their payment is verified."
              : " No group link is set yet — add one in Trip settings."}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
