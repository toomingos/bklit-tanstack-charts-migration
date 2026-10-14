"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BklitLogo } from "@/components/icons/bklit";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

const gettingStarted = ["/charts/installation", "/charts/migration"];

const navLinks = [
  { label: "Docs", href: "/charts/installation", match: (p: string) => gettingStarted.includes(p) },
  {
    label: "Charts",
    href: "/charts/area",
    match: (p: string) => p.startsWith("/charts/") && !gettingStarted.includes(p) && p !== "/charts/benchmarks",
  },
  { label: "Benchmarks", href: "/charts/benchmarks", match: (p: string) => p === "/charts/benchmarks" },
];

/** `menu` is passed by the pages with a sidebar; the home page has none, so no menu button. */
export function SiteHeader({
  menu,
}: {
  menu?: { open: boolean; onToggle: () => void };
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <header className="fixed top-0 right-0 left-0 z-50 h-14 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="mx-auto flex h-full items-center justify-between gap-6 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            className="flex shrink-0 items-center no-underline transition-opacity hover:opacity-80"
            href="/"
          >
            <BklitLogo size={24} theme={logoTheme} />
          </Link>
          <div className="min-w-0">
            <Link
              className="font-semibold text-foreground text-sm tracking-tight no-underline transition-opacity hover:opacity-80"
              href="/"
            >
              Bklit TanStack Charts
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <nav aria-label="Site" className={cn("items-center gap-1", menu ? "hidden md:flex" : "flex")}>
            {navLinks.map((link) => (
              <Link
                aria-current={link.match(pathname) ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 font-medium text-sm no-underline transition-colors hover:text-foreground",
                  link.match(pathname) ? "text-foreground" : "text-muted-foreground"
                )}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {menu && (
            <button
              aria-controls="mobile-nav"
              aria-expanded={menu.open}
              aria-label={menu.open ? "Close menu" : "Open menu"}
              className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted md:hidden"
              onClick={menu.onToggle}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path d={menu.open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
              </svg>
            </button>
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
