import "server-only";
import { ConfirmationEmail } from "./confirmationEmail";

/**
 * Talking to the Apps Script deployed on the trip spreadsheet.
 *
 * Server-side only, and deliberately not in the database: the script's
 * deployment has to be reachable by "Anyone" for us to call it without a
 * Google login, so its URL and secret are the whole of its security. The
 * settings node is world-readable, so putting them there would publish
 * them. Environment variables keep both out of the browser entirely.
 */

export const isSheetsConfigured = Boolean(
  process.env.SHEETS_WEBHOOK_URL && process.env.SHEETS_WEBHOOK_SECRET
);

export interface SheetsPayload {
  header?: readonly string[];
  rows?: (string | number)[][];
  emails?: (ConfirmationEmail & { to: string })[];
  fromName?: string;
}

export interface SheetsResult {
  wrote: number;
  sent: string[];
  failed: { to: string; error: string }[];
}

export async function postToAppsScript(
  payload: SheetsPayload
): Promise<SheetsResult> {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const secret = process.env.SHEETS_WEBHOOK_SECRET;
  if (!url || !secret) {
    throw new Error(
      "Google Sheets isn't set up. Set SHEETS_WEBHOOK_URL and SHEETS_WEBHOOK_SECRET."
    );
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      // Apps Script answers a web app call with a 302 to a
      // googleusercontent.com address that carries the actual body, so the
      // redirect has to be followed rather than treated as the answer.
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, secret }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    throw new Error(`Could not reach the Apps Script: ${reason}`);
  }

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `The Apps Script returned ${response.status}. Check the deployment is a Web App with access set to "Anyone".`
    );
  }

  let parsed: { ok?: boolean; error?: string } & Partial<SheetsResult>;
  try {
    parsed = JSON.parse(body);
  } catch {
    // A login page rather than JSON is the usual sign of a deployment set
    // to "Only myself", and it is worth saying so outright — the raw HTML
    // is not a useful error message.
    throw new Error(
      'The Apps Script replied with a page instead of data. That usually means the deployment\'s "Who has access" is not set to "Anyone".'
    );
  }

  if (!parsed.ok) {
    throw new Error(parsed.error || "The Apps Script rejected the request.");
  }

  return {
    wrote: parsed.wrote ?? 0,
    sent: parsed.sent ?? [],
    failed: parsed.failed ?? [],
  };
}
