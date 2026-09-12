/**
 * Spreadsheet export.
 *
 * CSV rather than a live Google Sheets sync, because a sync needs a service
 * account, a shared sheet and a set of credentials to go wrong — and this
 * app has been blocked by missing setup more than once. A downloaded file
 * opens in Google Sheets (File > Import > Upload, or drag it onto Drive),
 * in Excel and in Numbers, works with no configuration at all, and is a
 * snapshot the club still has if the database is unreachable on trip day.
 */

/**
 * Escapes one cell.
 *
 * Text starting with = + - @ is prefixed with a quote: spreadsheets treat
 * those as formulas, and a name or NIFT ID typed by a student is not
 * something to hand to a formula engine.
 *
 * Numbers skip that guard. They cannot carry a formula, and quoting them
 * would make a negative one - a booking sold below cost, which is exactly
 * the row worth looking at - land as text that Sheets refuses to add up.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

/**
 * Triggers the download.
 *
 * The BOM is what makes Google Sheets and Excel read it as UTF-8 rather
 * than mangling any non-ASCII name in the roster.
 */
export function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** e.g. jawai-bookings-2026-09-12.csv */
export function stampedFileName(stem: string): string {
  return `${stem}-${new Date().toISOString().slice(0, 10)}.csv`;
}
