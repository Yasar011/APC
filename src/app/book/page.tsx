"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  Check,
  CircleAlert,
  Mountain,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TravellerForm, emptyTraveller } from "@/components/trip/TravellerForm";
import { PriceBreakdown } from "@/components/trip/PriceBreakdown";
import { PaymentForm } from "@/components/trip/PaymentForm";
import { VerifyEmailNotice } from "@/components/trip/VerifyEmailNotice";
import { ClaimBookingNotice } from "@/components/trip/ClaimBookingNotice";
import {
  Button,
  Card,
  CardBody,
  FullPageSpinner,
  Input,
} from "@/components/ui/primitives";
import { normalisePromoCode, newBookingCode } from "@/lib/codes";
import { promoRejectionReason, quote } from "@/lib/pricing";
import {
  createBooking,
  isNiftIdTaken,
  readMyBooking,
  readPromo,
  readSettings,
} from "@/lib/trip";
import { activeUpiAccounts, pickUpiForUser } from "@/lib/upi";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { Booking, PromoCode, Traveller, TripSettings, UpiAccount } from "@/lib/types";
import { rupees } from "@/lib/utils";

type Step = "details" | "review" | "pay";

export default function BookPage() {
  const router = useRouter();
  const { user, loading: authLoading, displayName, emailVerified } = useAuth();

  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS as TripSettings);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("details");
  const [traveller, setTraveller] = useState<Traveller>(emptyTraveller());
  const [checkingId, setCheckingId] = useState(false);

  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [payee, setPayee] = useState<UpiAccount | null>(null);
  const [payingBooking, setPayingBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/book");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [tripSettings, existing] = await Promise.all([
        readSettings(),
        readMyBooking(user.uid),
      ]);
      setSettings(tripSettings);

      // One booking per account. A rejected one is fixed in place on its own
      // page, so send them there rather than starting over.
      if (existing && existing.status !== "CANCELLED") {
        router.replace(`/booking/${existing.id}`);
        return;
      }
      setLoadError(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load the trip details."
      );
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Prefill what we already know about the person booking.
  useEffect(() => {
    setTraveller((current) => {
      if (!user || current.name) return current;
      return { ...current, name: user.displayName || "" };
    });
  }, [user]);

  const pricing = useMemo(() => quote(settings, promo), [settings, promo]);

  async function applyPromo() {
    const code = normalisePromoCode(promoInput);
    if (!code) return;
    setCheckingPromo(true);
    try {
      const found = await readPromo(code);
      const rejection = promoRejectionReason(found);
      if (rejection || !found) {
        setPromo(null);
        toast.error(rejection ?? "That promo code doesn't exist.");
        return;
      }
      setPromo(found);
      toast.success(`Promo applied — ${rupees(quote(settings, found).promoDiscount)} off.`);
    } catch {
      toast.error("Couldn't check that code. Try again.");
    } finally {
      setCheckingPromo(false);
    }
  }

  /**
   * A NIFT ID gets one seat. Checked before moving on so the student is told
   * plainly rather than hitting a permission error at the end; the rules
   * enforce it for real when the booking is written.
   */
  async function goToReview(event: React.FormEvent) {
    if (!emailVerified) {
      event.preventDefault();
      toast.error("Verify your email address first — the ticket is emailed to it.");
      return;
    }
    event.preventDefault();
    setCheckingId(true);
    try {
      if (await isNiftIdTaken(traveller.niftId)) {
        toast.error(
          `${traveller.niftId} already has a seat on this trip. One seat per NIFT ID.`
        );
        return;
      }
      setStep("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // Don't block on a failed check — the rules stop a duplicate anyway.
      setStep("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setCheckingId(false);
    }
  }

  /** Creates the booking up front so a paid-but-unsubmitted one still exists. */
  async function startPayment() {
    if (!user) return;

    // Refuse rather than create a booking nobody can be told where to pay.
    // A booking with no payee recorded is money that cannot be traced back.
    const account = pickUpiForUser(settings, user.uid);
    if (!account) {
      toast.error("Payments aren't set up yet — message the trip leads before booking.");
      return;
    }

    setSaving(true);
    try {
      const now = Date.now();
      const code = newBookingCode();
      const draft: Omit<Booking, "id"> = {
        bookerUid: user.uid,
        bookerName: traveller.name || displayName,
        bookerEmail: user.email ?? "",
        bookerPhone: traveller.phone,
        niftId: traveller.niftId,
        seats: 1,
        travellers: [traveller],
        pricing,
        paymentScreenshotUrl: null,
        paymentRef: "",
        payeeUpiId: account?.upiId ?? null,
        payeeName: account?.payeeName ?? null,
        status: "AWAITING_PAYMENT",
        rejectionReason: null,
        bookingCode: code,
        verifiedBy: null,
        verifiedByName: null,
        verifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const id = await createBooking(draft);
      setBookingId(id);
      setBookingCode(code);
      // Handed straight to <PaymentForm />, which needs a real booking to
      // work out what is still owed.
      setPayingBooking({ ...draft, id });
      setPayee(account);
      setStep("pay");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save your booking.";
      // A rules rejection here almost always means the ID was claimed
      // between the check and the write.
      toast.error(
        message.toLowerCase().includes("permission")
          ? `Couldn't book ${traveller.niftId} — that NIFT ID may already have a seat.`
          : message
      );
    } finally {
      setSaving(false);
    }
  }


  if (authLoading || !user || loading) return <FullPageSpinner />;

  if (loadError) {
    return (
      <Shell>
        <Card>
          <CardBody className="text-center">
            <CircleAlert className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-3 text-sm font-medium text-neutral-900">
              Couldn&apos;t load the trip
            </p>
            <p className="mt-1 text-sm text-neutral-500">{loadError}</p>
            <Button className="mt-5" onClick={() => location.reload()}>
              Try again
            </Button>
          </CardBody>
        </Card>
      </Shell>
    );
  }

  if (!settings.bookingsOpen) {
    return (
      <Shell>
        <Card>
          <CardBody className="text-center">
            <p className="text-sm font-medium text-neutral-900">Bookings are closed</p>
            <p className="mt-1 text-sm text-neutral-500">
              Seats for {settings.tripName} aren&apos;t open right now.
            </p>
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

  const seatsLeft = Math.max(0, settings.totalSeats - settings.seatsBooked);
  const noPaymentAccount = activeUpiAccounts(settings).length === 0;

  return (
    <Shell>
      <VerifyEmailNotice blocking />
      <ClaimBookingNotice />
      {emailVerified && <Stepper step={step} />}

      {emailVerified && step === "details" && (
        <form onSubmit={goToReview} className="space-y-6">
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Your seat</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  One seat per NIFT ID.
                  {seatsLeft > 0 && ` ${seatsLeft} of ${settings.totalSeats} left.`}
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-neutral-900">
                {rupees(settings.pricePerPerson)}
              </p>
            </CardBody>
          </Card>

          <TravellerForm
            index={0}
            traveller={traveller}
            isBooker
            onChange={setTraveller}
          />

          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={checkingId}>
              Review booking
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {emailVerified && step === "review" && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-neutral-900">Your details</h2>
              <div className="mt-3 text-sm">
                <p className="font-medium text-neutral-900">{traveller.name}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {traveller.niftId} &middot; {traveller.phone} &middot; Blood group{" "}
                  {traveller.bloodGroup}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Emergency: {traveller.emergencyContactName} (
                  {traveller.emergencyContactRelation}) —{" "}
                  {traveller.emergencyContactPhone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("details")}
                className="mt-3 text-xs font-medium text-amber-700 hover:underline"
              >
                Edit details
              </button>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-neutral-900">Promo code</h2>
              <div className="mt-3 flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value)}
                  placeholder="Enter a code"
                  className="uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyPromo}
                  loading={checkingPromo}
                  disabled={!promoInput.trim()}
                >
                  Apply
                </Button>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Optional. Leave it blank if you don&apos;t have one.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-4 text-sm font-semibold text-neutral-900">What you pay</h2>
              <PriceBreakdown pricing={pricing} />
            </CardBody>
          </Card>

          {noPaymentAccount && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Payments aren&apos;t set up yet, so there&apos;s nowhere to send the money.
              Message the trip leads
              {settings.contactPhone ? ` on ${settings.contactPhone}` : ""} before booking.
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep("details")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              size="lg"
              onClick={startPayment}
              loading={saving}
              disabled={noPaymentAccount}
            >
              Continue to payment
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {emailVerified && step === "pay" && bookingId && payingBooking && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <BadgeIndianRupee className="h-4 w-4 text-amber-600" />
                Pay {rupees(pricing.total)}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Booking {bookingCode}. Your seat is held once an admin confirms
                the payment.
              </p>

              <div className="mt-5">
                <PaymentForm
                  booking={payingBooking}
                  settings={settings}
                  payee={payee}
                  onPayeeChange={setPayee}
                  onAdded={() => router.replace(`/booking/${bookingId}`)}
                />
              </div>
            </CardBody>
          </Card>
        </div>
      )}

    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-neutral-900"
          >
            <Mountain className="h-5 w-5 text-amber-500" />
            Jawai Safari
          </Link>
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
            Cancel
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "review", label: "Review" },
    { key: "pay", label: "Pay" },
  ];
  const activeIndex = steps.findIndex((item) => item.key === step);

  return (
    <ol className="mb-8 flex items-center gap-2 text-xs font-medium">
      {steps.map((item, index) => (
        <li key={item.key} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
              index <= activeIndex
                ? "bg-amber-500 text-neutral-950"
                : "bg-neutral-200 text-neutral-500"
            }`}
          >
            {index < activeIndex ? <Check className="h-3 w-3" /> : index + 1}
          </span>
          <span className={index <= activeIndex ? "text-neutral-900" : "text-neutral-400"}>
            {item.label}
          </span>
          {index < steps.length - 1 && (
            <span className="h-px flex-1 bg-neutral-200" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}
