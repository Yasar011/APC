/**
 * APC Jawai trip — Google Sheet + confirmation mail.
 *
 * Paste this into the trip spreadsheet's Apps Script editor and deploy it
 * as a Web App. The site then posts confirmed bookings here, and this
 * script writes them into the sheet and emails the student.
 *
 * Why this rather than an SMTP password: MailApp sends as the Google
 * account that owns this script, so there is no App Password to create,
 * no mail credential sitting on a server, and the mail arrives from the
 * address students already recognise. The sheet fills itself in at the
 * same time, which is the other half of what was wanted.
 *
 * ---------------------------------------------------------------------
 * SETUP
 *
 *  1. Open the trip spreadsheet, then Extensions > Apps Script.
 *  2. Delete whatever is in Code.gs and paste this whole file in.
 *  3. Change SECRET below to a long random string of your own.
 *  4. Save, then Deploy > New deployment > type "Web app".
 *       Execute as:      Me
 *       Who has access:  Anyone
 *     ("Anyone" is what lets the site call it without a Google login.
 *     The SECRET is what keeps strangers out - see doPost.)
 *  5. Authorise it when Google asks. The "unverified app" warning is
 *     expected for your own script: Advanced > Go to (project name).
 *  6. Copy the /exec URL it gives you at the end.
 *  7. Put both into the site's environment (.env.local, and Vercel):
 *       SHEETS_WEBHOOK_URL=<the /exec URL>
 *       SHEETS_WEBHOOK_SECRET=<the same SECRET as below>
 *
 * After any edit here, deploy again as a NEW VERSION - otherwise Google
 * keeps serving the old code and it looks like nothing changed.
 * ---------------------------------------------------------------------
 */

/** Must match SHEETS_WEBHOOK_SECRET on the site. Change it. */
var SECRET = "change-me-to-something-long-and-random";

/** The trip spreadsheet. Taken from its URL, between /d/ and /edit. */
var SPREADSHEET_ID = "17JjP5yBaNXQ3R98voi_dWOKcLtYzfu4L_x_yP13oAww";

/** Tab the bookings are written to. Created if it isn't there. */
var SHEET_NAME = "Bookings";

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: "Body was not JSON" });
  }

  // The deployment has to be reachable by "Anyone" for the site to call it
  // without a Google sign-in, so this shared secret is the only thing
  // between the endpoint and the open internet. Checked before anything is
  // written or sent.
  if (!payload || payload.secret !== SECRET) {
    return json({ ok: false, error: "Bad secret" });
  }

  // Two calls arriving together would otherwise both read the same last
  // row, and one would overwrite the other.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json({ ok: false, error: "Sheet was busy, try again" });
  }

  try {
    var wrote = 0;
    if (payload.header && payload.rows && payload.rows.length) {
      wrote = upsertRows(payload.header, payload.rows);
    }

    var sent = [];
    var failed = [];
    var emails = payload.emails || [];
    for (var i = 0; i < emails.length; i++) {
      var mail = emails[i];
      if (!mail || !mail.to) continue;
      try {
        MailApp.sendEmail({
          to: mail.to,
          subject: mail.subject,
          body: mail.text || "",
          htmlBody: mail.html || "",
          name: payload.fromName || "APC Club"
        });
        sent.push(mail.to);
      } catch (err) {
        // One bad address must not lose the rest of the batch, nor the
        // sheet write that has already succeeded.
        failed.push({ to: mail.to, error: String(err) });
      }
    }

    return json({ ok: true, wrote: wrote, sent: sent, failed: failed });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Writes rows, matching on the booking code in column A.
 *
 * An existing booking is updated in place rather than appended, so the
 * site can re-send or re-sync as often as it likes without the sheet
 * filling up with duplicates of the same student.
 */
function upsertRows(header, rows) {
  var book = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
  }

  // Header, written once, and rewritten if the site's columns ever change.
  var existingHeader =
    sheet.getLastRow() > 0
      ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
      : [];
  if (existingHeader.join(" ") !== header.join(" ")) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  // One read of column A, rather than a lookup per row.
  var lastRow = sheet.getLastRow();
  var index = {};
  if (lastRow > 1) {
    var codes = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < codes.length; i++) {
      var code = String(codes[i][0]).trim();
      if (code) index[code] = i + 2;
    }
  }

  var appended = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var key = String(row[0]).trim();
    var at = index[key];
    if (at) {
      sheet.getRange(at, 1, 1, row.length).setValues([row]);
    } else {
      appended.push(row);
    }
  }

  if (appended.length) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, appended.length, header.length)
      .setValues(appended);
  }

  return rows.length;
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/** Open the /exec URL in a browser and you should see this. */
function doGet() {
  return json({ ok: true, service: "APC Jawai trip" });
}
