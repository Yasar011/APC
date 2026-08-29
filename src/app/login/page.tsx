"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { Mountain } from "lucide-react";
import { toast } from "sonner";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, CardBody, Field, FullPageSpinner, Input } from "@/components/ui/primitives";
import { friendlyAuthError } from "@/lib/utils";

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Only ever an in-app path, so ?next= can't be used to bounce someone
  // off-site after they sign in.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/book";

  useEffect(() => {
    if (!authLoading && user) router.replace(next);
  }, [authLoading, user, next, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isFirebaseConfigured) {
      toast.error("Firebase isn't configured yet — see the banner at the top.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
      }
      router.replace(next);
    } catch (error) {
      toast.error(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || user) return <FullPageSpinner />;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-glow absolute -top-32 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-amber-500/20 blur-[120px]" />
      </div>

      <div className="animate-fade-up relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold text-white"
        >
          <Mountain className="h-5 w-5 text-amber-500" />
          APC Club <span className="text-neutral-500">/</span>{" "}
          <span className="text-amber-500">Jawai</span>
        </Link>

        <Card>
          <CardBody className="pt-6">
            <div className="mb-6 text-center">
              <h1 className="text-lg font-semibold text-neutral-900">
                {mode === "signin" ? "Sign in to book" : "Create your account"}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {mode === "signin"
                  ? "Use the same account as the APC movie night."
                  : "New to APC? Set up an account to book your seat."}
              </p>
            </div>

            <div className="relative mb-5 flex rounded-lg bg-neutral-100 p-1 text-sm font-medium">
              <span
                aria-hidden
                className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-md bg-white shadow-sm transition-transform duration-300"
                style={{
                  transform: mode === "signin" ? "translateX(0)" : "translateX(100%)",
                }}
              />
              {(["signin", "signup"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`relative z-10 flex-1 rounded-md py-1.5 transition-colors ${
                    mode === value ? "text-neutral-900" : "text-neutral-500"
                  }`}
                >
                  {value === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <Field label="Full name" required>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    autoComplete="name"
                    placeholder="As it appears on your ID"
                  />
                </Field>
              )}

              <Field label="Email" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                />
              </Field>

              <Field
                label="Password"
                required
                hint={mode === "signup" ? "At least 6 characters." : undefined}
              >
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </Field>

              <Button type="submit" loading={busy} className="w-full" size="lg">
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-xs text-neutral-500">
          <Link href="/" className="hover:text-neutral-300">
            Back to the trip page
          </Link>
        </p>
      </div>
    </div>
  );
}
