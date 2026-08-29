import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export function validateScreenshot(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Upload an image of your payment (PNG or JPG screenshot).";
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep it under 5 MB.`;
  }
  return null;
}

/**
 * Payment screenshots live under the booker's own uid, which is what the
 * Storage rules key off - a student can only ever write into their own
 * folder, and only they and admins can read it back.
 */
export async function uploadScreenshot(uid: string, bookingId: string, file: File) {
  const error = validateScreenshot(file);
  if (error) throw new Error(error);

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `jawaiTrip/payments/${uid}/${bookingId}-${Date.now()}.${extension}`;
  const snapshot = await uploadBytes(storageRef(storage, path), file, {
    contentType: file.type,
  });
  return getDownloadURL(snapshot.ref);
}
