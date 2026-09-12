import { get, ref, set } from "firebase/database";
import { db, tripPath } from "./firebase";
import { isCloudinaryConfigured, uploadToCloudinary } from "./cloudinary";
import { Booking } from "./types";

/**
 * Payment screenshots.
 *
 * They go to **Cloudinary**, the same as the TEDx app: the browser gets a
 * signature from our own server and uploads straight there, so the file
 * never passes through the server and the API secret never reaches a page.
 *
 * If Cloudinary isn't configured, they fall back to the Realtime Database
 * the app already uses — shrunk small enough that 89 of them are a few
 * megabytes. That is deliberate: this app has repeatedly been blocked by a
 * missing piece of setup, and an upload that works before anyone has
 * configured anything is worth more than a tidier single path.
 *
 * Either way they are shrunk first. A payment screenshot only has to be
 * readable by a human checking an amount.
 */

/** Stored on the booking when the image is in the database, not on a CDN. */
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

/** Resizes onto a canvas, ready to be encoded as a blob or a data URL. */
async function resize(file: File): Promise<HTMLCanvasElement> {
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

  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image."))),
      "image/jpeg",
      quality
    );
  });
}

/**
 * Firebase and fetch both retry for a long time before giving up, which
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

  const canvas = await resize(file);

  if (isCloudinaryConfigured) {
    const blob = await toBlob(canvas, 0.8);
    return withTimeout(
      uploadToCloudinary(blob, `${bookingId}.jpg`),
      45_000,
      "The upload timed out. Check your connection and try again."
    );
  }

  // Database fallback: drop quality until it fits comfortably.
  let encoded = "";
  for (const quality of [0.72, 0.6, 0.45, 0.3]) {
    encoded = canvas.toDataURL("image/jpeg", quality);
    if (encoded.length <= MAX_ENCODED_BYTES) break;
    encoded = "";
  }
  if (!encoded) {
    throw new Error(
      "That screenshot is too detailed to send. Crop it to just the payment confirmation and try again."
    );
  }

  await withTimeout(
    set(ref(db, tripPath("paymentShots", bookingId)), encoded),
    30_000,
    "Sending the screenshot timed out. Check your connection and try again."
  );

  return STORED_IN_DB;
}

/**
 * What to put in an <img src>. Cloudinary URLs are used directly; the
 * database fallback is fetched on demand, only when a booking is opened.
 */
export async function readScreenshot(booking: Booking): Promise<string | null> {
  if (!booking.paymentScreenshotUrl) return null;
  if (booking.paymentScreenshotUrl.startsWith("http")) {
    return booking.paymentScreenshotUrl;
  }

  const snap = await get(ref(db, tripPath("paymentShots", booking.id)));
  return snap.exists() ? (snap.val() as string) : null;
}
