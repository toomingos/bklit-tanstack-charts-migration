// SunburstHint — config carrier + accessibility trail hint.
// Extracted from sunburst-chart.tsx (R6 module split).

import { type ReactNode } from "react";
import type { ArcDatum, Focus } from "./sunburst-types";

// ---------------------------------------------------------------------------
// Config carrier — returns null, classified by displayName in sunburst-chart
// ---------------------------------------------------------------------------

/** P5.5 SB4 — bklit `sunburst-hint.tsx:7-11`. The argument a render-prop
    `children` receives. */
export interface SunburstHintContext {
  hintText: string;
  hoveredArc: ArcDatum | null;
  focus: Focus;
}

/** P5.5 SB4 — bklit `sunburst-hint.tsx:13-16`. `children` may be a plain node
    (rendered instead of the default text) or a function of the live hint
    context. Before SB4 this carrier typed `children?: ReactNode` only, so a
    caller passing a function had it silently dropped: the carrier returns
    null, and the chart's own render path only ever counted the element and
    drew its own `hintText`. */
export interface SunburstHintProps {
  className?: string;
  children?: ReactNode | ((context: SunburstHintContext) => ReactNode);
}

// bklit reads `focus`/`hoveredArc` off a sunburst context INSIDE this
// component. Migrated has no sunburst context and is not getting one (lead
// ruling D323, made for SB8 and applied here for the same reason): the state
// already lives in `SunburstChart`, so the carrier stays a pure config marker
// and the chart resolves `children` against its own live values. That keeps
// the public API — `<SunburstHint>{(ctx) => …}</SunburstHint>` — identical
// while the data flows down rather than sideways through a provider.
export function SunburstHint(_props: SunburstHintProps): null {
  return null;
}

SunburstHint.displayName = "SunburstHint";

/** Resolves the carrier's `children` against the live context, mirroring
    bklit `sunburst-hint.tsx:37-44`: a function is called, `null`/`undefined`
    falls back to the computed hint text, anything else renders as-is. */
export function resolveSunburstHintContent(
  children: SunburstHintProps["children"],
  context: SunburstHintContext,
): ReactNode {
  if (typeof children === "function") return children(context);
  if (children == null) return context.hintText;
  return children;
}

// ---------------------------------------------------------------------------
// Hint display — centered text below the chart area
// ---------------------------------------------------------------------------

export interface SunburstHintDisplayProps {
  children: ReactNode;
  /** bklit `sunburst-hint.tsx:49-51` lets the caller replace the whole class
      string; the inline style below is migrated's tailwind-free equivalent of
      its default `mt-3 min-h-5 text-center text-muted-foreground text-sm`, so
      a caller-supplied className replaces those defaults the same way. */
  className?: string;
}

export function SunburstHintDisplay({ children, className }: SunburstHintDisplayProps) {
  return (
    <div
      aria-live="polite"
      className={className}
      style={
        className
          ? { minHeight: 20 }
          : {
              marginTop: 12,
              minHeight: 20,
              textAlign: "center",
              fontSize: "14px",
              color: "var(--chart-foreground-muted, #888)",
            }
      }
    >
      {children}
    </div>
  );
}
