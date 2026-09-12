import { paymentState, withLegacyPayment } from "./payments";
import { Booking, TripSettings } from "./types";

/**
 * The confirmation message, and the spreadsheet row that goes with it.
 *
 * Kept here rather than in the Apps Script so the wording lives in version
 * control with everything else. The script is a dumb relay: it is given a
 * finished subject and body and a finished row, which means changing the
 * copy is a deploy of this app, not a re-deploy of a script pasted into a
 * spreadsheet — the step nobody remembers to do.
 */

/** Column order for the Google Sheet. The script writes this as the header. */
export const SHEET_COLUMNS = [
  "Booking code",
  "Status",
  "Name",
  "Email",
  "Phone",
  "NIFT ID",
  "Programme",
  "Semester",
  "Age",
  "Gender",
  "Blood group",
  "Medical conditions",
  "Allergies",
  "Medications",
  "Emergency contact",
  "Emergency phone",
  "Relation",
  "Amount due",
  "Amount paid",
  "Still owed",
  "Transfers",
  "Promo code",
  "Paid to UPI",
  "Booked at",
  "Confirmed at",
  "Confirmed by",
] as const;

function stamp(value: number | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

/** One booking as a row, in SHEET_COLUMNS order. */
export function sheetRow(booking: Booking): (string | number)[] {
  const traveller = booking.travellers[0];
  // A seat is often paid in two transfers - the bank caps the first payment
  // to a new UPI ID - so the sheet carries the running total, not just the
  // price, and "Still owed" is the column worth sorting on.
  const money = paymentState(withLegacyPayment(booking));
  return [
    booking.bookingCode,
    booking.status,
    traveller?.name ?? booking.bookerName,
    booking.bookerEmail,
    traveller?.phone ?? booking.bookerPhone,
    booking.niftId,
    traveller?.programme ?? "",
    traveller?.semester ?? "",
    traveller?.age ?? "",
    traveller?.gender ?? "",
    traveller?.bloodGroup ?? "",
    traveller?.medicalConditions ?? "",
    traveller?.allergies ?? "",
    traveller?.medications ?? "",
    traveller?.emergencyContactName ?? "",
    traveller?.emergencyContactPhone ?? "",
    traveller?.emergencyContactRelation ?? "",
    booking.pricing.total,
    money.paid,
    money.outstanding,
    money.transfers.length,
    booking.pricing.promoCode ?? "",
    booking.payeeUpiId ?? "",
    stamp(booking.createdAt),
    stamp(booking.verifiedAt),
    booking.verifiedByName ?? "",
  ];
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

export interface ConfirmationEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildConfirmationEmail(
  booking: Booking,
  settings: Partial<TripSettings>,
  ticketCodes: string[]
): ConfirmationEmail {
  const traveller = booking.travellers[0];
  const tripName = settings.tripName || "Jawai Safari";
  const when = [settings.startDate, settings.departureTime].filter(Boolean).join(" · ");

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

  // The QR itself stays on the booking page: images in email get blocked,
  // and the code printed under each QR is the same string the scanner
  // accepts — so a student with no signal at the bus can still be checked
  // in by reading it out. That is why the code is in the mail, not the
  // picture.
  const codes = ticketCodes.length
    ? `<p style="margin:24px 0 6px;font-size:13px;color:#78716c;">Your ticket code${
        ticketCodes.length > 1 ? "s" : ""
      } — read this out at the bus if the QR won't scan:</p>
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
      tripName
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
    `You're confirmed for ${tripName}.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(ticketCodes.length ? ["", `Ticket code: ${ticketCodes.join(", ")}`] : []),
    ...(settings.whatsappGroupUrl
      ? ["", `Join the trip WhatsApp group: ${settings.whatsappGroupUrl}`]
      : []),
    "",
    `Questions? ${settings.contactName || "Yasar CH"} — ${settings.contactPhone || ""}`,
  ].join("\n");

  return {
    subject: `Confirmed — ${tripName} · ${booking.bookingCode}`,
    html,
    text,
  };
}
