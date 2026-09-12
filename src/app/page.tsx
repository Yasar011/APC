"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Binoculars,
  Bus,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageCircle,
  Mountain,
  Music,
  Sparkles,
  Star,
  TriangleAlert,
  Users,
  Utensils,
  Waves,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { useAuth } from "@/contexts/AuthContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import { subscribeSettings } from "@/lib/trip";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { contactName, contactPhone, contactRole, whatsappHref } from "@/lib/contact";
import { TripSettings } from "@/lib/types";
import { formatDate, rupees } from "@/lib/utils";

/** Jodhpur → Jadan Om Temple → Jawai, and back the same night. */
const ROUTE = [
  { name: "Jodhpur", detail: "8:00 AM start" },
  { name: "Jadan Om Temple", detail: "Darshan & photos" },
  { name: "Jawai", detail: "Dam, safari, sunset" },
  { name: "Jodhpur", detail: "Back by 12:30 AM" },
];

const ITINERARY = [
  { time: "08:00 AM", title: "Jodhpur departure", icon: Bus },
  { time: "10:30 AM", title: "Jadan Om Temple — darshan & photography", icon: Sparkles },
  { time: "11:30 AM", title: "Depart for Jawai", icon: Mountain },
  { time: "01:00 PM", title: "Lunch at Jawai", icon: Utensils },
  { time: "03:00 PM", title: "Jawai Dam & sightseeing", icon: Waves },
  { time: "04:30 PM", title: "Jawai jeep safari", icon: Binoculars },
  { time: "08:00 PM", title: "Dinner", icon: Utensils },
  { time: "08:30 PM", title: "Return journey to Jodhpur", icon: Bus },
  { time: "12:30 AM", title: "Arrival at Jodhpur", icon: Clock },
];

const INCLUDED = [
  { icon: Bus, label: "AC transportation" },
  { icon: Utensils, label: "Lunch" },
  { icon: Utensils, label: "Dinner" },
  { icon: Sparkles, label: "Jadan Om Temple visit" },
  { icon: Waves, label: "Jawai Dam sightseeing" },
  { icon: Binoculars, label: "Jawai jeep safari" },
  { icon: Music, label: "Music & group activities" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "Spirituality, Then Wilderness",
    body: "The day starts quiet at Jadan Om Temple — darshan, the architecture, photographs — before the road turns towards Jawai and the wild half of the trip.",
  },
  {
    icon: Binoculars,
    title: "Into The Leopard Zone",
    body: "Crocodile lake, the birdlife along the water, then off the smooth roads and across the rocky hills into the Leopard Zone, scanning the outcrops for that one moment.",
  },
  {
    icon: Bus,
    title: "Everything In One Price",
    body: "AC bus, lunch, dinner, the temple visit, Jawai Dam, the jeep safari, and music the whole way. One seat, one payment, nothing collected on the day.",
  },
];

const HIGHLIGHTS = [
  {
    slug: "temple",
    name: "Jadan Om Temple",
    tag: "10:30 AM",
    blurb: "Darshan & photography",
    rating: "4.9",
    location: "Jadan, Pali",
    accent: "from-amber-800/60 via-stone-800 to-stone-950",
  },
  {
    slug: "dam",
    name: "Jawai Dam",
    tag: "03:00 PM",
    blurb: "Water & rocky hills",
    rating: "4.8",
    location: "Jawai Bandh",
    accent: "from-sky-900/60 via-slate-800 to-slate-950",
  },
  {
    slug: "crocodile",
    name: "Crocodile Lake",
    tag: "Safari",
    blurb: "Crocodiles & birdlife",
    rating: "4.7",
    location: "Jawai water bodies",
    accent: "from-emerald-900/50 via-stone-800 to-stone-950",
  },
  {
    slug: "leopard",
    name: "The Leopard Zone",
    tag: "04:30 PM",
    blurb: "Hill off-roading",
    rating: "5.0",
    location: "Jawai hills",
    accent: "from-orange-900/60 via-neutral-800 to-neutral-950",
  },
  {
    slug: "sunset",
    name: "Jawai Sunset",
    tag: "Evening",
    blurb: "Golden hues over the hills",
    rating: "5.0",
    location: "Jawai",
    accent: "from-rose-900/50 via-amber-900/40 to-stone-950",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Fill In Your Details",
    body: "One seat per NIFT ID. Your details, blood group and emergency contact, once.",
  },
  {
    n: "2",
    title: "Pay by UPI",
    body: "Pay the exact amount to the UPI ID shown, then upload the screenshot.",
  },
  {
    n: "3",
    title: "Get Your QR Ticket",
    body: "An admin checks the payment. Your QR boarding pass appears on your booking page.",
  },
];

export default function JawaiPage() {
  const { user, loading, displayName } = useAuth();
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
  const tripDate = settings.startDate ? formatDate(settings.startDate) : null;
  const ctaHref = loading ? "#" : user ? "/book" : "/login?next=/book";
  const whatsapp = whatsappHref(settings, user ? displayName : null);

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
            <a href="#route" className="transition-colors hover:text-[#16323f]">
              Route
            </a>
            <a href="#day" className="transition-colors hover:text-[#16323f]">
              The Day
            </a>
            <a href="#highlights" className="transition-colors hover:text-[#16323f]">
              Highlights
            </a>
            <a href="#included" className="transition-colors hover:text-[#16323f]">
              Included
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/35" />
            </div>

            <div className="relative w-full px-6 py-16 text-center sm:px-10">
              <h1 className="animate-fade-up text-[clamp(3.2rem,13vw,8.5rem)] font-extrabold leading-[0.85] tracking-tighter text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                JAWAI
              </h1>

              <p
                className="animate-fade-up mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-amber-400 sm:text-sm"
                style={{ animationDelay: "100ms" }}
              >
                The Wild Side of Rajasthan
              </p>

              <p
                className="animate-fade-up mx-auto mt-6 max-w-lg text-sm leading-relaxed text-white/85 sm:text-base"
                style={{ animationDelay: "180ms" }}
              >
                From the peaceful vibes of Jadan Om Temple to the untamed wilderness of
                Jawai — one day where spirituality, nature and adventure come together.
              </p>

              {/* ---- the road map, right under the title ---- */}
              <div
                className="animate-fade-up mx-auto mt-9 flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-3 text-xs font-semibold text-white/90 sm:text-sm"
                style={{ animationDelay: "260ms" }}
              >
                {ROUTE.map((stop, index) => (
                  <span key={`${stop.name}-${index}`} className="flex items-center gap-2">
                    <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                      {stop.name}
                    </span>
                    {index < ROUTE.length - 1 && (
                      <ArrowRight className="h-3.5 w-3.5 text-amber-400" aria-hidden />
                    )}
                  </span>
                ))}
              </div>

              <div
                className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3"
                style={{ animationDelay: "340ms" }}
              >
                <Link
                  href={ctaHref}
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#16323f] shadow-lg transition-transform hover:scale-[1.03]"
                >
                  Book Your Seat
                </Link>
                <a
                  href="#day"
                  className="rounded-full border border-white/50 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                >
                  See the full day
                </a>
              </div>

              <div
                className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-2 text-xs text-white/80"
                style={{ animationDelay: "420ms" }}
              >
                {tripDate && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {tripDate}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {settings.bookingsOpen
                    ? `${seatsLeft} of ${settings.totalSeats} seats left`
                    : "Bookings closed"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {rupees(settings.pricePerPerson)} all in
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* -------------------------------------------------- route map */}
        <section id="route" className="px-3 sm:px-5">
          <div className="rounded-[20px] bg-[#16323f] px-6 py-10 text-white sm:px-10">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
                The route
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Jodhpur, a temple, and the wild.
              </h2>
            </Reveal>

            <div className="relative mt-10">
              {/* The road: a dashed line the stops sit on. */}
              <div
                aria-hidden
                className="absolute left-[12.5%] right-[12.5%] top-5 hidden border-t-2 border-dashed border-white/25 md:block"
              />
              <ol className="relative grid gap-7 md:grid-cols-4 md:gap-4">
                {ROUTE.map((stop, index) => (
                  <Reveal key={`${stop.name}-${index}`} delay={index * 110} as="li">
                    <div className="flex items-start gap-4 md:block">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-[#16323f] text-sm font-bold text-amber-400">
                        {index + 1}
                      </span>
                      <div className="md:mt-4">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">
                          <MapPin className="h-3.5 w-3.5 text-amber-400" />
                          {stop.name}
                        </p>
                        <p className="mt-1 text-xs text-white/60">{stop.detail}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>

            <Reveal delay={200}>
              <p className="mt-9 text-xs text-white/50">
                Roughly 160 km each way. The bus leaves Jodhpur in the morning and everyone
                is back the same night — no overnight stay.
              </p>
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------------------- why / stats */}
        <section className="px-6 py-14 sm:px-10 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
            <Reveal>
              <h2 className="text-2xl font-semibold leading-snug tracking-tight text-[#16323f] sm:text-[1.7rem]">
                One Day.
                <br />
                Endless Experiences.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-neutral-600">
                Spirituality, scenic beauty, wildlife, a jeep safari and a bus full of
                people you know — all inside a single day out of Jodhpur.
              </p>

              <div className="mt-12 grid grid-cols-3 gap-4">
                {[
                  { icon: Users, value: `${settings.totalSeats}`, label: "Seats on this trip" },
                  { icon: Clock, value: "1 day", label: "Out and back" },
                  {
                    icon: Sparkles,
                    value: rupees(settings.pricePerPerson),
                    label: "All in, per person",
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

        {/* ------------------------------------------------ the day, hour by hour */}
        <section id="day" className="px-3 sm:px-5">
          <div className="rounded-[20px] bg-[#eef1f3] px-6 py-10 sm:px-9 sm:py-12">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
                Your day, step by step
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-[#16323f] sm:text-2xl">
                8:00 AM to 12:30 AM.
              </h2>
            </Reveal>

            <ol className="mt-9 max-w-xl">
              {ITINERARY.map((item, index) => {
                const Icon = item.icon;
                const last = index === ITINERARY.length - 1;
                return (
                  <Reveal key={item.time} delay={index * 60} as="li">
                    <div
                      className={`flex gap-4 pl-5 ${
                        last ? "pb-0" : "border-l-2 border-dashed border-neutral-300 pb-5"
                      }`}
                    >
                      <span className="-ml-[2.15rem] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-[#16323f]">
                        <Icon className="h-3.5 w-3.5 text-[#16323f]" />
                      </span>
                      <div className="-mt-0.5">
                        <p className="text-xs font-bold tracking-wider text-amber-700">
                          {item.time}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-800">{item.title}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </ol>

            <Reveal delay={220}>
              <p className="mt-4 flex items-start gap-2 text-xs text-neutral-500">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                Timings shift with traffic and the light. Wildlife sightings are subject to
                natural conditions — the hills don&apos;t take bookings.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------------------------------------------------- highlights */}
        <section id="highlights" className="px-6 py-14 sm:px-10 sm:py-20">
          <Reveal>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-[#16323f] sm:text-2xl">
                Stops along the way
              </h2>
              <p className="max-w-sm text-sm text-neutral-600">
                A temple at sunrise-ish, a dam, crocodiles, leopards, and a sunset that
                makes the whole bus go quiet.
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
                aria-label="Previous stop"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-400 text-[#16323f] transition-colors hover:bg-neutral-50 disabled:opacity-40"
                disabled={slide === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => scrollRail(1)}
                aria-label="Next stop"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-400 text-[#16323f] transition-colors hover:bg-neutral-50 disabled:opacity-40"
                disabled={slide >= HIGHLIGHTS.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ price/included */}
        <section id="included" className="px-3 pb-10 sm:px-5 sm:pb-14">
          <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
            <Reveal>
              <div className="flex h-full flex-col justify-between rounded-2xl bg-[#8ea3b5] p-7 text-white">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Everything You Need For The Day
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-white/85">
                    One price covers all of it. Nothing extra is collected once you&apos;re
                    on the bus.
                  </p>

                  <ul className="mt-6 space-y-2.5 text-sm">
                    {INCLUDED.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <li key={`${item.label}-${index}`} className="flex items-center gap-2.5">
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
              <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 p-7 text-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="mt-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                    One seat, everything in
                  </p>
                  <p className="mt-3 text-5xl font-bold tracking-tight">
                    {rupees(settings.pricePerPerson)}
                  </p>
                  <p className="mt-1 text-sm text-white/70">per person</p>
                  <p className="mt-4 text-xs leading-relaxed text-white/75">
                    One seat per NIFT ID, so everyone books their own. Got a promo code?
                    Enter it at checkout.
                  </p>
                </div>

                <Link
                  href={ctaHref}
                  className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-[#16323f] transition-transform hover:scale-[1.03]"
                >
                  Book your seat
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ----------------------------------------------------- how to book */}
        <section className="px-6 pb-10 sm:px-10">
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
        </section>

        {/* --------------------------------------------------------- ask */}
        <section className="px-3 pb-10 sm:px-5">
          <Reveal>
            <div className="flex flex-col items-center gap-5 rounded-[20px] border border-neutral-200 bg-[#eef1f3] px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366]">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[#16323f]">
                  Questions before you book?
                </h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Message {contactName(settings)}, {contactRole(settings)} — the message is
                  already typed, just add your question.
                </p>
              </div>
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp {contactName(settings)}
              </a>
              <p className="text-xs text-neutral-500">{contactPhone(settings)}</p>
            </div>
          </Reveal>
        </section>

        {/* ------------------------------------------------------- footer */}
        <section className="px-6 pb-16 sm:px-10 sm:pb-20">
          <Reveal>
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-[#16323f] px-6 py-10 text-center text-white">
              <h3 className="text-2xl font-semibold tracking-tight">
                {settings.bookingsOpen ? "Ready to experience Jawai?" : "Bookings are closed for now."}
              </h3>
              {settings.bookingsOpen && (
                <p className="text-sm text-white/70">
                  One day. One epic escape. {seatsLeft} of {settings.totalSeats} seats still
                  open.
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

          <p className="mt-10 flex items-center justify-center gap-2 text-center text-[11px] text-neutral-400">
            <Camera className="h-3 w-3" />
            APC Club, NIFT Jodhpur
          </p>
        </section>
      </div>

      <div aria-hidden className="flex justify-center py-6 text-[#16323f]/40">
        <ChevronDown className="animate-float h-5 w-5" />
      </div>
    </div>
  );
}
