"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { allCharts } from "@/lib/chart-data";

const navigation = [
  { label: "Overview", href: "/charts/overview" },
  ...allCharts.map((c) => ({
    label: c.name,
    href: `/charts/${c.route}`,
  })),
];

export function ShowcaseLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex flex-1 pt-14">
        {/* Left sidebar */}
        <aside className="fixed top-14 bottom-0 w-64 border-r border-border bg-background overflow-y-auto hidden md:block">
          <nav className="flex flex-col gap-1 p-4">
            {navigation.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors no-underline",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="md:ml-64 flex-1">
          <div className="mx-auto max-w-6xl p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
