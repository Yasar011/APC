"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Check,
  CircleAlert,
  Clock,
  LogOut,
  Mountain,
  Printer,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { PriceBreakdown } from "@/components/trip/PriceBreakdown";
import { TicketCard } from "@/components/trip/TicketCard";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  FullPageSpinner,
  Input,
} from "@/components/ui/primitives";
import { attachPayment, readBooking, readSettings, readTicketsForBooking } from "@/lib/trip";
import { uploadScreenshot, validateScreenshot } from "@/lib/storage";
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS, DEFAULT_SETTINGS } from "@/lib/constants";
import { Booking, Ticket, TripSettings } from "@/lib/types";
import { formatDateTime, rupees } from "@/lib/utils";
import { qrDataUrl } from "@/lib/qr";

export default function BookingPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params?.id;
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS as TripSettings);
  const [groupQr, setGroupQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [paymentRef, setPaymentRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/login?next=/booking/${bookingId}`);
  }, [authLoading, user, bookingId, router]);

  const load = useCallback(async () => {
    if (!user || !bookingId) return;
    try {
      const [found, tripSettings] = await Promise.all([
        readBooking(bookingId),
        readSettings(),
      ]);
      setSettings(tripSettings);

      if (!found) {
        setLoadError("That booking doesn't exist, or you don't have access to it.");
        return;
      }
      setBooking(found);
      setPaymentRef(found.paymentRef || "");

      if (found.status === "CONFIRMED") {
        const [issued, qr] = await Promise.all([
          readTicketsForBooking(found.id),
          qrDataUrl(found.bookingCode, 220),
        ]);
        setTickets(issued);
        setGroupQr(qr);
      }
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load this booking."
      );
    } finally {
      setLoading(false);
    }
  }, [user, bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function resubmitPayment() {
    if (!user || !booking || !file) return;
    setSaving(true);
    try {
      const url = await uploadScreenshot(user.uid, booking.id, file);
      await attachPayment(booking.id, url, paymentRef.trim());
      toast.success("Sent for approval again.");
      setFile(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user || loading) return <FullPageSpinner />;

  if (loadError || !booking) {
    return (
      <Shell onSignOut={signOut}>
        <Card>
          <CardBody className="text-center">
            <CircleAlert className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-3 text-sm font-medium text-neutral-900">
              Couldn&apos;t open this booking
            </p>
            <p className="mt-1 text-sm text-neutral-500">{loadError}</p>
            <Link href="/">
              <Button variant="outline" className="mt-5">
                Back to the trip page
              </Button>
            </Link>
          </CardBody>
        </Card>
      </Shell>
    );
  }

  const confirmed = booking.status === "CONFIRMED";

  return (
    <Shell onSignOut={signOut}>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            {settings.tripName || "Jawai Safari"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Booking {booking.bookingCode} &middot; {booking.seats}{" "}
            {booking.seats === 1 ? "seat" : "seats"}
          </p>
        </div>
        <Badge className={BOOKING_STATUS_COLORS[booking.status]}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </Badge>
      </div>

      {booking.status === "PENDING_VERIFICATION" && (
        <StatusNote
          icon={Clock}
          tone="amber"
          title="Waiting for an admin to check your payment"
          body="You'll see your tickets here as soon as it's approved. Nothing else to do for now."
        />
      )}

      {booking.status === "AWAITING_PAYMENT" && (
        <StatusNote
          icon={CircleAlert}
          tone="neutral"
          title="Payment not sent yet"
          body="Upload your payment screenshot below to send this booking for approval."
        />
      )}

      {booking.status === "REJECTED" && (
        <StatusNote
          icon={XCircle}
          tone="red"
          title="Payment was rejected"
          body={
            booking.rejectionReason ||
            "The admin couldn't verify your payment. Upload a corrected screenshot below."
          }
        />
      )}

      {confirmed && (
        <>
          <StatusNote
            icon={Check}
            tone="emerald"
            title="You're confirmed"
            body={`Approved by ${booking.verifiedByName ?? "an admin"} on ${formatDateTime(
              booking.verifiedAt
            )}. Bring these QR codes to the bus.`}
          />

          <div className="no-print mb-6 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print tickets
            </Button>
          </div>

          {groupQr && (
            <Card className="print-break mb-6">
              <CardBody className="flex flex-col items-center text-center sm:flex-row sm:text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={groupQr}
                  alt={`Group QR for booking ${booking.bookingCode}`}
                  className="h-36 w-36 shrink-0"
                />
                <div className="mt-4 sm:ml-6 sm:mt-0">
                  <p className="text-sm font-semibold text-neutral-900">
                    Group check-in code
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    One scan checks in everyone on this booking. Handy if you all board
                    together — otherwise each person can use their own QR below.
                  </p>
                  <p className="mt-3 font-mono text-lg font-semibold tracking-[0.2em] text-neutral-900">
                    {booking.bookingCode}
                  </p>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.ticketCode} ticket={ticket} />
            ))}
          </div>
        </>
      )}

      {(booking.status === "AWAITING_PAYMENT" || booking.status === "REJECTED") && (
        <Card className="no-print mt-6">
          <CardBody className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">
              Upload your payment screenshot
            </h2>

            {settings.upiId && (
              <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                Pay {rupees(booking.pricing.total)} to{" "}
                <span className="font-semibold">{settings.upiId}</span>
              </p>
            )}

            <Field label="UPI reference number" required>
              <Input
                value={paymentRef}
                onChange={(event) => setPaymentRef(event.target.value)}
                required
              />
            </Field>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                if (!picked) return;
                const error = validateScreenshot(picked);
                if (error) {
                  toast.error(error);
                  event.target.value = "";
                  return;
                }
                setFile(picked);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              {file ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  {file.name}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Choose screenshot
                </>
              )}
            </button>

            <Button
              className="w-full"
              onClick={resubmitPayment}
              loading={saving}
              disabled={!file || !paymentRef.trim()}
            >
              Send for approval
            </Button>
          </CardBody>
        </Card>
      )}

      <Card className="no-print mt-6">
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">What you paid</h2>
          <PriceBreakdown pricing={booking.pricing} groupSize={settings.groupSize} />
        </CardBody>
      </Card>

      <Card className="no-print mt-6">
        <CardBody>
          <h2 className="text-sm font-semibold text-neutral-900">Who&apos;s going</h2>
          <ul className="mt-4 divide-y divide-neutral-100">
            {booking.travellers.map((traveller, index) => (
              <li key={index} className="py-3">
                <p className="text-sm font-medium text-neutral-900">{traveller.name}</p>
                <p className="text-xs text-neutral-500">
                  {traveller.niftId} &middot; {traveller.phone} &middot; Blood group{" "}
                  {traveller.bloodGroup}
                </p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </Shell>
  );
}

function StatusNote({
  icon: Icon,
  tone,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "amber" | "red" | "emerald" | "neutral";
  title: string;
  body: string;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    neutral: "border-neutral-200 bg-neutral-50 text-neutral-800",
  } as const;

  return (
    <div className={`mb-6 flex gap-3 rounded-xl border p-4 ${tones[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm opacity-90">{body}</p>
      </div>
    </div>
  );
}

function Shell({
  children,
  onSignOut,
}: {
  children: React.ReactNode;
  onSignOut: () => Promise<void>;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="no-print border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-neutral-900"
          >
            <Mountain className="h-5 w-5 text-amber-500" />
            Jawai Safari
          </Link>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
