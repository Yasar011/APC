"use client";

import { isFirebaseConfigured } from "@/lib/firebase";
import { AlertTriangle } from "lucide-react";

/**
 * Without APC's Firebase config the app builds and renders, but nothing can
 * read or write. Rather than let every page fail with an opaque Firebase
 * error, say plainly what is missing. Renders nothing once configured.
 */
export function SetupNotice() {
  if (isFirebaseConfigured) return null;

  return (
    // Pinned to the bottom rather than the top: the trip page has a fixed
    // nav at top-0, and a banner there would sit on top of it.
    <div className="no-print fixed inset-x-0 bottom-0 z-[60] flex items-start gap-3 bg-amber-500 px-4 py-3 text-sm text-neutral-950 shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <strong>Firebase isn&apos;t configured.</strong> Copy{" "}
        <code className="rounded bg-black/10 px-1">.env.example</code> to{" "}
        <code className="rounded bg-black/10 px-1">.env.local</code> and fill in APC&apos;s
        Firebase web config (including <code className="rounded bg-black/10 px-1">
          NEXT_PUBLIC_FIREBASE_DATABASE_URL
        </code>). Sign-in and booking stay disabled until then.
      </p>
    </div>
  );
}
