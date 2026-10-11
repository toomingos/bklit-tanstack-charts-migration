import type { ReactNode } from "react";
import type { ArcDatum, Focus } from "./arcs";
import { useSunburstHover, useSunburstStable } from "./context";

const HINT_STYLE = { minHeight: 20 } as const;

export interface SunburstHintContext {
  hintText: string;
  hoveredArc: ArcDatum | null;
  focus: Focus;
}

export interface SunburstHintProps {
  className?: string;
  children?: ReactNode | ((context: SunburstHintContext) => ReactNode);
}

const hintTextFor = (hoveredArc: ArcDatum | null, focus: Focus): string => {
  if (hoveredArc) {
    return hoveredArc.trail.join("  ›  ");
  }
  return focus.depth === 0 ? "Click a segment to zoom in · hover to inspect" : "Click the center to zoom out";
};

export const SunburstHint = ({ className, children }: Readonly<SunburstHintProps>): ReactNode => {
  const { focus } = useSunburstStable();
  const { hoveredArc } = useSunburstHover();
  const hintText = hintTextFor(hoveredArc, focus);
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the prop is bklit's public `ReactNode | function` union, discriminated at its only boundary
  const content: ReactNode = typeof children === "function" ? children({ focus, hintText, hoveredArc }) : (children ?? hintText);
  return (
    <div
      aria-live="polite"
      className={className ?? "mt-3 min-h-5 text-center text-muted-foreground text-sm"}
      style={HINT_STYLE}
    >
      {content}
    </div>
  );
};
SunburstHint.displayName = "SunburstHint";
