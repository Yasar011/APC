"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, Inbox, Plus, Settings2, Trash2, Wallet } from "lucide-react";
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
import { newUpiAccountId, upiAccounts } from "@/lib/upi";
import {
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  DEFAULT_FINANCE,
  DEFAULT_SETTINGS,
} from "@/lib/constants";
import { Booking, BookingStatus, TripFinance, TripSettings, UpiAccount } from "@/lib/types";
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

  // Which UPI ID the money actually landed on. Counted from every booking
  // that has been paid, not just confirmed ones, so an ID that has stopped
  // accepting payments shows up before anyone has verified them.
  const paid = bookings.filter(
    (item) => item.status === "PENDING_VERIFICATION" || item.status === "CONFIRMED"
  );
  const byUpi = new Map<string, { count: number; amount: number; name: string }>();
  for (const item of paid) {
    const key = item.payeeUpiId ?? "(not recorded)";
    const entry = byUpi.get(key) ?? { count: 0, amount: 0, name: item.payeeName ?? "" };
    entry.count += 1;
    entry.amount += item.pricing.total;
    if (!entry.name && item.payeeName) entry.name = item.payeeName;
    byUpi.set(key, entry);
  }
  const upiRows = [...byUpi.entries()].sort((a, b) => b[1].count - a[1].count);
  const configuredUpis = upiAccounts(settings);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#16323f]">Bookings</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {pendingCount === 0
              ? "Nothing waiting for verification."
              : `${pendingCount} waiting for verification.`}
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
          Trip settings
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Seats confirmed" value={`${confirmedSeats} / ${settings.totalSeats}`} />
        <Stat label="Waiting to verify" value={String(pendingCount)} />
      </div>

      <Card className="rounded-2xl">
        <CardBody>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#16323f]">Money</h2>
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
                  ? `after ${rupees(totalDiscount)} of promo discounts`
                  : "no promo discounts given"
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

      <Card className="rounded-2xl">
        <CardBody>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#16323f]">
              <Wallet className="h-4 w-4 text-amber-600" />
              Payments by UPI ID
            </h2>
            <p className="text-xs text-neutral-500">
              {configuredUpis.length} account{configuredUpis.length === 1 ? "" : "s"} set up
              &middot; students are spread across them automatically
            </p>
          </div>

          {upiRows.length === 0 ? (
            <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
              Nobody has paid yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="pb-2 pr-4">UPI ID</th>
                    <th className="pb-2 pr-4">Payments</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {upiRows.map(([upiId, row]) => {
                    const configured = configuredUpis.find((a) => a.upiId === upiId);
                    return (
                      <tr key={upiId}>
                        <td className="py-2.5 pr-4">
                          <p className="font-mono text-xs font-medium text-neutral-900">
                            {upiId}
                          </p>
                          {row.name && (
                            <p className="text-xs text-neutral-500">{row.name}</p>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums">{row.count}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{rupees(row.amount)}</td>
                        <td className="py-2.5">
                          {!configured ? (
                            <Badge className="bg-neutral-200 text-neutral-600">
                              No longer listed
                            </Badge>
                          ) : configured.active === false ? (
                            <Badge className="bg-amber-100 text-amber-800">Paused</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {configuredUpis.filter((a) => a.active !== false).length === 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              No UPI account is accepting payments. Students can&apos;t pay until you add or
              un-pause one in Trip settings.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === item.key
                ? "bg-[#16323f] text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {item.label}
            {item.key === "PENDING_VERIFICATION" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-neutral-950">
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
        <Card className="overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#eef1f3] text-left text-xs uppercase tracking-wider text-neutral-500">
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
                        className="inline-flex items-center rounded-full bg-[#16323f] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0f242e]"
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
    neutral: "text-[#16323f]",
    good: "text-emerald-700",
    bad: "text-red-700",
  } as const;

  return (
    <div className="rounded-xl border border-neutral-200 p-4">
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
    <div className="rounded-2xl bg-[#eef1f3] p-5">
      <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tabular-nums text-[#16323f]">{value}</p>
    </div>
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

  function updateAccount(index: number, patch: Partial<UpiAccount>) {
    setForm((current) => ({
      ...current,
      upiAccounts: upiAccounts(current).map((account, i) =>
        i === index ? { ...account, ...patch } : account
      ),
    }));
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
        <div className="rounded-xl border border-neutral-200 p-4 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <Wallet className="h-3.5 w-3.5" />
                UPI accounts
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Students are spread evenly across these, so no single ID takes all 89
                payments. Pause one to stop new students being sent to it — bookings that
                already used it keep their record.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  upiAccounts: [
                    ...upiAccounts(current),
                    {
                      id: newUpiAccountId(),
                      upiId: "",
                      payeeName: "",
                      qrUrl: null,
                      active: true,
                    },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Add UPI ID
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {upiAccounts(form).length === 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                No UPI accounts yet. Students can&apos;t pay until you add at least one.
              </p>
            )}

            {upiAccounts(form).map((account, index) => (
              <div
                key={account.id}
                className={`rounded-lg border p-3 ${
                  account.active === false
                    ? "border-neutral-200 bg-neutral-50 opacity-70"
                    : "border-neutral-200"
                }`}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={`UPI ID ${index + 1}`}>
                    <Input
                      value={account.upiId}
                      placeholder="name@okhdfcbank"
                      onChange={(e) => updateAccount(index, { upiId: e.target.value })}
                    />
                  </Field>
                  <Field label="Payee name">
                    <Input
                      value={account.payeeName}
                      placeholder="Shown to the student"
                      onChange={(e) => updateAccount(index, { payeeName: e.target.value })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field
                      label="QR image URL"
                      hint="Optional — leave blank and a UPI QR is generated with the exact amount already in it."
                    >
                      <Input
                        value={account.qrUrl ?? ""}
                        onChange={(e) =>
                          updateAccount(index, { qrUrl: e.target.value || null })
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={account.active !== false}
                      onChange={(e) => updateAccount(index, { active: e.target.checked })}
                      className="h-3.5 w-3.5 accent-amber-500"
                    />
                    Accepting new students
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        upiAccounts: upiAccounts(current).filter((_, i) => i !== index),
                      }))
                    }
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Field label="Trip lead name">
          <Input
            value={form.contactName}
            onChange={(e) => set("contactName", e.target.value)}
          />
        </Field>
        <Field label="Trip lead role" hint="Shown next to the name.">
          <Input
            value={form.contactRole ?? ""}
            onChange={(e) => set("contactRole", e.target.value)}
            placeholder="APC President"
          />
        </Field>
        <Field
          label="Trip lead WhatsApp"
          hint="Students message this number, with the question pre-typed."
        >
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
            Every seat collects {rupees(form.pricePerPerson)}, of which{" "}
            {rupees(costForm.baseCostPerPerson)} is trip cost and{" "}
            <span
              className={
                marginPerSeat < 0
                  ? "font-semibold text-red-700"
                  : "font-semibold text-emerald-700"
              }
            >
              {rupees(marginPerSeat)}
            </span>{" "}
            is what the club keeps. A promo code comes out of that margin, so anything over{" "}
            {rupees(Math.max(0, marginPerSeat))} puts a booking below cost.
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
