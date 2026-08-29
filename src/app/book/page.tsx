"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  Check,
  CircleAlert,
  Copy,
  Loader2,
  Minus,
  Mountain,
  Plus,
  Smartphone,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TravellerForm, emptyTraveller } from "@/components/trip/TravellerForm";
import { PriceBreakdown } from "@/components/trip/PriceBreakdown";
import {
  Button,
  Card,
  CardBody,
  Field,
  FullPageSpinner,
  Input,
} from "@/components/ui/primitives";
import { normalisePromoCode, newBookingCode } from "@/lib/codes";
import { promoRejectionReason, quote } from "@/lib/pricing";
import { attachPayment, createBooking, readMyBooking, readPromo, readSettings } from "@/lib/trip";
import { uploadScreenshot, validateScreenshot } from "@/lib/storage";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { PromoCode, Traveller, TripSettings } from "@/lib/types";
import { rupees } from "@/lib/utils";

type Step = "details" | "review" | "pay";

export default function BookPage() {
  const router = useRouter();
  const { user, loading: authLoading, displayName } = useAuth();

  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS as TripSettings);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("details");
  const [seats, setSeats] = useState(1);
  const [travellers, setTravellers] = useState<Traveller[]>([emptyTraveller()]);
  const [bookerPhone, setBookerPhone] = useState("");

  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // One live booking per account. A rejected one can be fixed in place
      // from its own page, so send them there rather than starting over.
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

  // The booker is always traveller 1 — prefill what we already know.
  useEffect(() => {
    setTravellers((current) => {
      if (!user || current[0]?.name) return current;
      const next = [...current];
      next[0] = { ...next[0], name: user.displayName || "" };
      return next;
    });
  }, [user]);

  function changeSeats(delta: number) {
    const next = Math.min(
      settings.maxSeatsPerBooking,
      Math.max(1, seats + delta)
    );
    setSeats(next);
    setTravellers((current) => {
      if (next > current.length) {
        return [
          ...current,
          ...Array.from({ length: next - current.length }, emptyTraveller),
        ];
      }
      return current.slice(0, next);
    });
  }

  const pricing = useMemo(
    () => quote(seats, settings, promo),
    [seats, settings, promo]
  );

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
      const preview = quote(seats, settings, found);
      if (preview.discountApplied === "PROMO") {
        toast.success(`Promo applied — ${rupees(preview.promoDiscount)} off.`);
      } else {
        toast.message("Promo accepted, but your group discount saves more.", {
          description: "Only the bigger discount applies — you're already getting it.",
        });
      }
    } catch {
      toast.error("Couldn't check that code. Try again.");
    } finally {
      setCheckingPromo(false);
    }
  }

  function goToReview(event: React.FormEvent) {
    event.preventDefault();
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Creates the booking up front so a paid-but-unsubmitted booking still exists. */
  async function startPayment() {
    if (!user) return;
    setSaving(true);
    try {
      const now = Date.now();
      const id = await createBooking({
        bookerUid: user.uid,
        bookerName: travellers[0].name || displayName,
        bookerEmail: user.email ?? "",
        bookerPhone: bookerPhone || travellers[0].phone,
        niftId: travellers[0].niftId,
        seats,
        travellers,
        pricing,
        paymentScreenshotUrl: null,
        paymentRef: "",
        status: "AWAITING_PAYMENT",
        rejectionReason: null,
        bookingCode: newBookingCode(),
        verifiedBy: null,
        verifiedByName: null,
        verifiedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      setBookingId(id);
      setStep("pay");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save your booking. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment() {
    if (!user || !bookingId || !file) return;
    setSaving(true);
    try {
      const url = await uploadScreenshot(user.uid, bookingId, file);
      await attachPayment(bookingId, url, paymentRef.trim());
      toast.success("Sent for approval.");
      router.replace(`/booking/${bookingId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed. Check your connection."
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

  return (
    <Shell>
      <Stepper step={step} />

      {step === "details" && (
        <form onSubmit={goToReview} className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-neutral-900">How many seats?</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Up to {settings.maxSeatsPerBooking} students on one booking, including you.
                {seatsLeft > 0 && ` ${seatsLeft} seats left in total.`}
              </p>

              <div className="mt-5 flex items-center gap-5">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => changeSeats(-1)}
                    disabled={seats <= 1}
                    aria-label="One fewer seat"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-2xl font-semibold tabular-nums">
                    {seats}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => changeSeats(1)}
                    disabled={seats >= settings.maxSeatsPerBooking}
                    aria-label="One more seat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-sm">
                  <p className="font-semibold text-neutral-900">{rupees(pricing.total)}</p>
                  {pricing.discount > 0 && (
                    <p className="text-emerald-700">
                      {rupees(pricing.discount)} off applied
                    </p>
                  )}
                </div>
              </div>

              {seats < settings.groupSize && (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Book all {settings.groupSize} seats and{" "}
                  {rupees(settings.groupDiscountAmount)} comes off the booking.
                </p>
              )}
            </CardBody>
          </Card>

          <div className="space-y-5">
            {travellers.map((traveller, index) => (
              <TravellerForm
                key={index}
                index={index}
                traveller={traveller}
                isBooker={index === 0}
                onChange={(next) =>
                  setTravellers((current) =>
                    current.map((item, i) => (i === index ? next : item))
                  )
                }
              />
            ))}
          </div>

          <Card>
            <CardBody>
              <Field
                label="Best number to reach you on"
                required
                hint="The trip leads will use this for anything about the whole booking."
              >
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={bookerPhone}
                  onChange={(event) => setBookerPhone(event.target.value)}
                  required
                />
              </Field>
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg">
              Review booking
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {step === "review" && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-neutral-900">Who&apos;s going</h2>
              <ul className="mt-4 divide-y divide-neutral-100">
                {travellers.map((traveller, index) => (
                  <li key={index} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium text-neutral-900">
                        {traveller.name}
                        {index === 0 && (
                          <span className="ml-2 text-xs text-neutral-400">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {traveller.niftId} &middot; {traveller.bloodGroup} &middot;{" "}
                        {traveller.phone}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
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
                Promo codes and the group discount don&apos;t stack — you get whichever is
                bigger.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-4 text-sm font-semibold text-neutral-900">What you pay</h2>
              <PriceBreakdown pricing={pricing} groupSize={settings.groupSize} />
            </CardBody>
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep("details")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button size="lg" onClick={startPayment} loading={saving}>
              Continue to payment
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "pay" && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <BadgeIndianRupee className="h-4 w-4 text-amber-600" />
                Pay {rupees(pricing.total)}
              </div>

              {settings.upiId ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs uppercase tracking-wider text-neutral-500">
                      UPI ID
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="text-sm font-semibold text-neutral-900">
                        {settings.upiId}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(settings.upiId);
                          toast.success("UPI ID copied");
                        }}
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                        aria-label="Copy UPI ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {settings.upiPayeeName && (
                      <p className="mt-1 text-xs text-neutral-500">
                        Payee: {settings.upiPayeeName}
                      </p>
                    )}
                  </div>

                  {settings.paymentQrUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={settings.paymentQrUrl}
                      alt="UPI payment QR code"
                      className="mx-auto h-56 w-56 rounded-xl border border-neutral-200 bg-white object-contain p-2"
                    />
                  )}

                  <p className="flex items-start gap-2 text-xs text-neutral-500">
                    <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Pay the exact amount, then upload the screenshot below. An admin checks
                    it and your tickets appear on your booking page.
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Payment details haven&apos;t been set up yet. Message the trip leads
                  {settings.contactPhone ? ` on ${settings.contactPhone}` : ""} before paying.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <Field
                label="UPI reference number"
                required
                hint="The transaction ID from your payment app."
              >
                <Input
                  value={paymentRef}
                  onChange={(event) => setPaymentRef(event.target.value)}
                  required
                />
              </Field>

              <Field label="Payment screenshot" required>
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
              </Field>

              <Button
                size="lg"
                className="w-full"
                onClick={submitPayment}
                loading={saving}
                disabled={!file || !paymentRef.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading
                  </>
                ) : (
                  "Send for approval"
                )}
              </Button>

              <p className="text-center text-xs text-neutral-500">
                Your seats are held once an admin confirms the payment.
              </p>
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
          <span
            className={index <= activeIndex ? "text-neutral-900" : "text-neutral-400"}
          >
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
