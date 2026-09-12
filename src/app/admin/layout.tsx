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

const SCANNER_PATH = "/admin/scan";

/**
 * Roles come from APC's shared `roles` node, so whoever already runs movie
 * night runs this too, with nothing to set up.
 *
 * Admins get everything. Staff get the bus scanner only — the same job they
 * already do checking people in on movie night — and never see payments,
 * the roster or the margin.
 *
 * This gate is a convenience: the database rules enforce the same split, so
 * hiding the UI is not what keeps anyone out.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, canScan, role, loading, signOut, displayName } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Staff belong on the scanner and nowhere else in here.
  const staffOnly = !isAdmin && canScan;
  const onScanner = pathname === SCANNER_PATH;

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/admin");
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && staffOnly && !onScanner) router.replace(SCANNER_PATH);
  }, [loading, staffOnly, onScanner, router]);

  if (loading || !user) return <FullPageSpinner />;

  if (staffOnly && !onScanner) return <FullPageSpinner />;

  if (!isAdmin && !canScan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#c3d2d7] px-6">
        <Card className="max-w-md rounded-2xl">
          <CardBody className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#16323f]">
              <Mountain className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#16323f]">
              This area is for trip admins
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Signed in as {user.email}
              {role ? ` (role: ${role})` : ""}. Access uses APC&apos;s shared roles, the same
              as movie night — set{" "}
              <code className="rounded bg-neutral-100 px-1">roles/&lt;uid&gt;</code> to{" "}
              <code className="rounded bg-neutral-100 px-1">&quot;admin&quot;</code> (or{" "}
              <code className="rounded bg-neutral-100 px-1">&quot;staff&quot;</code> for bus
              check-in only) in the Firebase console. This account&apos;s uid:
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

  const visibleNav = isAdmin ? NAV : NAV.filter((item) => item.href === SCANNER_PATH);

  return (
    <div className="min-h-screen bg-[#c3d2d7] px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[26px] bg-white shadow-[0_20px_70px_rgba(15,35,45,0.18)]">
        {/* ---------------------------------------------------- top bar */}
        <header className="no-print bg-[#16323f] px-5 py-4 text-white sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-2">
              <Mountain className="h-5 w-5 text-amber-400" />
              <span className="text-base font-bold tracking-tight">
                APC
                <span className="font-light text-white/40">/</span>
                <span className="text-amber-400">jawai</span>
              </span>
              <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                {isAdmin ? "Admin" : "Staff"}
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-white/60 sm:block">{displayName}</span>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------- tabs */}
        <nav className="no-print flex gap-1 overflow-x-auto border-b border-neutral-200 px-3 py-2 sm:px-6">
          {visibleNav.map((item) => {
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
                  "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#16323f] text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-[#16323f]"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/"
            className="ml-auto hidden items-center whitespace-nowrap rounded-full px-4 py-2 text-sm text-neutral-400 transition-colors hover:text-[#16323f] sm:flex"
          >
            View trip page
          </Link>
        </nav>

        <main className="px-5 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
