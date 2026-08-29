"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Printer, Users } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  FullPageSpinner,
} from "@/components/ui/primitives";
import { listBookings, readSettings } from "@/lib/trip";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { Traveller, TripSettings } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface RosterRow extends Traveller {
  bookingCode: string;
  bookerName: string;
  bookerPhone: string;
}

/**
 * The paper fallback.
 *
 * Jawai has patchy signal, so the trip leads carry this printed. It is the
 * whole reason the medical fields are collected: blood group, conditions,
 * allergies and who to call, for every person on the bus, without needing a
 * network connection to look any of it up.
 */
export default function RosterPage() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS as TripSettings);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [bookings, tripSettings] = await Promise.all([listBookings(), readSettings()]);
      setSettings(tripSettings);
      setRows(
        bookings
          .filter((booking) => booking.status === "CONFIRMED")
          .flatMap((booking) =>
            booking.travellers.map((traveller) => ({
              ...traveller,
              bookingCode: booking.bookingCode,
              bookerName: booking.bookerName,
              bookerPhone: booking.bookerPhone,
            }))
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the roster.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <FullPageSpinner />;

  if (loadError) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Couldn't load the roster"
        description={loadError}
        action={<Button onClick={load}>Try again</Button>}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No confirmed travellers yet"
        description="Confirmed bookings appear here, ready to print before the trip."
      />
    );
  }

  const bloodCounts = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.bloodGroup] = (counts[row.bloodGroup] ?? 0) + 1;
    return counts;
  }, {});

  const flagged = rows.filter(
    (row) => !isNothing(row.medicalConditions) || !isNothing(row.allergies)
  );

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Trip roster</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {rows.length} confirmed travellers. Print this and carry it on the bus.
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      <div className="print-tight rounded-xl border border-neutral-200 bg-white p-6">
        <header className="mb-6 border-b border-neutral-200 pb-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {settings.tripName || "Jawai Safari"} — passenger manifest
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {rows.length} travellers
            {settings.startDate ? ` · ${formatDate(settings.startDate)}` : ""}
            {settings.pickupPoint ? ` · ${settings.pickupPoint}` : ""}
            {settings.departureTime ? ` · ${settings.departureTime}` : ""}
          </p>
          {settings.contactPhone && (
            <p className="mt-1 text-sm text-neutral-600">
              Trip lead: {settings.contactName} — {settings.contactPhone}
            </p>
          )}
        </header>

        <section className="print-break mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Blood groups on board
            </p>
            <p className="mt-2 text-sm text-neutral-800">
              {Object.entries(bloodCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([group, count]) => `${group}: ${count}`)
                .join("  ·  ")}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Needs attention
            </p>
            <p className="mt-2 text-sm text-neutral-800">
              {flagged.length === 0
                ? "Nobody declared a condition or allergy."
                : `${flagged.length} ${
                    flagged.length === 1 ? "person has" : "people have"
                  } a declared condition or allergy — see the highlighted rows.`}
            </p>
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-neutral-300 text-left uppercase tracking-wider text-neutral-500">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">NIFT ID</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Blood</th>
                <th className="py-2 pr-3">Conditions / allergies / meds</th>
                <th className="py-2 pr-3">Emergency contact</th>
                <th className="py-2">Booking</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const notable =
                  !isNothing(row.medicalConditions) || !isNothing(row.allergies);
                return (
                  <tr
                    key={`${row.bookingCode}-${row.niftId}-${index}`}
                    className={`print-break border-b border-neutral-200 align-top ${
                      notable ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="py-2 pr-3 tabular-nums text-neutral-400">{index + 1}</td>
                    <td className="py-2 pr-3 font-medium text-neutral-900">{row.name}</td>
                    <td className="py-2 pr-3 text-neutral-700">{row.niftId}</td>
                    <td className="py-2 pr-3 tabular-nums text-neutral-700">{row.phone}</td>
                    <td className="py-2 pr-3 font-semibold text-neutral-900">
                      {row.bloodGroup}
                    </td>
                    <td className="py-2 pr-3 text-neutral-700">
                      {[row.medicalConditions, row.allergies, row.medications]
                        .filter((value) => !isNothing(value))
                        .join(" · ") || "—"}
                    </td>
                    <td className="py-2 pr-3 text-neutral-700">
                      {row.emergencyContactName} ({row.emergencyContactRelation})
                      <br />
                      <span className="tabular-nums">{row.emergencyContactPhone}</span>
                    </td>
                    <td className="py-2 font-mono text-[10px] text-neutral-500">
                      {row.bookingCode}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-6 border-t border-neutral-200 pt-3 text-[10px] text-neutral-400">
          Contains medical information. Keep with the trip leads; do not leave it on the bus
          or share it outside the club.
        </p>
      </div>

      <Card className="no-print">
        <CardBody className="text-sm text-neutral-600">
          This page is the offline fallback for the QR scanner. Print it before you leave —
          Jawai has patchy signal and you do not want to be looking up someone&apos;s blood
          group on a loading spinner.
        </CardBody>
      </Card>
    </div>
  );
}

/** Treats "none", "n/a", "-" and blanks as nothing declared. */
function isNothing(value: string) {
  const normalised = (value ?? "").trim().toLowerCase();
  return (
    normalised === "" ||
    normalised === "none" ||
    normalised === "no" ||
    normalised === "n/a" ||
    normalised === "na" ||
    normalised === "-" ||
    normalised === "nil"
  );
}
