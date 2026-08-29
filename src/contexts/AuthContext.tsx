"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { readIsAdmin } from "@/lib/trip";

interface AuthValue {
  user: User | null;
  /** True when this account is listed under jawaiTrip/admins. */
  isAdmin: boolean;
  loading: boolean;
  displayName: string;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  isAdmin: false,
  loading: true,
  displayName: "",
  signOut: async () => {},
});

/**
 * Sits on APC's existing Firebase Auth - the same accounts people already
 * use for movie night. This app deliberately writes no user profile of its
 * own: everything it needs about a person is captured on the booking, so
 * it can never collide with APC's existing user data.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        setIsAdmin(await readIsAdmin(next.uid));
      } catch {
        // A denied read just means "not an admin" - never block sign-in.
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      isAdmin,
      loading,
      displayName: user?.displayName || user?.email?.split("@")[0] || "there",
      signOut: () => firebaseSignOut(auth),
    }),
    [user, isAdmin, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
