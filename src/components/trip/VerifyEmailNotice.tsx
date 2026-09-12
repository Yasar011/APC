"use client";

import { useState } from "react";
import { MailWarning, RefreshCw } from "lucide-react";
import { sendEmailVerification } from "firebase/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";

/**
 * "Verify your email" — shown until they do.
 *
 * The confirmation with their ticket is emailed, so an address nobody has
 * proved is reachable is a seat that quietly never gets confirmed. Firebase
 * sends the verification; this is the nagging.
 *
 * The spam line is not boilerplate. Automated mail to a student address
 * lands in Spam or Promotions often enough that "I never got it" nearly
 * always means "I didn't look there", so it is said up front — on the
 * banner, on the button, and again after a re-send.
 */
export function VerifyEmailNotice() {
  const { user, emailVerified, refreshUser } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  if (!user || emailVerified) return null;

  async function resend() {
    if (!auth.currentUser) return;
    setSending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast.success("Verification email sent.", {
        description: "Check Spam and Promotions too — it often lands there.",
        duration: 8000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("too-many-requests")
          ? "Too many requests — wait a minute, then check your Spam folder before trying again."
          : "Couldn't send the verification email. Try again in a moment."
      );
    } finally {
      setSending(false);
    }
  }

  async function check() {
    setChecking(true);
    try {
      await refreshUser();
      // Reading the refreshed value rather than the render-time one: state
      // set above isn't visible until the next render.
      if (auth.currentUser?.emailVerified) {
        toast.success("Email verified.");
      } else {
        toast.message("Still not verified.", {
          description:
            "Open the link in the email first — check Spam and Promotions.",
        });
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <MailWarning className="h-4 w-4 shrink-0" />
        Verify your email address
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-900">
        We sent a link to <strong>{user.email}</strong>. Your ticket and trip
        details are emailed to this address, so it has to work.
        <strong> Check your Spam and Promotions folders</strong> — that is where
        it usually is.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={check} loading={checking}>
          <RefreshCw className="h-3.5 w-3.5" />
          I&apos;ve clicked the link
        </Button>
        <Button size="sm" variant="ghost" onClick={resend} loading={sending}>
          Send it again
        </Button>
      </div>
    </div>
  );
}
