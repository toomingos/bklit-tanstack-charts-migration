"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BklitLogo } from "@/components/icons/bklit";
import { ModeToggle } from "@/components/mode-toggle";

export function SiteHeader({
  menuOpen,
  onMenuToggle,
}: {
  menuOpen: boolean;
  onMenuToggle: () => void;
}) {
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
              TanStack Bklit UI
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            aria-controls="mobile-nav"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted md:hidden"
            onClick={onMenuToggle}
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
              <path d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
