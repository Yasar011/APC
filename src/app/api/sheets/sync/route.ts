import { NextResponse } from "next/server";
import { SHEET_COLUMNS, sheetRow } from "@/lib/confirmationEmail";
import { isSheetsConfigured, postToAppsScript } from "@/lib/sheets";
import { readAs, requireSignedIn } from "@/lib/serverAuth";
import { Booking } from "@/lib/types";

/**
 * Pushes every booking into the trip spreadsheet.
 *
 * Confirmations write their own row as they go out, so this is for the
 * rest: bookings made before the sheet existed, ones still waiting to be
 * verified, and anything edited in the sheet by hand that should be put
 * back. Rows are matched on the booking code, so running it repeatedly
 * updates in place rather than piling up duplicates.
 *
 * **Admin-only, enforced by the database rules rather than by a check
 * here.** It reads the whole `jawaiTrip/bookings` node as the caller, and
 * the rules grant a student read on one booking but never on the parent —
 * so a read that succeeds is itself the proof. No second copy of the admin
 * list to drift out of step.
 */

export async function POST(request: Request) {
  const idToken = await requireSignedIn(request);
  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSheetsConfigured) {
    return NextResponse.json(
      {
        error:
          "Google Sheets isn't set up yet. Deploy the Apps Script (see apps-script/Code.gs), then set SHEETS_WEBHOOK_URL and SHEETS_WEBHOOK_SECRET.",
      },
      { status: 503 }
    );
  }

  const all = await readAs<Record<string, Booking>>("jawaiTrip/bookings", idToken);
  if (all === null) {
    return NextResponse.json(
      { error: "Only admins can sync the sheet." },
      { status: 403 }
    );
  }

  const bookings = Object.entries(all).map(([id, booking]) => ({ ...booking, id }));
  if (bookings.length === 0) {
    return NextResponse.json({ wrote: 0 });
  }

  // Oldest first, so the sheet reads in the order people booked.
  bookings.sort((a, b) => a.createdAt - b.createdAt);

  try {
    const result = await postToAppsScript({
      header: SHEET_COLUMNS,
      rows: bookings.map(sheetRow),
      // Rows only. Nobody wants a sync to mail 89 students a second time.
      emails: [],
    });
    return NextResponse.json({ wrote: result.wrote });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
