"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Bus,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Flame,
  MapPin,
  Mountain,
  Phone,
  ShieldCheck,
  Sunrise,
  Users,
  Utensils,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import { subscribeSettings } from "@/lib/trip";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { TripSettings } from "@/lib/types";
import { formatDate, rupees } from "@/lib/utils";

const HIGHLIGHTS = [
  {
    icon: Mountain,
    title: "Leopards in granite country",
    body: "Jawai's boulder hills are one of the few places on earth where leopards live openly alongside people. Rabari shepherds have shared these hills with them for generations, without fences and without incident.",
  },
  {
    icon: Sunrise,
    title: "Two safaris, dawn and dusk",
    body: "Open-jeep safaris when the light is low and the cats are moving. Between them: the dam, the crocodiles, the flamingos and cranes that winter here, and a lot of very good silence.",
  },
  {
    icon: Flame,
    title: "Bonfire, food, and the whole batch",
    body: "Dinner under the sky, music, and the kind of night that ends up being the actual reason people remember a trip. Then a sunrise most of us have never seen sober.",
  },
];

const ITINERARY = [
  {
    day: "Day 1",
    items: [
      { time: "Early morning", text: "Bus leaves campus. Breakfast on the way." },
      { time: "Midday", text: "Reach Jawai, check in, lunch, and time to do nothing." },
      { time: "Late afternoon", text: "First jeep safari into the leopard hills." },
      { time: "Night", text: "Bonfire, dinner, music, stars." },
    ],
  },
  {
    day: "Day 2",
    items: [
      { time: "Before sunrise", text: "Second safari — the best light of the trip." },
      { time: "Morning", text: "Jawai Bandh: crocodiles, migratory birds, the dam wall." },
      { time: "Afternoon", text: "Rabari village walk, lunch, pack up." },
      { time: "Evening", text: "Bus back to campus." },
    ],
  },
];

const INCLUDED = [
  { icon: Bus, label: "Return bus from campus" },
  { icon: BedDouble, label: "One night's stay" },
  { icon: Utensils, label: "All meals on the trip" },
  { icon: Mountain, label: "Two jeep safaris" },
  { icon: Flame, label: "Bonfire evening" },
  { icon: ShieldCheck, label: "First-aid kit and trip leads" },
];

const CARRY = [
  "A government photo ID — carry the original, not a photo of it",
  "Warm layers: the hills get genuinely cold after dark",
  "Closed walking shoes, not slides",
  "Any medication you take, in its own packaging",
  "A power bank — charging points are limited",
  "Sunscreen, cap, and a refillable water bottle",
];

const FAQS = [
  {
    q: "Are the leopards dangerous?",
    a: "Jawai is one of the few places where leopards and people have shared the same hills for generations without attacks. Safaris are in open jeeps with licensed local guides who know exactly where the line is, and you stay in the vehicle when they say so.",
  },
  {
    q: "Can I book for my friends?",
    a: "Yes — up to 5 students on one booking, including you. You fill in everyone's details once, pay for the whole group, and each person gets their own QR ticket for the bus.",
  },
  {
    q: "Why do you need my blood group and medical details?",
    a: "Because we are taking a bus full of students several hours from campus into a rural area. If something happens, the trip leads need to know your blood group, any condition you have, and who to call — immediately, not after phoning around. Only the trip admins can see it.",
  },
  {
    q: "What if I have a medical condition?",
    a: "Tell us on the form. Almost nothing rules you out — we just need to know so we can plan for it and carry what you might need.",
  },
  {
    q: "How do I pay?",
    a: "UPI. You'll see the payment details after you fill in the form; pay, upload the screenshot, and an admin confirms your seats. Your tickets appear once it's approved.",
  },
  {
    q: "What if my payment gets rejected?",
    a: "You'll see exactly why on your booking page, and you can upload a corrected screenshot without starting over.",
  },
];

export default function JawaiPage() {
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS as TripSettings);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const parallaxRef = useRef<HTMLDivElement | null>(null);

  // Public read: settings are world-readable so this renders for signed-out
  // visitors. A failure is non-fatal — the page keeps its static copy.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return subscribeSettings(setSettings, () => {});
  }, []);

  // Hero parallax, driven off one rAF-throttled scroll listener rather than
  // per-frame layout reads, so it stays smooth on a phone.
  useEffect(() => {
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        setScrolled(y > 80);
        if (parallaxRef.current) {
          parallaxRef.current.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
          parallaxRef.current.style.opacity = String(Math.max(0, 1 - y / 620));
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

  const seatsLeft = Math.max(0, settings.totalSeats - settings.seatsBooked);
  const groupPrice =
    settings.pricePerPerson * settings.groupSize - settings.groupDiscountAmount;
  const dates =
    settings.startDate && settings.endDate
      ? `${formatDate(settings.startDate)} — ${formatDate(settings.endDate)}`
      : null;

  const ctaHref = loading ? "#" : user ? "/book" : "/login?next=/book";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      {/* ---------------------------------------------------- sticky nav */}
      <nav
        className={`no-print fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "border-b border-white/10 bg-neutral-950/85 py-3 backdrop-blur"
            : "border-b border-transparent py-5"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Mountain className="h-5 w-5 text-amber-500" />
            <span>APC Club</span>
            <span className="text-neutral-500">/</span>
            <span className="text-amber-500">Jawai</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={user ? "/book" : "/login"}
              className="hidden text-sm text-neutral-300 hover:text-white sm:block"
            >
              {user ? "My booking" : "Sign in"}
            </Link>
            <Link href={ctaHref}>
              <Button size="sm">Book a seat</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* -------------------------------------------------------- hero */}
      <header className="relative flex min-h-[92vh] flex-col items-center justify-center px-6 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-glow absolute -top-40 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-amber-500/25 blur-[130px]" />
          <div
            className="animate-glow absolute bottom-0 -right-32 h-[26rem] w-[26rem] rounded-full bg-orange-600/20 blur-[110px]"
            style={{ animationDelay: "-6s" }}
          />
          {/* Drop a photo at public/jawai/hero.jpg and it takes over here. */}
          <div className="absolute inset-0 bg-[url('/jawai/hero.jpg')] bg-cover bg-center opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/40 via-neutral-950/70 to-neutral-950" />
        </div>

        <div ref={parallaxRef} className="relative">
          <p
            className="animate-fade-up text-xs font-semibold uppercase tracking-[0.4em] text-amber-500"
            style={{ animationDelay: "80ms" }}
          >
            APC Club presents
          </p>

          <h1
            className="animate-fade-up mt-6 text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl md:text-8xl"
            style={{ animationDelay: "160ms" }}
          >
            Jawai
            <span className="block bg-gradient-to-r from-amber-400 via-amber-200 to-orange-400 bg-clip-text text-transparent">
              Safari
            </span>
          </h1>

          <p
            className="animate-fade-up mx-auto mt-7 max-w-xl text-base leading-relaxed text-neutral-300 sm:text-lg"
            style={{ animationDelay: "260ms" }}
          >
            {settings.tagline || DEFAULT_SETTINGS.tagline} Two days in leopard country, and
            a bus that leaves from the front gate.
          </p>

          <div
            className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-neutral-300"
            style={{ animationDelay: "340ms" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2">
              <MapPin className="h-4 w-4 text-amber-500" />
              {settings.destination || DEFAULT_SETTINGS.destination}
            </span>
            {dates && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2">
                <CalendarDays className="h-4 w-4 text-amber-500" />
                {dates}
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2">
              <Users className="h-4 w-4 text-amber-500" />
              {settings.bookingsOpen
                ? `${seatsLeft} of ${settings.totalSeats} seats left`
                : "Bookings closed"}
            </span>
          </div>

          <div
            className="animate-fade-up mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            style={{ animationDelay: "420ms" }}
          >
            <Link href={ctaHref}>
              <Button size="lg" className="w-full sm:w-auto">
                Book your seat — {rupees(settings.pricePerPerson)}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a
              href="#trip"
              className="text-sm text-neutral-400 underline-offset-4 hover:text-white hover:underline"
            >
              See what the two days look like
            </a>
          </div>
        </div>

        <div
          aria-hidden
          className="animate-float absolute bottom-8 text-neutral-500"
          style={{ animationDelay: "1s" }}
        >
          <ChevronDown className="h-6 w-6" />
        </div>
      </header>

      {/* ------------------------------------------------------ marquee */}
      <div
        aria-hidden
        className="no-print relative flex overflow-hidden border-y border-white/10 bg-white/[0.03] py-4"
      >
        <div className="animate-marquee flex shrink-0 gap-8 whitespace-nowrap pr-8 text-sm uppercase tracking-[0.3em] text-neutral-500">
          {Array.from({ length: 2 }).map((_, copy) => (
            <span key={copy} className="flex gap-8">
              {[
                "Leopard hills",
                "Jawai Bandh",
                "Rabari country",
                "Open jeeps",
                "Bonfire",
                "Sunrise safari",
                "Granite kopjes",
              ].map((word) => (
                <span key={word} className="flex items-center gap-8">
                  {word}
                  <span className="text-amber-600">&bull;</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------- highlights */}
      <section id="trip" className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
            Why Jawai
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Not a resort trip. A place that is still genuinely wild.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {HIGHLIGHTS.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={index * 110}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-amber-500/40">
                  <Icon className="h-7 w-7 text-amber-500" />
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-400">{item.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ----------------------------------------------------- itinerary */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
              The plan
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
              Two days, roughly like this
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-10 md:grid-cols-2">
            {ITINERARY.map((day, dayIndex) => (
              <Reveal key={day.day} delay={dayIndex * 140}>
                <div className="rounded-2xl border border-white/10 bg-neutral-950/60 p-7">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-500">
                    {day.day}
                  </h3>
                  <ol className="mt-6 space-y-6">
                    {day.items.map((item) => (
                      <li key={item.time} className="relative border-l border-white/10 pl-6">
                        <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <p className="text-xs uppercase tracking-wider text-neutral-500">
                          {item.time}
                        </p>
                        <p className="mt-1 text-sm text-neutral-200">{item.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <p className="mt-10 text-xs text-neutral-500">
              Safari timings shift with the light and with the forest department, so treat
              this as the shape of the trip rather than a timetable.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------ included */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            What&apos;s in the price
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.label} delay={index * 70}>
                <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <Icon className="h-5 w-5 shrink-0 text-amber-500" />
                  <span className="text-sm text-neutral-200">{item.label}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------- gallery */}
      <section aria-label="Photos from Jawai" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {["kopjes", "leopard", "bandh"].map((name, index) => (
            <Reveal key={name} delay={index * 100}>
              {/* Drop public/jawai/{name}.jpg in and the gradient is replaced. */}
              <div
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-amber-900/40 via-neutral-900 to-neutral-950"
                style={{
                  backgroundImage: `url('/jawai/${name}.jpg')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-neutral-950/80 to-transparent p-5">
                  <span className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-300">
                    <Camera className="h-3.5 w-3.5" />
                    {name}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- pricing */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-4xl px-6 py-24 sm:py-32">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent">
              <div className="p-8 text-center sm:p-12">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
                  Per person
                </p>
                <p className="mt-4 text-6xl font-semibold tracking-tight sm:text-7xl">
                  {rupees(settings.pricePerPerson)}
                </p>
                <p className="mt-4 text-sm text-neutral-300">
                  Everything above included. Nothing extra collected on the trip.
                </p>

                <div className="mx-auto mt-9 max-w-md rounded-2xl border border-white/10 bg-neutral-950/60 p-6">
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-amber-400">
                    <Users className="h-4 w-4" />
                    Book all {settings.groupSize} seats together
                  </p>
                  <p className="mt-3 text-sm text-neutral-300">
                    {rupees(settings.groupDiscountAmount)} off the booking —{" "}
                    <span className="font-semibold text-white">{rupees(groupPrice)}</span> for{" "}
                    {settings.groupSize} instead of{" "}
                    {rupees(settings.pricePerPerson * settings.groupSize)}.
                  </p>
                  <p className="mt-3 text-xs text-neutral-500">
                    Got a promo code? Enter it at checkout — you&apos;ll automatically get
                    whichever saves you more. They don&apos;t stack.
                  </p>
                </div>

                <div className="mt-9">
                  <Link href={ctaHref}>
                    <Button size="lg" disabled={!settings.bookingsOpen}>
                      {settings.bookingsOpen ? "Book now" : "Bookings are closed"}
                      {settings.bookingsOpen && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </Link>
                  <p className="mt-4 text-xs text-neutral-500">
                    Up to {settings.maxSeatsPerBooking} students on one booking, including you.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- safety */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="grid gap-14 md:grid-cols-2">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
              Before you go
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              What to carry
            </h2>
            <ul className="mt-8 space-y-4">
              {CARRY.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-neutral-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={140}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
              <ShieldCheck className="h-7 w-7 text-amber-500" />
              <h3 className="mt-5 text-lg font-semibold">Why we ask for medical details</h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                We are taking a bus full of students a few hours from campus into a rural
                area. If someone needs help, the trip leads need their blood group, any
                condition they have, and who to call — right then, not after phoning around.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                Only trip admins can read it. It is never shown publicly, never shared with
                anyone outside the club, and it is carried on the bus purely so someone can
                act fast if they have to.
              </p>
              {settings.contactPhone && (
                <p className="mt-6 flex items-center gap-2 text-sm text-neutral-300">
                  <Phone className="h-4 w-4 text-amber-500" />
                  {settings.contactName || "Trip lead"} — {settings.contactPhone}
                </p>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- faq */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Questions people actually ask
            </h2>
          </Reveal>
          <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
            {FAQS.map((faq, index) => (
              <Reveal key={faq.q} delay={index * 60}>
                <div>
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    aria-expanded={openFaq === index}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="text-sm font-medium sm:text-base">{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-amber-500 transition-transform duration-300 ${
                        openFaq === index ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className="grid transition-all duration-300"
                    style={{ gridTemplateRows: openFaq === index ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p className="pb-5 text-sm leading-relaxed text-neutral-400">{faq.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- footer */}
      <footer className="mx-auto max-w-6xl px-6 py-20 text-center">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {settings.bookingsOpen ? "Seats go fast." : "Bookings are closed for now."}
          </h2>
          {settings.bookingsOpen && (
            <p className="mt-4 text-sm text-neutral-400">
              {seatsLeft} of {settings.totalSeats} still open.
            </p>
          )}
          <div className="mt-8">
            <Link href={ctaHref}>
              <Button size="lg" disabled={!settings.bookingsOpen}>
                Book a seat
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-14 text-xs text-neutral-600">
            APC Club, NIFT Jodhpur
            {settings.contactPhone ? ` — ${settings.contactPhone}` : ""}
          </p>
        </Reveal>
      </footer>
    </div>
  );
}
