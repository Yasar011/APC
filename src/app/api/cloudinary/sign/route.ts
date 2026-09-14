import { NextResponse } from "next/server";
import crypto from "crypto";
import { firebaseConfig } from "@/lib/firebaseConfig";

/**
 * Signs a Cloudinary upload, the same way the TEDx app does.
 *
 * The signature is made here rather than in the browser because it needs the
 * API secret, which must never reach a page. The browser asks for one, gets
 * back a signature valid for a single upload into a single folder, and does
 * the upload itself — so the file never passes through this server.
 */

/** Confirms the caller is signed in to this Firebase project. */
async function verifyIdToken(idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  return response.ok;
}

/**
 * The folder comes from the browser, so it is checked against a list rather
 * than trusted. Otherwise a signed-in student could have us sign an upload
 * into any folder in the account, including one movie night uses.
 */
const ALLOWED_FOLDERS = ["jawai/payments"];

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken || !(await verifyIdToken(idToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const folder: string = body.folder;

  if (!ALLOWED_FOLDERS.includes(folder)) {
    return NextResponse.json({ error: "Folder not allowed" }, { status: 400 });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!apiKey || !apiSecret || !cloudName) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      },
      { status: 500 }
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

  return NextResponse.json({ signature, timestamp, apiKey, cloudName, folder });
}
