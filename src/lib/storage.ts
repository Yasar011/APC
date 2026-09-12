import { get, ref, set } from "firebase/database";
import { db, tripPath } from "./firebase";
import { Booking } from "./types";

/**
 * Payment screenshots.
 *
 * These used to go to Firebase Storage, which meant a second rules file to
 * publish, a bucket to provision, and an upload that simply hung forever
 * when either was missing. For 89 phone screenshots that was a lot of
 * moving parts to get wrong.
 *
 * They are now shrunk in the browser and written into the Realtime Database
 * the app already uses. A resized JPEG is well under 200 KB, so the whole
 * trip is a few megabytes - nothing against the free tier - and there is
 * nothing extra to set up.
 *
 * They live under `jawaiTrip/paymentShots/<bookingId>`, NOT on the booking
 * itself, so the admin list can load 89 bookings without dragging 89 images
 * down with them. Only opening one booking fetches its image.
 */

/** Marker stored on the booking when the image is in the database. */
export const STORED_IN_DB = "stored";

/** Comfortably under Realtime Database's string limit, with headroom. */
const MAX_ENCODED_BYTES = 700_000;
const MAX_DIMENSION = 1280;

export function validateScreenshot(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Upload an image of your payment (a PNG or JPG screenshot).";
  }
  // Generous: it gets shrunk before it goes anywhere.
  if (file.size > 25 * 1024 * 1024) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep it under 25 MB.`;
  }
  return null;
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path below.
    }
  }
  // Older Safari, and anything where createImageBitmap refuses the format.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    image.src = url;
  });
}

/**
 * Resizes and re-encodes as JPEG, dropping quality until it fits. A payment
 * screenshot only has to be readable by a human checking an amount, so the
 * loss is irrelevant and the saving is large.
 */
async function compress(file: File): Promise<string> {
  const source = await loadImage(file);
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;
  if (!width || !height) throw new Error("That image appears to be empty.");

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser wouldn't let us resize the image.");
  context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  for (const quality of [0.72, 0.6, 0.45, 0.3]) {
    const encoded = canvas.toDataURL("image/jpeg", quality);
    if (encoded.length <= MAX_ENCODED_BYTES) return encoded;
  }

  throw new Error(
    "That screenshot is too detailed to send. Crop it to just the payment confirmation and try again."
  );
}

/**
 * Firebase retries a failed write for a long time before giving up, which
 * looks exactly like a frozen button. Fail loudly instead.
 */
function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export async function uploadScreenshot(
  _uid: string,
  bookingId: string,
  file: File
): Promise<string> {
  const error = validateScreenshot(file);
  if (error) throw new Error(error);

  const encoded = await compress(file);

  await withTimeout(
    set(ref(db, tripPath("paymentShots", bookingId)), encoded),
    30_000,
    "Sending the screenshot timed out. Check your connection and try again."
  );

  return STORED_IN_DB;
}

/**
 * What to put in an <img src>. Handles both the database-backed images and
 * any `https://` URL stored by an earlier version.
 */
export async function readScreenshot(booking: Booking): Promise<string | null> {
  if (!booking.paymentScreenshotUrl) return null;
  if (booking.paymentScreenshotUrl.startsWith("http")) {
    return booking.paymentScreenshotUrl;
  }

  const snap = await get(ref(db, tripPath("paymentShots", booking.id)));
  return snap.exists() ? (snap.val() as string) : null;
}
