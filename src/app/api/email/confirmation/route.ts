import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { Booking, TripSettings } from "@/lib/types";

/**
 * The "you're going to Jawai" email.
 *
 * Sent over the club's own Gmail with an App Password rather than through a
 * transactional provider. A provider needs a verified sending domain before
 * it will mail anyone but you, which the club does not have; Gmail sends as
 * the address students already recognise, allows 500 a day, and 89 seats
 * fits inside that several times over.
 *
 * ## Who is allowed to send one
 *
 * There is no Firebase Admin SDK here, so rather than re-implementing the
 * role check this route borrows the one already published in the database
 * rules: it reads the booking from the Realtime Database REST API *as the
 * caller*, with their own ID token. If the rules would not let them read
 * that booking, the read fails and so does the send.
 *
 * Two things follow, and they are the whole security model:
 *
 *  - the recipient is the address stored **on the booking**, never one the
 *    caller supplies, so the worst a student can do is mail themselves;
 *  - the status is read from the database, not from the request, so a
 *    confirmation cannot be conjured for a booking nobody has verified.
 */

const DB_URL =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://apc-movie-default-rtdb.firebaseio.com";

const isEmailConfigured = Boolean(
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
);

async function verifyIdToken(idToken: string): Promise<boolean> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  return response.ok;
}

/** Reads a node as the caller, so the published rules do the authorising. */
async function readAs<T>(path: string, idToken: string): Promise<T | null> {
  const response = await fetch(
    `${DB_URL}/${path}.json?auth=${encodeURIComponent(idToken)}`
  );
  if (!response.ok) return null;
  const value = await response.json();
  return (value ?? null) as T | null;
}

function money(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmail(
  booking: Booking,
  settings: TripSettings,
  ticketCodes: string[]
) {
  const traveller = booking.travellers[0];
  const when = [settings.startDate, settings.departureTime]
    .filter(Boolean)
    .join(" · ");

  const rows: [string, string][] = [
    ["Booking code", booking.bookingCode],
    ["Name", traveller?.name || booking.bookerName],
    ["NIFT ID", booking.niftId],
    ["Amount paid", money(booking.pricing.total)],
    ["Paid to", booking.payeeUpiId || "—"],
  ];
  if (when) rows.push(["Departure", when]);
  if (settings.pickupPoint) rows.push(["Pickup point", settings.pickupPoint]);

  const details = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#78716c;font-size:13px;">${escapeHtml(
          label
        )}</td><td style="padding:6px 0;font-weight:600;color:#1c1917;font-size:14px;">${escapeHtml(
          value
        )}</td></tr>`
    )
    .join("");

  // The QR itself lives on the booking page — images in email get blocked,
  // and the code below each QR is the same string the scanner accepts, so a
  // student with no signal at the bus can still be checked in by reading it
  // out. That is why the code is in the mail and the picture is not.
  const codes = ticketCodes.length
    ? `<p style="margin:24px 0 6px;font-size:13px;color:#78716c;">Your ticket code${
        ticketCodes.length > 1 ? "s" : ""
      } — shown at the bus if the QR won't scan:</p>
       <p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:20px;letter-spacing:2px;font-weight:700;color:#1c1917;">${ticketCodes
         .map(escapeHtml)
         .join("<br/>")}</p>`
    : "";

  const group = settings.whatsappGroupUrl
    ? `<p style="margin:28px 0 0;"><a href="${escapeHtml(
        settings.whatsappGroupUrl
      )}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9999px;font-weight:600;font-size:15px;">Join the trip WhatsApp group</a></p>
       <p style="margin:10px 0 0;font-size:12px;color:#78716c;">All trip updates go out in the group. Please join before the day.</p>`
    : "";

  const html = `<div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;background:#faf9f7;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:18px;padding:32px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a8a29e;">APC Club</p>
    <h1 style="margin:0 0 6px;font-size:26px;color:#1c1917;">You're confirmed for ${escapeHtml(
      settings.tripName || "Jawai Safari"
    )}</h1>
    <p style="margin:0 0 24px;color:#57534e;font-size:15px;line-height:1.6;">Your payment has been verified and your seat is booked. Here are your details.</p>
    <table style="border-collapse:collapse;width:100%;">${details}</table>
    ${codes}
    ${group}
    <hr style="border:none;border-top:1px solid #e7e5e4;margin:28px 0 16px;"/>
    <p style="margin:0;font-size:13px;color:#78716c;line-height:1.6;">Questions? Message ${escapeHtml(
      settings.contactName || "Yasar CH"
    )}${settings.contactRole ? `, ${escapeHtml(settings.contactRole)}` : ""}${
      settings.contactPhone ? ` — ${escapeHtml(settings.contactPhone)}` : ""
    }.</p>
  </div>
</div>`;

  const text = [
    `You're confirmed for ${settings.tripName || "Jawai Safari"}.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(ticketCodes.length ? ["", `Ticket code: ${ticketCodes.join(", ")}`] : []),
    ...(settings.whatsappGroupUrl
      ? ["", `Join the trip WhatsApp group: ${settings.whatsappGroupUrl}`]
      : []),
    "",
    `Questions? ${settings.contactName || "Yasar CH"} — ${settings.contactPhone || ""}`,
  ].join("\n");

  return { html, text };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken || !(await verifyIdToken(idToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured) {
    return NextResponse.json(
      {
        error:
          "Email isn't set up. Set GMAIL_USER and GMAIL_APP_PASSWORD to send confirmations.",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const bookingId: string = body.bookingId;
  if (!bookingId || typeof bookingId !== "string") {
    return NextResponse.json({ error: "Which booking?" }, { status: 400 });
  }

  const booking = await readAs<Booking>(`jawaiTrip/bookings/${bookingId}`, idToken);
  if (!booking) {
    return NextResponse.json(
      { error: "That booking could not be read." },
      { status: 404 }
    );
  }

  // Read from the database, never from the request: this is what stops a
  // confirmation being sent for a booking no admin has verified.
  if (booking.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "That booking isn't confirmed yet." },
      { status: 409 }
    );
  }

  const to = booking.bookerEmail;
  if (!to) {
    return NextResponse.json(
      { error: "That booking has no email address on it." },
      { status: 422 }
    );
  }

  const settings =
    (await readAs<TripSettings>("jawaiTrip/settings", idToken)) ??
    ({} as TripSettings);
  const ticketMap =
    (await readAs<Record<string, boolean>>(
      `jawaiTrip/ticketsByBooking/${bookingId}`,
      idToken
    )) ?? {};

  const { html, text } = buildEmail(booking, settings, Object.keys(ticketMap));

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    await transport.sendMail({
      from: `"APC Club" <${process.env.GMAIL_USER}>`,
      to,
      subject: `Confirmed — ${settings.tripName || "Jawai Safari"} · ${booking.bookingCode}`,
      text,
      html,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Gmail refused the message: ${reason}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ sent: true, to });
}
