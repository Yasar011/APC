"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, Inbox, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  FullPageSpinner,
  Input,
  Modal,
  Select,
} from "@/components/ui/primitives";
import { listBookings, readSettings, saveSettings } from "@/lib/trip";
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS, DEFAULT_SETTINGS } from "@/lib/constants";
import { Booking, BookingStatus, TripSettings } from "@/lib/types";
import { formatDateTime, rupees } from "@/lib/utils";

const FILTERS: { key: BookingStatus | "ALL"; label: string }[] = [
  { key: "PENDING_VERIFICATION", label: "To verify" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "AWAITING_PAYMENT", label: "Unpaid" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS as TripSettings);
  const [filter, setFilter] = useState<BookingStatus | "ALL">("PENDING_VERIFICATION");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [allBookings, tripSettings] = await Promise.all([
        listBookings(),
        readSettings(),
      ]);
      setBookings(allBookings);
      setSettings(tripSettings);
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load bookings."
      );
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
        title="Couldn't load bookings"
        description={loadError}
        action={<Button onClick={load}>Try again</Button>}
      />
    );
  }

  const visible =
    filter === "ALL" ? bookings : bookings.filter((item) => item.status === filter);
  const pendingCount = bookings.filter(
    (item) => item.status === "PENDING_VERIFICATION"
  ).length;
  const confirmedSeats = bookings
    .filter((item) => item.status === "CONFIRMED")
    .reduce((sum, item) => sum + item.seats, 0);
  const collected = bookings
    .filter((item) => item.status === "CONFIRMED")
    .reduce((sum, item) => sum + item.pricing.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Bookings</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {pendingCount} waiting for verification
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
          Trip settings
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Seats confirmed" value={`${confirmedSeats} / ${settings.totalSeats}`} />
        <Stat label="To verify" value={String(pendingCount)} />
        <Stat label="Collected" value={rupees(collected)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === item.key
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {item.label}
            {item.key === "PENDING_VERIFICATION" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-neutral-950">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing here"
          description="No bookings match this filter yet."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Booker</th>
                  <th className="px-4 py-3">Seats</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visible.map((booking) => (
                  <tr key={booking.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-xs">{booking.bookingCode}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{booking.bookerName}</p>
                      <p className="text-xs text-neutral-500">{booking.bookerEmail}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{booking.seats}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {rupees(booking.pricing.total)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={BOOKING_STATUS_COLORS[booking.status]}>
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {formatDateTime(booking.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="text-xs font-medium text-amber-700 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSaved={(next) => {
          setSettings(next);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody className="py-4">
        <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      </CardBody>
    </Card>
  );
}

function SettingsModal({
  open,
  onClose,
  settings,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  settings: TripSettings;
  onSaved: (next: TripSettings) => void;
}) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings, open]);

  function set<K extends keyof TripSettings>(key: K, value: TripSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await saveSettings(form);
      toast.success("Trip settings saved");
      onSaved({ ...form, updatedAt: Date.now() });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save. Check your admin access."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Trip settings" className="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Trip name">
          <Input value={form.tripName} onChange={(e) => set("tripName", e.target.value)} />
        </Field>
        <Field label="Destination">
          <Input
            value={form.destination}
            onChange={(e) => set("destination", e.target.value)}
          />
        </Field>
        <Field label="Start date">
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </Field>
        <Field label="End date">
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </Field>
        <Field label="Price per person">
          <Input
            type="number"
            value={form.pricePerPerson}
            onChange={(e) => set("pricePerPerson", Number(e.target.value))}
          />
        </Field>
        <Field label="Seats for the group discount">
          <Input
            type="number"
            value={form.groupSize}
            onChange={(e) => set("groupSize", Number(e.target.value))}
          />
        </Field>
        <Field label="Group discount (off the whole booking)">
          <Input
            type="number"
            value={form.groupDiscountAmount}
            onChange={(e) => set("groupDiscountAmount", Number(e.target.value))}
          />
        </Field>
        <Field label="Max seats per booking">
          <Input
            type="number"
            value={form.maxSeatsPerBooking}
            onChange={(e) => set("maxSeatsPerBooking", Number(e.target.value))}
          />
        </Field>
        <Field label="Total seats on the trip">
          <Input
            type="number"
            value={form.totalSeats}
            onChange={(e) => set("totalSeats", Number(e.target.value))}
          />
        </Field>
        <Field label="Bookings open?">
          <Select
            value={form.bookingsOpen ? "yes" : "no"}
            onChange={(e) => set("bookingsOpen", e.target.value === "yes")}
          >
            <option value="yes">Open</option>
            <option value="no">Closed</option>
          </Select>
        </Field>
        <Field label="UPI ID">
          <Input value={form.upiId} onChange={(e) => set("upiId", e.target.value)} />
        </Field>
        <Field label="UPI payee name">
          <Input
            value={form.upiPayeeName}
            onChange={(e) => set("upiPayeeName", e.target.value)}
          />
        </Field>
        <Field label="Payment QR image URL" hint="Optional — shown on the payment step.">
          <Input
            value={form.paymentQrUrl ?? ""}
            onChange={(e) => set("paymentQrUrl", e.target.value || null)}
          />
        </Field>
        <Field label="Trip lead name">
          <Input
            value={form.contactName}
            onChange={(e) => set("contactName", e.target.value)}
          />
        </Field>
        <Field label="Trip lead phone">
          <Input
            value={form.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
          />
        </Field>
        <Field label="Pickup point">
          <Input
            value={form.pickupPoint}
            onChange={(e) => set("pickupPoint", e.target.value)}
          />
        </Field>
        <Field label="Departure time">
          <Input
            value={form.departureTime}
            onChange={(e) => set("departureTime", e.target.value)}
            placeholder="e.g. 5:30 AM"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Tagline" hint="One line under the title on the public page.">
            <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving}>
          Save settings
        </Button>
      </div>
    </Modal>
  );
}
