import type { ReactNode } from "react";
import type { ArcDatum, Focus } from "./arcs";
import { useSunburstHover, useSunburstStable } from "./context";

const HINT_STYLE = { minHeight: 20 } as const;

/** State passed to a custom `SunburstHint` content function. */
export interface SunburstHintContext {
  /** The default hint text for the current state. */
  hintText: string;
  /** The hovered arc, or `null`. */
  hoveredArc: ArcDatum | null;
  /** The currently focused node. */
  focus: Focus;
}

/** Props of `SunburstHint`. */
export interface SunburstHintProps {
  /** Class name of the hint element. */
  className?: string;
  /** Custom hint content, or a function receiving the hint context. Defaults to the hovered path or zoom instructions. */
  children?: ReactNode | ((context: SunburstHintContext) => ReactNode);
}

const hintTextFor = (hoveredArc: ArcDatum | null, focus: Focus): string => {
  if (hoveredArc) {
    return hoveredArc.trail.join("  ›  ");
  }
  return focus.depth === 0 ? "Click a segment to zoom in · hover to inspect" : "Click the center to zoom out";
};

/** Hint text below the chart: the hovered path, or instructions for zooming. Announced politely to screen readers. */
export const SunburstHint = ({ className, children }: Readonly<SunburstHintProps>): ReactNode => {
  const { focus } = useSunburstStable();
  const { hoveredArc } = useSunburstHover();
  const hintText = hintTextFor(hoveredArc, focus);
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the prop is bklit's public `ReactNode | function` union, discriminated at its only boundary
  const content: ReactNode = typeof children === "function" ? children({ focus, hintText, hoveredArc }) : (children ?? hintText);
  return (
    <div
      aria-live="polite"
      className={className ?? "bk-sb-hint"}
      style={HINT_STYLE}
    >
      {content}
    </div>
  );
};
SunburstHint.displayName = "SunburstHint";
