import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function rupees(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(value: string | number | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function friendlyAuthError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const code = raw.match(/\(([^)]+)\)/)?.[1] ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match an account.";
    case "auth/email-already-in-use":
      return "An account with this email already exists — sign in instead.";
    case "auth/weak-password":
      return "Password needs to be at least 6 characters.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "Network problem — check your connection and try again.";
    default:
      return raw.replace("Firebase: ", "");
  }
}
