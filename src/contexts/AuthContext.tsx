"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { readRole } from "@/lib/trip";
import { Role } from "@/lib/types";

interface AuthValue {
  user: User | null;
  /** From APC's shared `roles` node - the same one movie night uses. */
  role: Role;
  /** Full access: verify payments, edit settings, see the margin. */
  isAdmin: boolean;
  /** Admins, plus staff — enough to scan people onto the bus. */
  canScan: boolean;
  /** Whether they have clicked the link in the verification email. */
  emailVerified: boolean;
  /** Re-checks with Firebase, for after they've clicked the link. */
  refreshUser: () => Promise<void>;
  loading: boolean;
  displayName: string;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  role: null,
  isAdmin: false,
  canScan: false,
  emailVerified: false,
  refreshUser: async () => {},
  loading: true,
  displayName: "",
  signOut: async () => {},
});

/**
 * Sits on APC's existing Firebase Auth - the same accounts people already
 * use for movie night - and on the same `roles` node for who is an admin.
 *
 * This app deliberately writes no user profile of its own: everything it
 * needs about a person is captured on the booking, so it can never collide
 * with APC's existing user data. It only ever reads `roles`.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  // Mirrored into state because `user.emailVerified` is a field on a stable
  // object: clicking the link changes it without React ever re-rendering.
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      setEmailVerified(next?.emailVerified ?? false);
      if (!next) {
        setRole(null);
        setLoading(false);
        return;
      }
      setRole(await readRole(next.uid));
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      role,
      isAdmin: role === "admin",
      canScan: role === "admin" || role === "staff",
      emailVerified,
      refreshUser: async () => {
        if (!auth.currentUser) return;
        await auth.currentUser.reload();
        // reload() updates this object, but NOT the ID token — and the
        // database rules read `auth.token.email_verified`, not this. Without
        // forcing a new token the page unlocks while the token still says
        // the address is unverified, and the write is refused for a reason
        // nothing on screen can explain. Firebase would get there on its
        // own within the hour; a student booking a seat will not wait.
        await auth.currentUser.getIdToken(true);
        setUser(auth.currentUser);
        setEmailVerified(auth.currentUser.emailVerified);
      },
      loading,
      displayName: user?.displayName || user?.email?.split("@")[0] || "there",
      signOut: () => firebaseSignOut(auth),
    }),
    [user, role, emailVerified, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
