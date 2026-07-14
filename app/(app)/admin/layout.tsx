"use client";

import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ADMIN_PROFILE } from "@/constants";
import Doty from "@/components/ui/doty/doty";
import Spinner from "@/components/ui/Spinner/Spinner";

type Access = "checking" | "granted" | "denied";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", exact: true },
  { label: "Levels", href: "/admin/levels" },
  { label: "Readings", href: "/admin/readings" },
  { label: "Users", href: "/admin/users" },
];

const emptySubscribe = () => () => {};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isBootstrapping, accessToken } = useAuth();
  const pathname = usePathname();

  // Two-pass: server render is "checking"; after hydration we can read the
  // stored profile. Derived (not setState-in-effect) to keep renders clean.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const access: Access = useMemo(() => {
    if (!hydrated || isBootstrapping) return "checking";
    if (!accessToken) return "denied";
    try {
      const raw = localStorage.getItem("user");
      const profile = raw ? JSON.parse(raw)?.profile : undefined;
      return Number(profile) === ADMIN_PROFILE ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }, [hydrated, isBootstrapping, accessToken]);

  // Side-effect only: bounce unauthenticated visitors to login.
  useEffect(() => {
    if (!isBootstrapping && !accessToken) window.location.replace("/");
  }, [isBootstrapping, accessToken]);

  if (access === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Checking access…" />
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <Doty pose="05" size="small" animation="sad" />
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Admins only
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          You don&apos;t have permission to view this area.
        </p>
        <Link
          href="/levels"
          className="btn-3d rounded-2xl px-6 py-3 text-sm font-extrabold text-white"
          style={{ background: "var(--accent)", boxShadow: "0 4px 0 var(--accent-edge)" }}
        >
          Back to learning
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin top bar */}
      <header className="sticky top-0 z-20 border-b border-(--border) bg-(--surface)/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Doty pose="07" size="micro" />
            <span className="font-display text-lg font-extrabold text-foreground">
              Dots Admin
            </span>
          </Link>

          {/* Section nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Admin sections">
            {NAV_ITEMS.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ${
                    active
                      ? "bg-(--accent) text-white"
                      : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/levels"
            className="text-sm font-bold text-(--muted) transition-colors hover:text-(--accent)"
          >
            ← Exit admin
          </Link>
        </div>

        {/* Mobile section nav */}
        <nav
          className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden"
          aria-label="Admin sections"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-bold transition-colors ${
                  active
                    ? "bg-(--accent) text-white"
                    : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
