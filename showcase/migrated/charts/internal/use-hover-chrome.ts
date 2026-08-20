// Shared hover-chrome wiring for line-chart.tsx and area-chart.tsx: both
// attach the same `attachHoverChrome` overlay to a `<Chart>`, differing only
// in dimOpacity (area: AREA_DIM_OPACITY) and Line's profit/loss sign-flip
// side effect on focus change (`onFocusPoints`). `chromeStateRef.current`
// itself stays caller-owned — the `series`/`xForIndex`/reanchor fields differ
// per chart — this hook only owns the refs, the pill-label memo, the
// attach/reanchor/syncDim effects, and the xDomain-aware focus handler.
import * as React from "react";
import type { ChartPoint } from "@tanstack/charts";
import {
  attachHoverChrome,
  type HoverChrome,
  type HoverChromeState,
} from "./hover-chrome";
import { useChartConfig } from "./chart-config-context";
import { isChartInteractionPhase, type ChartPhase } from "./chart-phase";
import type { ChartDatum } from "./types";

export type HoverChromeFocusPoint = ChartPoint<ChartDatum, Date, number>;

export interface UseHoverChromeOptions {
  renderData: ChartDatum[];
  xDataKey: string;
  chartPhase: ChartPhase;
  isLoaded: boolean;
  xDomain: [Date, Date] | undefined;
  legendHoveredIndex: number | null;
  tooltipEnabled: boolean;
  width: number;
  dimOpacity?: string;
  // Line-only profit/loss sign-flip (see line-chart.tsx's plTooltipSignIndex)
  // — invoked with the raw (pre phase-filter) points on every focus change,
  // including the xDomain-miss/drag-suppressed branches (as `[]`). Area
  // passes nothing, matching its original no-op.
  onFocusPoints?: (points: readonly HoverChromeFocusPoint[]) => void;
}

export interface UseHoverChromeResult {
  chromeRef: React.RefObject<HoverChrome | null>;
  dragSelectionActiveRef: React.RefObject<boolean>;
  chromeStateRef: React.RefObject<HoverChromeState | null>;
  overlayHostRef: React.RefObject<HTMLDivElement | null>;
  dateLabelsForPill: string[];
  handleFocusGroupChange: (points: readonly HoverChromeFocusPoint[]) => void;
}

export function useHoverChrome(options: UseHoverChromeOptions): UseHoverChromeResult {
  const {
    renderData,
    xDataKey,
    chartPhase,
    isLoaded,
    xDomain,
    legendHoveredIndex,
    tooltipEnabled,
    width,
    dimOpacity,
    onFocusPoints,
  } = options;
  const chartConfig = useChartConfig();
  const chromeRef = React.useRef<HoverChrome | null>(null);
  // bklit parity (use-chart-interaction.ts): drag selection suppresses the
  // hover chrome — cleared on mousedown, never rescheduled while dragging.
  const dragSelectionActiveRef = React.useRef(false);
  const chromeStateRef = React.useRef<HoverChromeState | null>(null);
  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);

  const dateLabelsForPill = React.useMemo(() => renderData.map((d) => {
    const v = d[xDataKey];
    if (v instanceof Date) return (v as Date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return String(v ?? "");
  }), [renderData, xDataKey]);

  React.useEffect(() => {
    chromeRef.current?.reanchor();
  }, [renderData, xDataKey, chartPhase, isLoaded, xDomain]);

  React.useEffect(() => {
    chromeRef.current?.syncDim();
  }, [legendHoveredIndex]);

  const hasDefinition = width > 0;

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachHoverChrome(el, () => chromeStateRef.current!, {
      dimOpacity,
      tooltipSpring: chartConfig.tooltipSpring,
      tooltipBoxSpring: chartConfig.tooltipBoxSpring,
      highlightSpring: chartConfig.highlightSpring,
    });
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig, dimOpacity]);

  // bklit shell comment — interaction bisects only visiblePlotData; with domain-clamp the
  // focus stack is over full data, so an edge pointer can resolve an off-viewport point.
  // When xDomain is set and the resolved datum lies outside the inclusive domain, clear.
  const focusOutsideXDomain = React.useCallback(
    (datum: unknown): boolean => {
      if (!xDomain) return false;
      const v = (datum as Record<string, unknown>)?.[xDataKey];
      const d = v instanceof Date ? v : v != null ? new Date(v as string | number) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      const t = d.getTime();
      const a = xDomain[0].getTime();
      const b = xDomain[1].getTime();
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return t < lo || t > hi;
    },
    [xDomain, xDataKey],
  );

  const handleFocusGroupChange = React.useCallback(
    (points: readonly HoverChromeFocusPoint[]) => {
      if (xDomain && points.length > 0 && focusOutsideXDomain(points[0]!.datum)) {
        onFocusPoints?.([]);
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      if (dragSelectionActiveRef.current) {
        onFocusPoints?.([]);
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      onFocusPoints?.(points);
      chromeRef.current?.onFocusGroupChange(
        isChartInteractionPhase(chartPhase) && isLoaded ? points : [],
      );
    },
    [chartPhase, isLoaded, xDomain, focusOutsideXDomain, onFocusPoints],
  );

  return {
    chromeRef,
    dragSelectionActiveRef,
    chromeStateRef,
    overlayHostRef,
    dateLabelsForPill,
    handleFocusGroupChange,
  };
}
