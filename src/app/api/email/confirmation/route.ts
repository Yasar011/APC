import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import {
  SHEET_COLUMNS,
  buildConfirmationEmail,
  sheetRow,
} from "@/lib/confirmationEmail";
import { isSheetsConfigured, postToAppsScript } from "@/lib/sheets";
import { readAs, requireSignedIn } from "@/lib/serverAuth";
import { Booking, TripSettings } from "@/lib/types";

/**
 * The "you're going to Jawai" email, and the spreadsheet row that goes
 * with it.
 *
 * There are two ways to send, tried in order:
 *
 *  1. **The Apps Script on the trip spreadsheet** (preferred). It writes
 *     the booking into the sheet *and* sends the mail as the Google
 *     account that owns the script. No mail password exists anywhere, and
 *     the sheet stays current without anyone exporting anything.
 *  2. **Gmail SMTP** with an App Password, if the script isn't set up.
 *
 * If neither is configured the booking is still confirmed and the ticket
 * still issued; the admin sends the same message on WhatsApp instead.
 *
 * ## Who is allowed to send one
 *
 * There is no Firebase Admin SDK here, so rather than keeping a second
 * copy of the admin check this route reads the booking *as the caller*,
 * with their own ID token. If the published rules would not let them read
 * that booking, the read fails and so does the send. See src/lib/serverAuth.ts.
 *
 * Two things follow, and they are the whole security model:
 *
 *  - the recipient is the address stored **on the booking**, never one the
 *    caller supplies, so the worst a student can do is mail themselves;
 *  - the status is read from the database, not from the request, so a
 *    confirmation cannot be conjured for a booking nobody has verified.
 */

const isGmailConfigured = Boolean(
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
);

async function sendWithGmail(
  to: string,
  mail: { subject: string; text: string; html: string }
) {
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  await transport.sendMail({
    from: `"APC Club" <${process.env.GMAIL_USER}>`,
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

export async function POST(request: Request) {
  const idToken = await requireSignedIn(request);
  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSheetsConfigured && !isGmailConfigured) {
    return NextResponse.json(
      {
        error:
          "Email isn't set up yet. Quickest: set GMAIL_USER and GMAIL_APP_PASSWORD. " +
          "Or deploy the Apps Script (apps-script/Code.gs) to fill the sheet too. " +
          "Either way, 'Send it on WhatsApp' works right now with no setup.",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const bookingId: string = body.bookingId;
  if (!bookingId || typeof bookingId !== "string") {
    return NextResponse.json({ error: "Which booking?" }, { status: 400 });
  }

  const found = await readAs<Booking>(`jawaiTrip/bookings/${bookingId}`, idToken);
  if (!found) {
    return NextResponse.json(
      { error: "That booking could not be read." },
      { status: 404 }
    );
  }
  // The id is the key, so it isn't stored inside the node the REST read
  // returns; put it back before anything downstream looks for it.
  const booking: Booking = { ...found, id: bookingId };

  // Read from the database, never from the request: this is what stops a
  // confirmation going out for a booking no admin has verified.
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

  const mail = buildConfirmationEmail(booking, settings, Object.keys(ticketMap));

  if (isSheetsConfigured) {
    try {
      const result = await postToAppsScript({
        header: SHEET_COLUMNS,
        rows: [sheetRow(booking)],
        emails: [{ to, ...mail }],
      });
      if (result.failed.length) {
        return NextResponse.json(
          {
            error: `Written to the sheet, but the email failed: ${result.failed[0].error}`,
          },
          { status: 502 }
        );
      }
      return NextResponse.json({ sent: true, to, sheet: result.wrote > 0 });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      // Only fall through to Gmail if it is actually set up. Otherwise the
      // Apps Script failure *is* the answer, and reporting it beats a
      // vaguer message about email in general.
      if (!isGmailConfigured) {
        return NextResponse.json({ error: reason }, { status: 502 });
      }
    }
  }

  try {
    await sendWithGmail(to, mail);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Gmail refused the message: ${reason}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ sent: true, to, sheet: false });
}
