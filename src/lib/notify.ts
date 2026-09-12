import { auth } from "./firebase";
import { Booking, TripSettings } from "./types";

/**
 * Telling a student their seat is confirmed.
 *
 * Two ways, because the club should not be stuck if one is not set up:
 *
 *  - **Email**, through `/api/email/confirmation`, which needs the club's
 *    Gmail App Password on the server;
 *  - **WhatsApp**, which needs nothing at all — the number is already on
 *    the booking, and the admin sends it from their own phone.
 *
 * The email is the one that scales to 89 students. The WhatsApp link is the
 * one that works this afternoon.
 */

const COUNTRY_CODE = "91";

export async function sendConfirmationEmail(bookingId: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("You need to be signed in.");

  const response = await fetch("/api/email/confirmation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ bookingId }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "Could not send the email.");
  return body.to as string;
}

/**
 * Pushes every booking into the trip spreadsheet. Rows only - a sync must
 * never mail 89 students a second time.
 */
export async function syncBookingsToSheet(): Promise<number> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("You need to be signed in.");

  const response = await fetch("/api/sheets/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "Could not sync the sheet.");
  return (body.wrote as number) ?? 0;
}

/** The same confirmation, as a WhatsApp message ready to send. */
export function whatsappConfirmationHref(
  booking: Booking,
  settings: Partial<TripSettings>
): string | null {
  const raw = (booking.travellers[0]?.phone || booking.bookerPhone || "").replace(
    /\D/g,
    ""
  );
  if (raw.length < 10) return null;
  const number = raw.length > 10 ? raw : `${COUNTRY_CODE}${raw}`;

  const name = booking.travellers[0]?.name || booking.bookerName;
  const when = [settings.startDate, settings.departureTime].filter(Boolean).join(" · ");

  const lines = [
    `Hi ${name}! Your payment is verified — you're confirmed for ${
      settings.tripName || "the Jawai trip"
    }. 🎉`,
    "",
    `Booking code: ${booking.bookingCode}`,
    `Amount paid: ₹${booking.pricing.total.toLocaleString("en-IN")}`,
  ];
  if (when) lines.push(`Departure: ${when}`);
  if (settings.pickupPoint) lines.push(`Pickup: ${settings.pickupPoint}`);
  lines.push("", "Your QR ticket is on your booking page on the site.");
  if (settings.whatsappGroupUrl) {
    lines.push("", `Join the trip group: ${settings.whatsappGroupUrl}`);
  }

  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
}
