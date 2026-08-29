"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ClipboardList, LogOut, Mountain, QrCode, Tag, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, CardBody, FullPageSpinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Bookings", icon: ClipboardList },
  { href: "/admin/scan", label: "Bus check-in", icon: QrCode },
  { href: "/admin/roster", label: "Roster", icon: Users },
  { href: "/admin/promos", label: "Promo codes", icon: Tag },
];

/**
 * Admin is whoever is listed under jawaiTrip/admins in the database. This
 * gate is a convenience — the database rules enforce the same thing, so
 * hiding the UI is not what keeps anyone out.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/admin");
  }, [loading, user, router]);

  if (loading || !user) return <FullPageSpinner />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <Card className="max-w-md">
          <CardBody className="text-center">
            <p className="text-sm font-medium text-neutral-900">This area is for trip admins</p>
            <p className="mt-2 text-sm text-neutral-500">
              Signed in as {user.email}. To grant admin access, add this account&apos;s UID
              under <code className="rounded bg-neutral-100 px-1">jawaiTrip/admins</code> in
              the Firebase console:
            </p>
            <code className="mt-3 block break-all rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-700">
              {user.uid}
            </code>
            <div className="mt-5 flex justify-center gap-2">
              <Link href="/">
                <Button variant="outline" size="sm">
                  Trip page
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="no-print border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="flex items-center gap-2 text-sm font-semibold">
            <Mountain className="h-5 w-5 text-amber-500" />
            Jawai admin
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-amber-100 text-amber-900"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
