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
import { listBookings, readFinance, readSettings, saveFinance, saveSettings } from "@/lib/trip";
import { profit } from "@/lib/pricing";
import {
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  DEFAULT_FINANCE,
  DEFAULT_SETTINGS,
} from "@/lib/constants";
import { Booking, BookingStatus, TripFinance, TripSettings } from "@/lib/types";
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
  const [finance, setFinance] = useState<TripFinance>(DEFAULT_FINANCE as TripFinance);
  const [filter, setFilter] = useState<BookingStatus | "ALL">("PENDING_VERIFICATION");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [allBookings, tripSettings, tripFinance] = await Promise.all([
        listBookings(),
        readSettings(),
        readFinance(),
      ]);
      setBookings(allBookings);
      setSettings(tripSettings);
      setFinance(tripFinance);
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
  // Cost and profit are tracked separately: 2099 a seat is really 2000 of
  // trip cost plus the club's margin, and a discount comes out of the
  // margin rather than the cost.
  const confirmed = bookings.filter((item) => item.status === "CONFIRMED");
  const books = confirmed.map((item) => profit(item.pricing, finance));
  const collected = books.reduce((sum, item) => sum + item.collected, 0);
  const totalCost = books.reduce((sum, item) => sum + item.cost, 0);
  const totalDiscount = books.reduce((sum, item) => sum + item.discount, 0);
  const netProfit = books.reduce((sum, item) => sum + item.netProfit, 0);

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Seats confirmed" value={`${confirmedSeats} / ${settings.totalSeats}`} />
        <Stat label="Waiting to verify" value={String(pendingCount)} />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Money</h2>
            <p className="text-xs text-neutral-500">
              Confirmed bookings only &middot; {rupees(finance.baseCostPerPerson)} of every{" "}
              {rupees(settings.pricePerPerson)} seat is trip cost
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Money label="Collected" value={collected} tone="neutral" />
            <Money label="Trip cost" value={totalCost} tone="neutral" hint="Goes back out" />
            <Money
              label="Club keeps"
              value={netProfit}
              tone={netProfit < 0 ? "bad" : "good"}
              hint={
                totalDiscount > 0
                  ? `after ${rupees(totalDiscount)} of discounts`
                  : "no discounts given"
              }
            />
          </div>

          {netProfit < 0 && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
              Confirmed bookings are collectively below cost. Check the promo codes —
              a discount larger than the margin is paid for by the club.
            </p>
          )}
        </CardBody>
      </Card>

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
        finance={finance}
        onSaved={(nextSettings, nextFinance) => {
          setSettings(nextSettings);
          setFinance(nextFinance);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

function Money({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "neutral" | "good" | "bad";
  hint?: string;
}) {
  const tones = {
    neutral: "text-neutral-900",
    good: "text-emerald-700",
    bad: "text-red-700",
  } as const;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
      <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>
        {rupees(value)}
      </p>
      {hint && <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>}
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
  finance,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  settings: TripSettings;
  finance: TripFinance;
  onSaved: (settings: TripSettings, finance: TripFinance) => void;
}) {
  const [form, setForm] = useState(settings);
  const [costForm, setCostForm] = useState(finance);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
    setCostForm(finance);
  }, [settings, finance, open]);

  function set<K extends keyof TripSettings>(key: K, value: TripSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      // Two writes: the public settings, and the admin-only cost figure
      // that must never end up in a world-readable node.
      await Promise.all([saveSettings(form), saveFinance(costForm)]);
      toast.success("Trip settings saved");
      onSaved({ ...form, updatedAt: Date.now() }, { ...costForm, updatedAt: Date.now() });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save. Check your admin access."
      );
    } finally {
      setSaving(false);
    }
  }

  const marginPerSeat = form.pricePerPerson - costForm.baseCostPerPerson;

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
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Cost and profit
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Admins only. This is stored separately from the public settings, so the
            margin is never readable by students.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="What a seat costs the club"
              hint="Bus, stay, safari - the part that goes straight back out."
            >
              <Input
                type="number"
                value={costForm.baseCostPerPerson}
                onChange={(e) =>
                  setCostForm({ ...costForm, baseCostPerPerson: Number(e.target.value) })
                }
              />
            </Field>

            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-800">
                Margin per seat
              </p>
              <p
                className={`flex h-10 items-center rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold tabular-nums ${
                  marginPerSeat < 0 ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {rupees(marginPerSeat)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {rupees(form.pricePerPerson)} price &minus;{" "}
                {rupees(costForm.baseCostPerPerson)} cost
              </p>
            </div>
          </div>

          <p className="mt-4 rounded-lg bg-white px-3 py-2 text-xs text-neutral-600">
            A full group of {form.groupSize} collects{" "}
            {rupees(form.pricePerPerson * form.groupSize - form.groupDiscountAmount)}, of
            which {rupees(costForm.baseCostPerPerson * form.groupSize)} is trip cost and{" "}
            <span
              className={
                marginPerSeat * form.groupSize - form.groupDiscountAmount < 0
                  ? "font-semibold text-red-700"
                  : "font-semibold text-emerald-700"
              }
            >
              {rupees(marginPerSeat * form.groupSize - form.groupDiscountAmount)}
            </span>{" "}
            is what the club keeps after the {rupees(form.groupDiscountAmount)} group
            discount.
          </p>
        </div>

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
