"use client";

// ChartBrush carries `initialSelection` / `onSelectionChange` for the native brushX (cartesian/definition.ts).
// BrushLayout owns the zoom state: a main chart plus an optional brush strip.
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, NamedExoticComponent, ReactElement, ReactNode, SVGProps } from "react";
import { createPortal } from "react-dom";
import { brushX } from "@tanstack/charts/interaction/brush";
import { cn } from "./cn";
import { defineCarrier } from "./role";
import { isNumber } from "./guards";
import { registerBrushX } from "./cartesian/brush-factory";
import { useChartStable } from "./cartesian/chart-context";
import { renderPatternPreset } from "./pattern/pattern-preset-render";
import type { PatternPresetOptions } from "./pattern/pattern-preset-helpers";
import { useSanitizedId } from "./use-sanitized-id";

export interface ChartBrushSelection {
  start: Date;
  end: Date;
}

export type ChartBrushPatternPreset = "none" | "diagonal" | "horizontal" | "vertical" | "cross" | "dots" | "circles" | "accent";

export interface ChartBrushSelectionPattern extends PatternPresetOptions {
  preset: ChartBrushPatternPreset;
  color: string;
  opacity?: number;
}

export interface ChartBrushTrackOverlayStyle {
  blurPx?: number;
  fadeOuterEdges?: boolean;
}

export interface ChartBrushProps extends ChartBrushTrackOverlayStyle {
  /** Accepted for bklit parity. TanStack 1.1.0 has only `brushX`, so only `"horizontal"` is drawn. */
  readonly brushDirection?: "horizontal" | "vertical" | "both";
  /** Accepted for bklit parity; bklit's own `ChartBrush` ignores it too (the strip is driven by `initialSelection`). */
  readonly selection?: ChartBrushSelection | null;
  /** visx-only option (window-level drag events); the native brush already tracks the pointer outside the strip. */
  readonly useWindowMoveEvents?: boolean;
  readonly onSelectionChange?: (selection: { readonly start: Readonly<Date>; readonly end: Readonly<Date> } | null) => void;
  readonly initialSelection?: ChartBrushSelection | null;
  readonly selectionPattern?: ChartBrushSelectionPattern;
  readonly selectedBoxStyle?: SVGProps<SVGRectElement>;
}

// Importing ChartBrush is what loads d3-brush; the cartesian definition reads the factory from the registry.
registerBrushX(brushX);

export const ChartBrush = /* @__PURE__ */ defineCarrier<Readonly<ChartBrushProps>>("brush", "ChartBrush");

export interface ChartBrushTrackOverlayProps extends ChartBrushTrackOverlayStyle {
  innerWidth: number;
  innerHeight: number;
  /** Pixel x of the selection start within the plot area. */
  selectionX0: number;
  /** Pixel x of the selection end within the plot area. */
  selectionX1: number;
}

export interface ChartBrushSelectionOverlayProps {
  innerWidth: number;
  innerHeight: number;
  selectionX0: number;
  selectionX1: number;
  pattern?: ChartBrushSelectionPattern;
}

// bklit chart-brush-track-overlay.tsx: outer panes fade over the first 15%.
const TRACK_OUTER_FADE = "15%";
const OVERLAY_LAYER: CSSProperties = { position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" };

const outsidePaneStyle = (edge: "left" | "right", blurPx: number, fadeOuterEdges: boolean): CSSProperties => {
  const fadeTo = edge === "left" ? "right" : "left";
  const mask = fadeOuterEdges ? `linear-gradient(to ${fadeTo}, transparent 0%, black ${TRACK_OUTER_FADE}, black 100%)` : undefined;
  const blur = blurPx > 0 ? `blur(${blurPx}px)` : undefined;
  return { position: "absolute", pointerEvents: "none", backdropFilter: blur, WebkitBackdropFilter: blur, maskImage: mask, WebkitMaskImage: mask };
};

const useMounted = (): boolean => {
  const [mounted, setMounted] = useState(false);
  // The post-commit re-render is the point: it is what makes `containerRef.current` readable.
  // oxlint-disable-next-line react/set-state-in-effect, react-doctor/rendering-hydration-no-flicker, react-doctor/no-initialize-state -- see above
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
};

/** Blurs the track outside `[selectionX0, selectionX1]` (plot pixels). Render it as a chart child. */
export const ChartBrushTrackOverlay = ({ innerWidth, innerHeight, selectionX0, selectionX1, blurPx = 1.5, fadeOuterEdges = true }: Readonly<ChartBrushTrackOverlayProps>): ReactElement | null => {
  const { containerRef, margin } = useChartStable();
  const mounted = useMounted();
  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  const x0 = Math.max(0, Math.min(selectionX0, selectionX1, innerWidth));
  const x1 = Math.max(x0, Math.min(Math.max(selectionX0, selectionX1), innerWidth));
  const rightWidth = Math.max(0, innerWidth - x1);
  if (x0 <= 0 && rightWidth <= 0) {
    return null;
  }
  const blur = Math.min(5, Math.max(0, blurPx));
  const leftStyle: CSSProperties = { ...outsidePaneStyle("left", blur, fadeOuterEdges), top: margin.top, left: margin.left, width: x0, height: innerHeight };
  const rightStyle: CSSProperties = { ...outsidePaneStyle("right", blur, fadeOuterEdges), top: margin.top, left: margin.left + x1, width: rightWidth, height: innerHeight };
  return createPortal(
    <div aria-hidden="true" style={OVERLAY_LAYER}>
      {x0 > 0 ? <div style={leftStyle} /> : null}
      {rightWidth > 0 ? <div style={rightStyle} /> : null}
    </div>,
    container,
  );
};

/** Pattern fill between `[selectionX0, selectionX1]` (plot pixels). Render it as a chart child. */
export const ChartBrushSelectionOverlay = ({ innerWidth, innerHeight, selectionX0, selectionX1, pattern }: Readonly<ChartBrushSelectionOverlayProps>): ReactElement | null => {
  const { containerRef, margin } = useChartStable();
  const mounted = useMounted();
  const patternId = useSanitizedId();
  const container = containerRef.current;
  if (!(mounted && container && pattern && pattern.preset !== "none")) {
    return null;
  }
  const x0 = Math.max(0, Math.min(selectionX0, selectionX1, innerWidth));
  const x1 = Math.max(x0, Math.min(Math.max(selectionX0, selectionX1), innerWidth));
  const patternNode = renderPatternPreset(pattern.preset, patternId, pattern);
  if (x1 - x0 <= 0 || patternNode === undefined || patternNode === null) {
    return null;
  }
  return createPortal(
    <svg aria-hidden="true" height="100%" style={OVERLAY_LAYER} width="100%">
      <defs>{patternNode}</defs>
      <rect fill={`url(#${patternId})`} fillOpacity={pattern.opacity ?? 1} height={innerHeight} width={x1 - x0} x={margin.left + x0} y={margin.top} />
    </svg>,
    container,
  );
};

export interface ChartBrushLayoutState {
  xDomain: [Date, Date] | undefined;
  xDomainSlotCount: number | undefined;
  brushSelection: ChartBrushSelection | null;
  onBrushSelectionChange: (selection: ChartBrushSelection | null) => void;
}

export interface ChartBrushLayoutProps {
  data: Record<string, unknown>[];
  xDataKey?: string;
  xExtentMax?: Date;
  enabled: boolean;
  height: number;
  fitMainContent?: boolean;
  className?: string;
  children: (layout: ChartBrushLayoutState) => ReactNode;
  brushStrip?: (layout: ChartBrushLayoutState) => ReactNode;
}

// Kept apart from kit toDate: other inputs (null, objects) go through String(), so they parse to NaN instead of epoch 0.
const toTime = (value: unknown): number => {
  if (value instanceof Date) {return value.getTime();}
  if (isNumber(value)) {return value;}
  return new Date(String(value)).getTime();
};

// Full data extent, optionally stretched to `xExtentMax`.
const resolveExtent = (data: readonly Record<string, unknown>[], xDataKey: string, xExtentMax?: Date): [Date, Date] | null => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const row of data) {
    const time = toTime(row[xDataKey]);
    if (Number.isFinite(time)) {
      min = Math.min(min, time);
      max = Math.max(max, time);
    }
  }
  if (min === Number.POSITIVE_INFINITY) {return null;}
  const end = xExtentMax && xExtentMax.getTime() > max ? xExtentMax.getTime() : max;
  return [new Date(min), new Date(end)];
};

// Dataset swap resets the selection back to the full extent; null (zero-width drag) does too.
const useBrushSelection = (
  data: readonly Record<string, unknown>[],
  xDataKey: string,
  xExtentMax: Date | undefined,
  enabled: boolean,
): ChartBrushLayoutState => {
  const fullExtent = useMemo(() => resolveExtent(data, xDataKey, xExtentMax), [data, xDataKey, xExtentMax]);
  const [selection, setSelection] = useState<ChartBrushSelection | null>(null);
  const [prevExtent, setPrevExtent] = useState<[Date, Date] | null>(null);
  if (fullExtent !== prevExtent) {
    setPrevExtent(fullExtent);
    setSelection(fullExtent ? { end: fullExtent[1], start: fullExtent[0] } : null);
  }
  const onBrushSelectionChange = useCallback(
    (next: ChartBrushSelection | null): void => {
      const target = next ?? (fullExtent ? { end: fullExtent[1], start: fullExtent[0] } : null);
      if (target) {
        setSelection(target);
      }
    },
    [fullExtent],
  );
  return useMemo(
    () => ({
      brushSelection: selection,
      onBrushSelectionChange,
      xDomain: enabled && selection ? [selection.start, selection.end] : undefined,
      xDomainSlotCount: enabled ? data.length : undefined,
    }),
    [selection, onBrushSelectionChange, enabled, data.length],
  );
};

const BrushLayoutContent = ({
  data,
  xDataKey = "date",
  xExtentMax,
  enabled,
  height,
  fitMainContent = false,
  className,
  children,
  brushStrip,
}: Readonly<ChartBrushLayoutProps>): ReactElement => {
  const layout = useBrushSelection(data, xDataKey, xExtentMax, enabled);
  const stripStyle = useMemo(() => ({ height }), [height]);
  return (
    <div className={cn("flex size-full min-h-0 min-w-0 flex-col", fitMainContent ? "justify-start gap-1" : "gap-3", className)}>
      <div className={fitMainContent ? "min-h-0 min-w-0 shrink-0" : "min-h-0 min-w-0 flex-1"}>{children(layout)}</div>
      {enabled && brushStrip && (
        <div className="min-h-0 shrink-0" style={stripStyle}>
          {brushStrip(layout)}
        </div>
      )}
    </div>
  );
};

export const BrushLayout: NamedExoticComponent<ChartBrushLayoutProps> = memo(BrushLayoutContent);
BrushLayout.displayName = "BrushLayout";
