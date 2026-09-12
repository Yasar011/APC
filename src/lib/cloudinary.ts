import { auth } from "./firebase";

/**
 * Cloudinary uploads, the same shape as the TEDx app: the browser asks our
 * own server for a signature, then uploads straight to Cloudinary. The file
 * never passes through the server, and the API secret never reaches a page.
 */

export const PAYMENTS_FOLDER = "jawai/payments";

/**
 * Whether Cloudinary is set up. Only the cloud name is public, so this is
 * all the browser can check — the server-side key and secret are verified
 * when a signature is actually requested.
 */
export const isCloudinaryConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
);

interface Signature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

async function requestSignature(folder: string): Promise<Signature> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("You need to be signed in to upload.");

  const response = await fetch("/api/cloudinary/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ folder }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Could not start the upload.");
  }
  return response.json();
}

/**
 * Uploads a blob and returns its permanent https URL.
 *
 * The blob is already resized by the caller — a payment screenshot only has
 * to be readable by a human checking an amount, and it keeps the club's
 * Cloudinary quota going a lot further across 89 of them.
 */
export async function uploadToCloudinary(
  blob: Blob,
  fileName: string
): Promise<string> {
  const { signature, timestamp, apiKey, cloudName, folder } =
    await requestSignature(PAYMENTS_FOLDER);

  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Upload failed (${response.status}).`);
  }

  const data = await response.json();
  if (!data.secure_url) throw new Error("Cloudinary didn't return a URL.");
  return data.secure_url as string;
}
