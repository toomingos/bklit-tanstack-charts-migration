"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BklitLogo } from "@/components/icons/bklit";
import { ModeToggle } from "@/components/mode-toggle";

export function SiteHeader() {
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
              Chart Showcase
            </Link>
            <span className="text-muted-foreground text-xs ml-1">/</span>
            <Link
              className="text-sm text-muted-foreground no-underline hover:text-foreground transition-colors"
              href="/charts/overview"
            >
              Overview
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
