"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Binoculars,
  Bus,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  MapPin,
  Mountain,
  ShieldCheck,
  Sparkles,
  Star,
  Sunset,
  Users,
  Utensils,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { useAuth } from "@/contexts/AuthContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import { subscribeSettings } from "@/lib/trip";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { TripSettings } from "@/lib/types";
import { formatDate, rupees } from "@/lib/utils";

const FEATURES = [
  {
    icon: Binoculars,
    title: "Real Leopard Country",
    body: "Jawai's granite hills are one of the few places on earth where leopards live openly alongside people. An open-jeep safari with licensed local guides who know exactly where to look.",
  },
  {
    icon: Bus,
    title: "All-in-One Booking",
    body: "Bus, food and the safari in one price. Book up to five of you together, pay once, and nothing more is collected on the day.",
  },
  {
    icon: Headphones,
    title: "Looked After",
    body: "Trip leads carry everyone's blood group, allergies and emergency contact on the bus. Questions before, during and after — someone from APC is on it.",
  },
];

const HIGHLIGHTS = [
  {
    slug: "safari",
    name: "Leopard Safari",
    tag: "Main event",
    blurb: "Open jeep",
    rating: "4.9",
    location: "Jawai Hills",
    accent: "from-amber-900/60 via-stone-800 to-stone-950",
  },
  {
    slug: "bandh",
    name: "Jawai Bandh",
    tag: "Included",
    blurb: "Crocodiles & cranes",
    rating: "4.7",
    location: "Pali, Rajasthan",
    accent: "from-sky-900/60 via-slate-800 to-slate-950",
  },
  {
    slug: "rabari",
    name: "Rabari Village",
    tag: "Guided walk",
    blurb: "Shepherd country",
    rating: "4.8",
    location: "Jawai Bandh",
    accent: "from-rose-900/50 via-stone-800 to-stone-950",
  },
  {
    slug: "sunset",
    name: "Sunset Point",
    tag: "Included",
    blurb: "Golden hour",
    rating: "5.0",
    location: "Jawai Hills",
    accent: "from-orange-900/60 via-neutral-800 to-neutral-950",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Pick Your Seats",
    body: "Up to five of you on one booking, including you. Fill in everyone's details and medical info once.",
  },
  {
    n: "2",
    title: "Pay by UPI",
    body: "Pay the exact amount and upload the screenshot. Takes a minute.",
  },
  {
    n: "3",
    title: "Get Your QR Tickets",
    body: "An admin checks the payment. Your QR boarding passes appear on your booking page.",
  },
];

export default function JawaiPage() {
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS as TripSettings);
  const [scrolled, setScrolled] = useState(false);
  const [slide, setSlide] = useState(0);
  const railRef = useRef<HTMLDivElement | null>(null);
  const parallaxRef = useRef<HTMLDivElement | null>(null);

  // Settings are world-readable, so this renders for signed-out visitors.
  // A failure is non-fatal — the page keeps its static copy.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return subscribeSettings(setSettings, () => {});
  }, []);

  // One rAF-throttled scroll listener drives both the nav state and the
  // hero parallax, rather than a listener and a layout read per frame.
  useEffect(() => {
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        setScrolled(y > 40);
        if (parallaxRef.current) {
          parallaxRef.current.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
        }
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function scrollRail(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 16 : 280;
    rail.scrollBy({ left: step * direction, behavior: "smooth" });
    setSlide((current) =>
      Math.max(0, Math.min(HIGHLIGHTS.length - 1, current + direction))
    );
  }

  const seatsLeft = Math.max(0, settings.totalSeats - settings.seatsBooked);
  const groupTotal =
    settings.pricePerPerson * settings.groupSize - settings.groupDiscountAmount;
  const dates =
    settings.startDate && settings.endDate
      ? `${formatDate(settings.startDate)} — ${formatDate(settings.endDate)}`
      : null;
  const ctaHref = loading ? "#" : user ? "/book" : "/login?next=/book";

  return (
    <div className="min-h-screen bg-[#c3d2d7] px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[26px] bg-white shadow-[0_20px_70px_rgba(15,35,45,0.18)]">
        {/* ----------------------------------------------------------- nav */}
        <nav
          className={`no-print sticky top-0 z-50 flex items-center justify-between gap-4 bg-white/95 px-5 backdrop-blur transition-all duration-300 sm:px-8 ${
            scrolled ? "border-b border-neutral-200 py-3" : "py-5"
          }`}
        >
          <Link href="/" className="flex items-center gap-2">
            <Mountain className="h-5 w-5 text-[#16323f]" />
            <span className="text-base font-bold tracking-tight text-[#16323f]">
              APC
              <span className="font-light text-neutral-400">/</span>
              <span className="text-[#e0a12a]">jawai</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-sm font-medium text-neutral-600 md:flex">
            <a href="#trip" className="transition-colors hover:text-[#16323f]">
              The Trip
            </a>
            <a href="#highlights" className="transition-colors hover:text-[#16323f]">
              Highlights
            </a>
            <a href="#included" className="transition-colors hover:text-[#16323f]">
              What&apos;s Included
            </a>
            <a href="#how" className="transition-colors hover:text-[#16323f]">
              How to Book
            </a>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <Link
                href="/book"
                className="hidden text-sm font-medium text-neutral-600 hover:text-[#16323f] sm:block"
              >
                My booking
              </Link>
            )}
            <Link
              href={ctaHref}
              className="rounded-full bg-[#16323f] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f242e]"
            >
              Book now
            </Link>
          </div>
        </nav>

        {/* --------------------------------------------------------- hero */}
        <header className="px-3 pb-6 sm:px-5">
          <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-emerald-900 via-stone-800 to-slate-900 sm:min-h-[520px]">
            <div aria-hidden className="absolute inset-0 overflow-hidden">
              {/* Drop a photo at public/jawai/hero.jpg and it takes over here. */}
              <div
                ref={parallaxRef}
                className="absolute -inset-y-16 inset-x-0 bg-[url('/jawai/hero.jpg')] bg-cover bg-center opacity-70"
              />
              <div className="animate-glow absolute -top-24 left-1/3 h-[26rem] w-[26rem] rounded-full bg-amber-500/20 blur-[110px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/35" />
            </div>

            <div className="relative w-full px-6 py-16 text-center sm:px-10">
              <h1 className="animate-fade-up text-[clamp(3.2rem,13vw,8.5rem)] font-extrabold leading-[0.85] tracking-tighter text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                JAWAI
                <span className="ml-3 inline-block align-baseline pb-[0.12em] text-[0.16em] font-semibold tracking-[0.32em] text-white/75">
                  SAFARI
                </span>
              </h1>

              <p
                className="animate-fade-up mx-auto mt-6 max-w-lg text-sm leading-relaxed text-white/85 sm:text-base"
                style={{ animationDelay: "140ms" }}
              >
                {settings.tagline || DEFAULT_SETTINGS.tagline} A full day in leopard
                country with the APC Club — bus, food and the safari, all in one booking.
              </p>

              <div
                className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3"
                style={{ animationDelay: "230ms" }}
              >
                <Link
                  href={ctaHref}
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#16323f] shadow-lg transition-transform hover:scale-[1.03]"
                >
                  Book Your Seat
                </Link>
                <a
                  href="#highlights"
                  className="rounded-full border border-white/50 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                >
                  Explore the Trip
                </a>
              </div>

              <div
                className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-2 text-xs text-white/80"
                style={{ animationDelay: "320ms" }}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {settings.destination || DEFAULT_SETTINGS.destination}
                </span>
                {dates && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {dates}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {settings.bookingsOpen
                    ? `${seatsLeft} of ${settings.totalSeats} seats left`
                    : "Bookings closed"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* --------------------------------------------------- why / stats */}
        <section id="trip" className="px-6 py-14 sm:px-10 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
            <Reveal>
              <h2 className="text-2xl font-semibold leading-snug tracking-tight text-[#16323f] sm:text-[1.7rem]">
                Why Students Book Jawai
                <br />
                With the APC Club
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-neutral-600">
                From the leopard hills to the bonfire, we make getting there easy, safe and
                genuinely fun — one price, one booking, and people who know the place.
              </p>

              <div className="mt-7 flex items-center gap-4 text-[#16323f]">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="APC Club on Instagram"
                  className="transition-opacity hover:opacity-60"
                >
                  {/* Inline, because lucide-react v1 dropped brand icons. */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    className="h-5 w-5"
                    aria-hidden
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
                  </svg>
                </a>
                <span className="text-neutral-300">|</span>
                {settings.contactPhone && (
                  <span className="text-sm text-neutral-600">
                    {settings.contactName || "Trip lead"} · {settings.contactPhone}
                  </span>
                )}
              </div>

              <div className="mt-12 grid grid-cols-3 gap-4">
                {[
                  { icon: Users, value: `${settings.totalSeats}`, label: "Seats on this trip" },
                  { icon: CalendarDays, value: "1 day", label: "Out and back" },
                  {
                    icon: Sparkles,
                    value: `${settings.maxSeatsPerBooking}`,
                    label: "Friends per booking",
                  },
                ].map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <Reveal key={stat.label} delay={index * 90}>
                      <div className="text-center">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#16323f]">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <p className="mt-3 text-lg font-bold text-[#16323f]">{stat.value}</p>
                        <p className="mt-0.5 text-[11px] leading-tight text-neutral-500">
                          {stat.label}
                        </p>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </Reveal>

            <div className="space-y-4">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Reveal key={feature.title} delay={index * 110}>
                    <div className="flex gap-4 rounded-2xl bg-[#8ea3b5] p-5 text-white transition-transform hover:translate-x-1">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/95">
                        <Icon className="h-5 w-5 text-[#16323f]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">{feature.title}</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-white/85">
                          {feature.body}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- highlights */}
        <section id="highlights" className="px-3 sm:px-5">
          <div className="rounded-[20px] bg-[#eef1f3] px-6 py-10 sm:px-9 sm:py-12">
            <Reveal>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-xl font-semibold tracking-tight text-[#16323f] sm:text-2xl">
                  Trip Highlights
                </h2>
                <p className="max-w-sm text-sm text-neutral-600">
                  Leave campus early, chase leopards through granite hills, and be back
                  the same night. Here&apos;s what the day actually looks like.
                </p>
              </div>
            </Reveal>

            <div
              ref={railRef}
              className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {HIGHLIGHTS.map((item, index) => (
                <Reveal
                  key={item.slug}
                  delay={index * 90}
                  className="w-[58%] shrink-0 snap-start sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)]"
                >
                  <div
                    className={`group relative h-[210px] overflow-hidden rounded-2xl bg-gradient-to-br ${item.accent} sm:h-[240px]`}
                    style={{
                      backgroundImage: `url('/jawai/${item.slug}.jpg')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/20 transition-opacity group-hover:from-black/85" />

                    <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-[#16323f]">
                      {item.tag}
                    </span>

                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <h3 className="text-base font-bold leading-tight">{item.name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/85">
                        {item.blurb}
                        <span className="text-white/40">|</span>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {item.rating}
                      </p>
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-white/70">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Link
                href={ctaHref}
                className="rounded-full bg-[#16323f] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0f242e]"
              >
                Book your seat
              </Link>

              <div className="flex gap-2">
                <button
                  onClick={() => scrollRail(-1)}
                  aria-label="Previous highlight"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-400 text-[#16323f] transition-colors hover:bg-white disabled:opacity-40"
                  disabled={slide === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => scrollRail(1)}
                  aria-label="Next highlight"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-400 text-[#16323f] transition-colors hover:bg-white disabled:opacity-40"
                  disabled={slide >= HIGHLIGHTS.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ price/included */}
        <section id="included" className="px-3 py-10 sm:px-5 sm:py-14">
          <div className="grid gap-4 md:grid-cols-[1.05fr_1fr_1fr]">
            <Reveal>
              <div className="flex h-full flex-col justify-between rounded-2xl bg-[#8ea3b5] p-7 text-white">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">What&apos;s Included</h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/85">
                    One price covers the whole day. Nothing extra is collected once
                    you&apos;re on the bus.
                  </p>

                  <ul className="mt-6 space-y-2.5 text-sm">
                    {[
                      { icon: Bus, label: "Return bus from campus" },
                      { icon: Utensils, label: "All food through the day" },
                      { icon: Binoculars, label: "Open-jeep leopard safari" },
                      { icon: Sunset, label: "Jawai Bandh and sunset point" },
                      { icon: ShieldCheck, label: "First aid and trip leads" },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.label} className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-white/70" />
                          {item.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <Link
                  href={ctaHref}
                  className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-[#16323f] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0f242e]"
                >
                  Book your seat
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={110}>
              <div className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-stone-700 via-stone-800 to-neutral-900 p-7 text-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                  <Users className="h-5 w-5" />
                </div>
                <div className="mt-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                    Going solo or in a pair
                  </p>
                  <p className="mt-3 text-4xl font-bold tracking-tight">
                    {rupees(settings.pricePerPerson)}
                  </p>
                  <p className="mt-1 text-sm text-white/70">per person</p>
                  <p className="mt-4 text-xs leading-relaxed text-white/70">
                    Book one to {settings.groupSize - 1} seats. Everything above included.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 p-7 text-white">
                <span className="absolute right-4 top-4 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#16323f]">
                  Best value
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="mt-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                    All {settings.groupSize} together
                  </p>
                  <p className="mt-3 text-4xl font-bold tracking-tight">
                    {rupees(groupTotal)}
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    for {settings.groupSize} — {rupees(settings.groupDiscountAmount)} off
                  </p>
                  <p className="mt-4 text-xs leading-relaxed text-white/75">
                    Instead of {rupees(settings.pricePerPerson * settings.groupSize)}. Got a
                    promo code? You get whichever saves more — they don&apos;t stack.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ----------------------------------------------------- how to book */}
        <section id="how" className="px-6 pb-16 sm:px-10 sm:pb-20">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight text-[#16323f] sm:text-2xl">
              Booking made as easy as 1-2-3.
            </h2>
          </Reveal>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal key={step.n} delay={index * 110}>
                <div className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#16323f] text-base font-bold text-[#16323f]">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#16323f]">{step.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
                      {step.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl bg-[#16323f] px-6 py-10 text-center text-white">
              <h3 className="text-2xl font-semibold tracking-tight">
                {settings.bookingsOpen ? "Seats go fast." : "Bookings are closed for now."}
              </h3>
              {settings.bookingsOpen && (
                <p className="text-sm text-white/70">
                  {seatsLeft} of {settings.totalSeats} still open.
                </p>
              )}
              <Link
                href={ctaHref}
                className={`mt-2 inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-transform ${
                  settings.bookingsOpen
                    ? "bg-white text-[#16323f] hover:scale-[1.03]"
                    : "pointer-events-none bg-white/30 text-white/60"
                }`}
              >
                {settings.bookingsOpen ? "Book a seat" : "Closed"}
                {settings.bookingsOpen && <ArrowRight className="h-4 w-4" />}
              </Link>
            </div>
          </Reveal>

          <p className="mt-10 text-center text-[11px] text-neutral-400">
            APC Club, NIFT Jodhpur
            {settings.contactPhone ? ` — ${settings.contactPhone}` : ""}
          </p>
        </section>
      </div>

      <div aria-hidden className="flex justify-center py-6 text-[#16323f]/40">
        <ChevronDown className="animate-float h-5 w-5" />
      </div>
    </div>
  );
}
