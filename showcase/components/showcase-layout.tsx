"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { allCharts, chartCategories } from "@/lib/chart-data";
import { cn } from "@/lib/utils";

const sections = [
  {
    label: "Getting Started",
    items: [
      { label: "Installation", href: "/charts/installation" },
      { label: "Migrating from Bklit UI", href: "/charts/migration" },
      { label: "Benchmarks", href: "/charts/benchmarks" },
    ],
  },
  ...chartCategories.map((cat) => ({
    label: cat.label,
    items: cat.order.map((route) => {
      const chart = allCharts.find((c) => c.route === route);
      return { label: chart?.name ?? route, href: `/charts/${route}` };
    }),
  })),
];

// Pattern of bklit's docs sidebar (apps/web/components/docs/sidebar.tsx:11-17,80-109).
const linkStyles = {
  base: "flex w-fit items-center gap-2 rounded-md px-3 py-1.5 font-medium text-xs no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring",
  active: "bg-muted text-card-foreground",
  inactive: "text-foreground dark:text-accent-foreground",
  heading:
    "mt-4 flex h-8 shrink-0 items-center rounded-md px-2 pt-3 font-medium text-muted-foreground text-xs first:mt-0 first:pt-0",
};

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Charts">
      <ul className="m-0 list-none space-y-0.5 p-0">
        {sections.flatMap((section) => [
          <li className={linkStyles.heading} key={section.label}>
            {section.label}
          </li>,
          ...section.items.map((item) => (
            <li key={item.href}>
              <Link
                aria-current={pathname === item.href ? "page" : undefined}
                className={cn(
                  linkStyles.base,
                  pathname === item.href
                    ? linkStyles.active
                    : linkStyles.inactive
                )}
                href={item.href}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            </li>
          )),
        ])}
      </ul>
    </nav>
  );
}

export function ShowcaseLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // bklit locks body scroll while its mobile sheet is open (docs/site-header.tsx:149-160).
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader menu={{ open: menuOpen, onToggle: () => setMenuOpen((o) => !o) }} />
      <div className="flex flex-1 pt-14">
        {/* Desktop sidebar */}
        <aside className="fixed top-14 bottom-0 hidden w-64 overflow-y-auto border-r border-border bg-background p-4 md:block">
          <SidebarNav />
        </aside>

        {/* Mobile sheet, as bklit's header menu (docs/site-header.tsx:177-196) */}
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden",
            menuOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          )}
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={cn(
            "fixed inset-x-0 top-14 bottom-0 z-40 overflow-y-auto overscroll-contain border-b border-border bg-background px-4 py-3 transition-[transform,opacity] duration-300 ease-out md:hidden",
            menuOpen
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-4 opacity-0"
          )}
          id="mobile-nav"
          inert={!menuOpen}
        >
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </div>

        {/* Main content */}
        <main className="min-w-0 flex-1 md:ml-64">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
