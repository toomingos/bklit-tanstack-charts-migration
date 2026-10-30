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
          <a
            aria-label="GitHub repository"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            href="https://github.com/toomingos/bklit-tanstack-charts-migration"
            rel="noopener noreferrer"
            target="_blank"
          >
            <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
