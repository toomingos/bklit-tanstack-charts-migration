import "@showcase/migrated-charts/styles.css";
import "./globals.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  // Absolute base for the og:image / twitter:image URLs that link previews fetch.
  metadataBase: new URL("https://bklit-tanstack-charts-migration.vercel.app"),
  openGraph: { siteName: "Bklit TanStack Charts", type: "website" },
  twitter: { card: "summary_large_image" },
  title: {
    default: "Bklit TanStack Charts",
    template: "%s | Bklit TanStack Charts",
  },
  description: "Bklit UI's charts, now on TanStack Charts. 25 charts and utilities for React.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      className={cn(
        GeistSans.variable,
        GeistMono.variable,
        GeistSans.className
      )}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          async
          data-code="2026103016578723"
          id="omnimetrixjs"
          src="https://track.omnimetrix.io/2026103016578723/om.js"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
