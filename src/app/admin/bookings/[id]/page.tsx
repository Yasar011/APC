"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Droplet,
  ExternalLink,
  Phone,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { PriceBreakdown } from "@/components/trip/PriceBreakdown";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  FullPageSpinner,
  Modal,
  Textarea,
} from "@/components/ui/primitives";
import {
  confirmBooking,
  readBooking,
  readPromo,
  readSettings,
  rejectBooking,
} from "@/lib/trip";
import { quote } from "@/lib/pricing";
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS, DEFAULT_SETTINGS } from "@/lib/constants";
import { Booking, PricingBreakdown, TripSettings } from "@/lib/types";
import { formatDateTime, rupees } from "@/lib/utils";

/**
 * Totals are calculated in the student's browser, so they are not trusted
 * here. Two checks run before an admin can confirm:
 *
 *  1. internal consistency — does the stored breakdown add up on its own
 *     terms? This catches tampering and is immune to later price changes.
 *  2. against current settings — what would this booking cost today? A
 *     difference is usually just a price change since they booked, so it
 *     is reported rather than treated as fraud.
 */
function auditPricing(pricing: PricingBreakdown) {
  const problems: string[] = [];

  if (pricing.subtotal !== pricing.pricePerPerson * pricing.seats) {
    problems.push("Subtotal doesn't match price per person times seats.");
  }
  if (pricing.discount !== Math.max(pricing.groupDiscount, pricing.promoDiscount)) {
    problems.push("Discount isn't the larger of the group and promo discounts.");
  }
  if (pricing.total !== pricing.subtotal - pricing.discount) {
    problems.push("Total doesn't equal subtotal minus discount.");
  }
  if (pricing.total < 0) problems.push("Total is negative.");

  return problems;
}

export default function AdminBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params?.id;
  const { user, displayName } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS as TripSettings);
  const [recomputed, setRecomputed] = useState<PricingBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!bookingId) return;
    try {
      const [found, tripSettings] = await Promise.all([
        readBooking(bookingId),
        readSettings(),
      ]);
      setSettings(tripSettings);
      if (!found) {
        setLoadError("That booking doesn't exist.");
        return;
      }
      setBooking(found);

      const promo = found.pricing.promoCode
        ? await readPromo(found.pricing.promoCode)
        : null;
      setRecomputed(quote(found.seats, tripSettings, promo));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load this booking.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve() {
    if (!booking || !user) return;
    setBusy(true);
    try {
      const tickets = await confirmBooking(booking, user.uid, displayName);
      toast.success(
        `Confirmed — ${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"} issued.`
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm this booking.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!booking || !user || !reason.trim()) return;
    setBusy(true);
    try {
      await rejectBooking(booking, reason.trim(), user.uid, displayName);
      toast.success("Rejected — the student can re-upload.");
      setRejectOpen(false);
      setReason("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reject this booking.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <FullPageSpinner />;

  if (loadError || !booking) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Couldn't open this booking"
        description={loadError ?? undefined}
        action={
          <Link href="/admin">
            <Button variant="outline">Back to bookings</Button>
          </Link>
        }
      />
    );
  }

  const problems = auditPricing(booking.pricing);
  const differsFromToday = recomputed && recomputed.total !== booking.pricing.total;
  const canDecide =
    booking.status === "PENDING_VERIFICATION" || booking.status === "AWAITING_PAYMENT";

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All bookings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-semibold text-neutral-900">
            {booking.bookingCode}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {booking.bookerName} &middot; {booking.bookerEmail} &middot; {booking.seats}{" "}
            {booking.seats === 1 ? "seat" : "seats"}
          </p>
        </div>
        <Badge className={BOOKING_STATUS_COLORS[booking.status]}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------------------------ payment proof */}
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-neutral-900">Payment proof</h2>

            {booking.paymentScreenshotUrl ? (
              <>
                <a
                  href={booking.paymentScreenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block overflow-hidden rounded-lg border border-neutral-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={booking.paymentScreenshotUrl}
                    alt="Payment screenshot"
                    className="max-h-[460px] w-full bg-neutral-50 object-contain"
                  />
                </a>
                <a
                  href={booking.paymentScreenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
                >
                  Open full size
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            ) : (
              <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                No screenshot uploaded yet.
              </p>
            )}

            {booking.paymentRef && (
              <p className="mt-4 text-sm">
                <span className="text-neutral-500">UPI reference:</span>{" "}
                <span className="font-mono text-neutral-900">{booking.paymentRef}</span>
              </p>
            )}
          </CardBody>
        </Card>

        {/* ------------------------------------------------------- amount */}
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="mb-4 text-sm font-semibold text-neutral-900">
                Amount to check against the screenshot
              </h2>
              <PriceBreakdown pricing={booking.pricing} groupSize={settings.groupSize} />

              <p className="mt-4 rounded-lg bg-neutral-900 px-4 py-3 text-center text-lg font-semibold text-white">
                Expect {rupees(booking.pricing.total)}
              </p>

              {problems.length > 0 && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                    <ShieldAlert className="h-4 w-4" />
                    This breakdown doesn&apos;t add up
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-700">
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-red-700">
                    Do not confirm without checking what was actually paid.
                  </p>
                </div>
              )}

              {problems.length === 0 && differsFromToday && recomputed && (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  At today&apos;s settings this booking would cost{" "}
                  {rupees(recomputed.total)}. Usually that just means the price or discount
                  changed after they booked — go by what they actually paid.
                </p>
              )}
            </CardBody>
          </Card>

          {canDecide && (
            <Card>
              <CardBody className="space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={approve}
                  loading={busy}
                  disabled={!booking.paymentScreenshotUrl}
                >
                  <Check className="h-4 w-4" />
                  Confirm and issue {booking.seats}{" "}
                  {booking.seats === 1 ? "ticket" : "tickets"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setRejectOpen(true)}
                  disabled={busy}
                >
                  <X className="h-4 w-4" />
                  Reject payment
                </Button>
                {!booking.paymentScreenshotUrl && (
                  <p className="text-center text-xs text-neutral-500">
                    Nothing to verify yet — the student hasn&apos;t uploaded a screenshot.
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {booking.verifiedAt && (
            <p className="text-xs text-neutral-500">
              {BOOKING_STATUS_LABELS[booking.status]} by {booking.verifiedByName} on{" "}
              {formatDateTime(booking.verifiedAt)}
              {booking.rejectionReason ? ` — "${booking.rejectionReason}"` : ""}
            </p>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- travellers */}
      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-neutral-900">
            Travellers and medical details
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {booking.travellers.map((traveller, index) => (
              <div
                key={index}
                className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {traveller.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {traveller.niftId} &middot; {traveller.programme} &middot; Sem{" "}
                      {traveller.semester} &middot; {traveller.age}
                    </p>
                  </div>
                  <Badge className="bg-red-100 text-red-800">
                    <Droplet className="mr-1 h-3 w-3" />
                    {traveller.bloodGroup}
                  </Badge>
                </div>

                <dl className="mt-3 space-y-1.5 text-xs">
                  <Row label="Phone" value={traveller.phone} />
                  <Row label="Conditions" value={traveller.medicalConditions} />
                  <Row label="Allergies" value={traveller.allergies} />
                  <Row label="Medication" value={traveller.medications} />
                  <Row
                    label="Emergency"
                    value={`${traveller.emergencyContactName} (${traveller.emergencyContactRelation}) — ${traveller.emergencyContactPhone}`}
                  />
                </dl>
              </div>
            ))}
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
            <Phone className="h-3.5 w-3.5" />
            Booker: {booking.bookerName} — {booking.bookerPhone}
          </p>
        </CardBody>
      </Card>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject this payment"
      >
        <p className="text-sm text-neutral-600">
          The student sees this reason on their booking page and can upload a corrected
          screenshot without starting over.
        </p>
        <div className="mt-4">
          <Field label="Reason" required>
            <Textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Screenshot shows 2099 but 10396 is due for 5 seats."
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRejectOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={reject} loading={busy} disabled={!reason.trim()}>
            Reject
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-neutral-800">{value || "—"}</dd>
    </div>
  );
}
