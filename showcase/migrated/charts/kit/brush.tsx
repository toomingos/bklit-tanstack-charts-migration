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

/** A brushed time range. */
export interface ChartBrushSelection {
  /** Start of the range. */
  start: Date;
  /** End of the range. */
  end: Date;
}

/**
 * Pattern drawn inside the brushed window: `"none"`, `"diagonal"`, `"horizontal"`, `"vertical"`, `"cross"`, `"dots"`, `"circles"` or `"accent"`.
 */
export type ChartBrushPatternPreset = "none" | "diagonal" | "horizontal" | "vertical" | "cross" | "dots" | "circles" | "accent";

/** Pattern drawn inside the brushed window. Inherits the pattern options of `PatternPresetOptions`. */
export interface ChartBrushSelectionPattern extends PatternPresetOptions {
  /** Which pattern to draw. `"none"` draws nothing. */
  preset: ChartBrushPatternPreset;
  /** Color of the pattern lines or dots. */
  color: string;
  /**
   * Opacity of the pattern.
   * @default 1
   */
  opacity?: number;
}

/** Look of the dimmed area outside the brushed window. */
export interface ChartBrushTrackOverlayStyle {
  /**
   * Blur applied to the dimmed area outside the window, in px (clamped to 0-5).
   * @default 1.5
   */
  blurPx?: number;
  /**
   * Fade the dimmed area out toward the outer edges of the strip.
   * @default true
   */
  fadeOuterEdges?: boolean;
}

/** Props of `ChartBrush`. */
export interface ChartBrushProps extends ChartBrushTrackOverlayStyle {
  /**
   * Accepted so bklit-ui code compiles. The brush is always horizontal: the native brush is `brushX` only, and the selection is a time range
   * (bklit reports only the x extent too, chart-brush.tsx:270-288).
   */
  readonly brushDirection?: "horizontal" | "vertical" | "both";
  /** Accepted so bklit-ui code compiles. Has no effect (bklit ignores it as well, chart-brush.tsx:262). Use `initialSelection` to set the window. */
  readonly selection?: ChartBrushSelection | null;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly useWindowMoveEvents?: boolean;
  /**
   * Called while the window is dragged or resized, with the selected range, or `null` when the selection collapses to nothing (which resets to the full range). Escape cancels a drag and reports the previous range. The range is slightly widened (about 2 px per side) so a full drag covers the end points.
   */
  readonly onSelectionChange?: (selection: { readonly start: Readonly<Date>; readonly end: Readonly<Date> } | null) => void;
  /**
   * Window shown on mount, for example the first half of the range. Changing it later does not move the window; it resets when the chart's data changes.
   */
  readonly initialSelection?: ChartBrushSelection | null;
  /** Styles the brushed window. Only `color` is applied by `ChartBrush`; use `ChartBrushSelectionOverlay` to draw a full pattern. */
  readonly selectionPattern?: ChartBrushSelectionPattern;
  /** Accepted so bklit-ui code compiles. Has no effect. */
  readonly selectedBoxStyle?: SVGProps<SVGRectElement>;
}

// Importing ChartBrush is what loads d3-brush; the cartesian definition reads the factory from the registry.
registerBrushX(brushX);

/**
 * A range selector. Put it inside a second, small chart (the brush strip) next to a main chart; dragging or resizing the window reports the selected time range through `onSelectionChange`. Combine it with `ChartBrushLayout` to zoom the main chart.
 */
export const ChartBrush = /* @__PURE__ */ defineCarrier<Readonly<ChartBrushProps>>("brush", "ChartBrush");

/** Props of `ChartBrushTrackOverlay`. */
export interface ChartBrushTrackOverlayProps extends ChartBrushTrackOverlayStyle {
  /** Plot width in px. */
  innerWidth: number;
  /** Plot height in px. */
  innerHeight: number;
  /** Pixel x of the selection start within the plot area. */
  selectionX0: number;
  /** Pixel x of the selection end within the plot area. */
  selectionX1: number;
}

/** Props of `ChartBrushSelectionOverlay`. */
export interface ChartBrushSelectionOverlayProps {
  /** Plot width in px. */
  innerWidth: number;
  /** Plot height in px. */
  innerHeight: number;
  /** Pixel x of the selection start within the plot area. */
  selectionX0: number;
  /** Pixel x of the selection end within the plot area. */
  selectionX1: number;
  /** Pattern to draw inside the window. Nothing is drawn when omitted or `"none"`. */
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

/**
 * Dims the parts of a chart outside the brushed window, with an optional blur and faded outer edges. `ChartBrush` draws it for you; use it directly to build your own brush.
 */
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

/** Fills the brushed window with a pattern. `ChartBrush` draws it for you when `selectionPattern` is set. */
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

/** What `ChartBrushLayout` passes to its `children` and `brushStrip` render functions. */
export interface ChartBrushLayoutState {
  /** Visible x range for the main chart. `undefined` shows everything (when `enabled` is false). */
  xDomain: [Date, Date] | undefined;
  /**
   * Number of rows in the full data, for bar and candlestick charts that size columns against it. `undefined` when `enabled` is false.
   */
  xDomainSlotCount: number | undefined;
  /** The current brushed range. It starts as the full data extent. */
  brushSelection: ChartBrushSelection | null;
  /** Pass this to the brush's `onSelectionChange`. Clearing the selection (`null`) resets to the full extent. */
  onBrushSelectionChange: (selection: ChartBrushSelection | null) => void;
}

/** Props of `ChartBrushLayout`. */
export interface ChartBrushLayoutProps {
  /** The full dataset. The brushed range starts as its extent and resets when this changes. */
  data: Record<string, unknown>[];
  /**
   * Key of the date field in each row.
   * @default "date"
   */
  xDataKey?: string;
  /** Extends the brushable range past the last data point to this date. */
  xExtentMax?: Date;
  /** Turn the brush on. When false, the main chart shows all data and the strip is not rendered. */
  enabled: boolean;
  /** Height of the brush strip in px. */
  height: number;
  /**
   * Pack the main chart and strip tightly at the top instead of stretching the main chart to fill the height.
   * @default false
   */
  fitMainContent?: boolean;
  /** Class names added to the layout container. */
  className?: string;
  /** Render function for the main chart. Receives the layout state. */
  children: (layout: ChartBrushLayoutState) => ReactNode;
  /** Render function for the brush strip, shown below the main chart when `enabled`. Receives the layout state. */
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
    <div className={cn("bk-brush", fitMainContent && "bk-brush-fit", className)}>
      <div className={fitMainContent ? "bk-brush-main bk-brush-main-fit" : "bk-brush-main"}>{children(layout)}</div>
      {enabled && brushStrip && (
        <div className="bk-brush-strip" style={stripStyle}>
          {brushStrip(layout)}
        </div>
      )}
    </div>
  );
};

/**
 * Lays out a main chart above a brush strip and holds the brushed range. Render the main chart in `children` with `layout.xDomain` and `layout.xDomainSlotCount`, and the brush strip in `brushStrip`.
 */
export const BrushLayout: NamedExoticComponent<ChartBrushLayoutProps> = memo(BrushLayoutContent);
BrushLayout.displayName = "BrushLayout";
