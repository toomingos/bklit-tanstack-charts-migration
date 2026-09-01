// Migrated bklit-ui LineChart — same public API, rendered by TanStack Charts.
// Architecture per docs/LOG.md D10: children are config carriers compiled into
// one `defineChart` spec; React commits the SVG once (TanStack adapter);
// data changes go through adapter.update(); the mount reveal is a WAAPI
// clip-path animation on the marks group (zero per-frame JS/React).
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleTime } from "d3-scale";
import { curveNatural } from "d3-shape";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { d3Curve, defineChart, lineY } from "@tanstack/charts";
import { tooltip as nativeTooltip } from "@tanstack/charts/tooltip";
import type {
  ChartControl,
  ChartInteractionController,
  ChartMark,
  ChartMotionContext,
  ChartPoint,
  ChartPositionScaleOptions,
  ChartRenderContext,
  ChartRendererRenderContext,
  ChartScale,
  ChartScene,
  SceneStyle,
} from "@tanstack/charts";
import { chartMotionRenderer } from "./internal/motion-renderer";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { extractChildren } from "./children";
import {
  buildCrosshairGradientDef,
  buildHighlightBandMarks,
  buildHoverDotMark,
  buildIndicatorMark,
  isFocusOutsideXDomain,
  pointerHoverDimState,
  resolveHoverDotFill,
  useDatePillOverlay,
} from "./internal/hover-geometry";
import { useFocusInjection, whenSeriesDimmed } from "./internal/focus-injection";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import {
  extractReferenceAreaProps,
} from "./internal/reference-area-config";
import {
  ChartSelectionContext,
  extractSegmentComponents,
  useChartSelection,
} from "./internal/chart-selection";
import { SegmentOverlay } from "./internal/segment-visuals";
import {
  extractProjectionLineConfigs,
  mergeProjectionXDomainMax,
  mergeProjectionYDomain,
} from "./internal/projection-config";
import { projectionLineMark, resolveProjectionGradientDef } from "./internal/projection-line-mark";
import { ProjectionMarkerOverlay, type ProjectionPhaseHandle } from "./internal/terminal-marker";
import {
  extractProfitLossHoveredIndex,
  normalizeProfitLossConfig,
} from "./internal/profit-loss-config";
import {
  profitLossLineMarks,
  resolveProfitLossGradientDefs,
} from "./internal/profit-loss-line-mark";
import { toDate } from "./internal/coerce-date";
import { timeToPixelX } from "./internal/x-time-scale";
import {
  BOX_OFFSET,
  DISCRETE_INTERACTION_THRESHOLD,
  FADE_BUFFER,
  SERIES_MARKER_ENTER_MS,
  TICKER_HALF_WIDTH,
  TOOLTIP_BOX_SPRING,
} from "./internal/design-tokens";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { TooltipContent } from "./internal/tooltip-components";
import {
  buildXAxisTickValues,
  buildYAxisTickValues,
  formatYAxisTick,
  tickLabelFadeOpacity,
} from "./internal/axis-ticks";
import type { ChartDatum, ChartStatus, TooltipRow } from "./internal/types";
import { type ChartPhase, DEFAULT_Y_DOMAIN_TWEEN_MS, isChartInteractionPhase } from "./internal/chart-phase";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import { resolveFadeEdgesMask } from "./internal/fade-mask";
import { resolveGridGuide } from "./internal/grid";
import { gridHighlightRowMarks } from "./internal/grid-highlight-mark";
import { LoadingLabel, LineLoadingPulse, buildLoadingSkeletonRows, resolveLineLoadingPulseMode } from "./internal/loading-chrome";
import { scaleLinear as d3ScaleLinear } from "d3-scale";
import {
  createAxisValueProjector,
  createNicedYScale,
  domainForAxis,
  resolveTimeSeriesYDomain,
  resolveYDomainsByAxis,
  useNicedYDomainChanged,
} from "./internal/y-domain";
import { DEFAULT_Y_AXIS_ID } from "./internal/y-axis-id";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { useChartConfig } from "./internal/chart-config-context";
import { useChartMargin, DEFAULT_CHART_MARGIN, useDebouncedContainerSize, type ChartMargin } from "./internal";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { useChartPhaseOrchestrator } from "./internal/use-chart-phase-orchestrator";
import { filterDataByXDomain, createXAccessor } from "./internal/brush-selection";
import { BrushChrome, selectionToPixelExtent, type BrushHost } from "./internal/brush-chrome";
import { brushX, type BrushRange, type BrushXChange } from "@tanstack/charts/interaction/brush";
import { controlledSignal } from "@tanstack/charts/interaction/signal";
import { DashTailOverlay, resolveDashTailBounds } from "./internal/dash-tail";
import { buildMarkerGradientDefs, buildMarkerMarks } from "./internal/series-marker-mark";
import { ChartMarkersOverlay } from "./internal/chart-markers";
import { createActiveMarkersStore, MarkerActiveTooltipProvider } from "./internal/marker-tooltip";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import { runRevealWipe, snapRevealWipe } from "./internal/reveal-wipe";
import { clipRevealTiming, type EnterTransition } from "./internal/enter-transition";
import "./styles.css";

// C6: native brushX's own selection/handle painting is hidden — the 4-piece
// BrushChrome portal (internal/brush-chrome.tsx) reproduces bklit's exact
// visuals (blur/fade track mask + pattern fill CSS can't reach, plus a
// border + pill handles for selectedBoxStyle's full SVGProps<SVGRectElement>
// surface, wider than SceneStyle). Native brushX still owns 100% of the
// mechanics — drag, keyboard stepping, touch, and focus — underneath these
// invisible rects/handles.
const BRUSH_NATIVE_HIDDEN_STYLE: SceneStyle = {
  fill: "transparent",
  fillOpacity: 0,
  stroke: "transparent",
  strokeOpacity: 0,
};
const EMPTY_BRUSH_CONTROLS: readonly ChartControl<Date, number>[] = [];

export interface LineChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  status?: ChartStatus;
  animationDuration?: number;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  children?: React.ReactNode;
  loadingLabel?: string;
  style?: React.CSSProperties;
  animationEasing?: string;
  yDomainTween?: boolean;
  yDomainTweenDuration?: number;
  // bklit time-series-chart-shell.tsx:162-167 — brush-driven viewport
  xDomain?: [Date, Date];
  /**
   * P5.7 L11 — ACCEPTED as inert, with the mechanism corrected. The ruling was
   * "FIX-trivial (pass to brush layout) or ACCEPT" on the premise that
   * `internal/brush-layout.tsx:52` has an `xDomainSlotCount` waiting to be fed.
   * It does not: that line is the PRODUCER. `useBrushSelection` computes
   * `xDomainSlotCount: enabled ? data.length : undefined`
   * (`internal/brush-selection.ts:158`), `BrushLayout` forwards it DOWN through
   * `children(layoutState)` — so the value flows brush -> chart, and there is no
   * parameter here to thread it into. Threading it "in" would have reversed the
   * data flow.
   *
   * Its one real consumer in bklit is `columnWidth`
   * (`time-series-chart-shell.tsx:317-326`: `innerWidth / (slotCount - 1)`,
   * where `slotCount` prefers this prop over `visiblePlotData.length` while
   * brushing), which the shell publishes on chart context for the tooltip
   * indicator's `span * columnWidth` sizing and for composed's bar widths.
   * Migrated's line/area path computes NO `columnWidth` anywhere — the whole
   * symbol is absent from both files and from the hover-chrome module — because
   * the tooltip indicator is TanStack-driven here. So wiring this prop would
   * mean inventing a `columnWidth` that nothing reads: dead code, not parity.
   * Kept in the type so the public API still accepts what bklit accepts.
   */
  xDomainSlotCount?: number;
  tweenYDomainOnXDomainChange?: boolean;
  /** P5.5 L1 — bklit `line-chart.tsx:40`. Overrides the clip-reveal timing:
      bklit's shell substitutes `{tween, duration: animationDuration/1000}` when
      this is absent (`time-series-chart-shell.tsx:607-612`) and then forces a
      tween through `clipRevealTransition` (`animation.ts:18`), because a spring
      does not reliably animate SVG width. Same coercion here. */
  enterTransition?: EnterTransition;
  /** P5.5 L2 — bklit `line-chart.tsx:41`. Replay epoch input: changing it
      replays the mount reveal without a data change. Forwarded straight to the
      orchestrator, which already keys its reveal effect on this field. */
  revealSignature?: string;
  ariaLabel?: string;
  ariaDescription?: string;
}

export function LineChart({
  data,
  xDataKey = "date",
  status = "ready",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  children,
  loadingLabel,
  style,
  animationEasing = DEFAULT_ANIMATION_EASING,
  yDomainTween = true,
  yDomainTweenDuration: _yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain,
  xDomainSlotCount: _xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  enterTransition,
  revealSignature = "",
  ariaLabel = "Line chart",
  ariaDescription,
}: LineChartProps) {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { width, height: measuredHeight } = useDebouncedContainerSize(containerRef);
  // bklit sizes the chart from the measured container box in BOTH modes —
  // CSS aspect-ratio default AND explicit height override (e.g. the
  // ChartBrushLayout 72px strip passes style={{aspectRatio:"unset",
  // height:"100%"}}). width/aspectRatio is only the pre-measure fallback.
  const heightPx = width > 0 ? (measuredHeight > 0.5 ? measuredHeight : width / parseAspectRatio(aspectRatio)) : 0;
  const xScaleD3Ref = React.useRef<ScaleTime<number, number> | null>(null);
  const onPhaseChangeRef = React.useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  const projectionPhasePortRef = React.useRef<ProjectionPhaseHandle | null>(null);

  // bklit shell:373-395 — tweenOnTargetChange: yDomainTween || (tweenYDomainOnXDomainChange && xDomain != null)
  const effectiveYDomainTweenDuration = React.useMemo(() => {
    const base = typeof yDomainTween === "boolean" ? (yDomainTween ? 500 : 0) : (yDomainTween as number);
    if (!tweenYDomainOnXDomainChange || xDomain == null) return base;
    return base || 500;
  }, [yDomainTween, tweenYDomainOnXDomainChange, xDomain]);
  const {
    chartPhase,
    isLoaded: orchIsLoaded,
    revealEpoch,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    chartStatus: status,
    targetData: data as unknown as Record<string, unknown>[],
    skeletonData: [],
    animationDuration,
    yDomainTweenDuration: effectiveYDomainTweenDuration,
    revealSignature,
  });

  // L1 — clip-reveal timing, bklit `animation.ts:18` semantics. Primitive deps:
  // callers pass `enterTransition` as an inline object literal.
  const enterType = enterTransition?.type;
  const enterDuration = enterTransition?.duration;
  const enterEaseKey = enterTransition?.ease?.join(",");
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = React.useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterType, enterDuration, enterEaseKey, animationDuration, animationEasing],
  );

  const phaseRef = React.useRef<ChartPhase>(chartPhase);
  phaseRef.current = chartPhase;
  const isLoaded = orchIsLoaded;

  React.useEffect(() => { onPhaseChangeRef.current?.(chartPhase); }, [chartPhase]);

  // Projection overlay phase port: the orchestrator owns the phase; the
  // overlay (terminal-marker.tsx) consumes it imperatively via the port.
  React.useEffect(() => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  }, [chartPhase]);

  React.useEffect(() => {
    if (chartPhase === "gridTweenReady" || chartPhase === "gridTweenLoading") {
      notifyYDomainTweenComplete();
    }
  }, [chartPhase, notifyYDomainTweenComplete]);

  const { lines, grid, xAxis, yAxis, background, tooltip, projectionLines, projectionEndMarkers, terminalMarkers, profitLossLines, chartMarkers, brushes } = React.useMemo(
    () => extractChildren(children),
    [children],
  );

  // Moved up from its old post-marks-memo location (bklit ChartTooltip):
  // C3's native crosshair/hover-dot marks (built inside the `marks` memo
  // below) are gated on this same flag hover-chrome.ts used to decide
  // whether to attach at all.
  const tooltipEnabled = tooltip?.enabled ?? false;
  const projectionConfigs = React.useMemo(() => extractProjectionLineConfigs(children), [children]);
  const projectionGradientBaseId = useSanitizedId();
  const profitLossHoveredIndex = extractProfitLossHoveredIndex(children);
  const hoveredIndexForPL = profitLossHoveredIndex;
  const [plTooltipSignIndex, setPlTooltipSignIndex] = React.useState<number | null>(null);
  // C3: replaces hover-chrome's imperative `highlightXSpring`/`highlightWidthSpring`
  // clip-rect sweep — the reactive index driving the native highlight-band
  // marks below (internal/hover-geometry.ts's buildHighlightBandMarks).
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  // C4: replaces date-pill.ts's imperative `applyFade`/`resetFade` span
  // styling — drives the native x `tickLabels.opacity` callback below.
  const [labelFade, setLabelFade] = React.useState<{ primaryX: number; hoveredLabel: string | null } | null>(null);
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const prefersReducedMotion = usePrefersReducedMotion();
  // C1 (P6): legend hover -> native mark states via programmatic focus
  // injection (replaces the old hover-chrome DOM-mutation dim path).
  const { captureRenderContext, focusSeries, clearFocus } = useFocusInjection();
  React.useEffect(() => {
    const seriesKey = legendHoveredIndex != null ? (lines[legendHoveredIndex]?.dataKey ?? null) : null;
    if (seriesKey != null) focusSeries(seriesKey);
    else clearFocus();
  }, [legendHoveredIndex, lines, focusSeries, clearFocus]);

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const renderData = React.useMemo(() => {
    if (innerWidth <= 0) return data;
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      lines.map((l) => l.dataKey),
    );
  }, [data, innerWidth, lines]);
  // bklit `pointCount > DISCRETE_INTERACTION_THRESHOLD` — dense data snaps
  // (jump) instead of springing for the crosshair/hover-dot/highlight-band/
  // pill motion, matching the existing native-tooltip motion gate above.
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;

  const markerGradientBaseId = useSanitizedId();
  // C3: app-owned <linearGradient> def id for the native crosshair mark's
  // vertical fade (bklit TooltipIndicator default fade) — same
  // useSanitizedId()/rendered-<defs> mechanism as the projection/marker
  // gradient defs above.
  const crosshairGradientId = useSanitizedId();
  const markerSeriesConfigs = React.useMemo(() => lines.map((l) => ({ dataKey: l.dataKey, stroke: l.stroke ?? "var(--chart-line-primary)", showMarkers: l.showMarkers, markers: l.markers })), [lines]);
  const markerGradientDefs = React.useMemo(() => buildMarkerGradientDefs(markerSeriesConfigs, markerGradientBaseId), [markerSeriesConfigs, markerGradientBaseId]);
  const markerGradientIdByKey = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const g of markerGradientDefs) m.set(g.dataKey, g.id);
    return m;
  }, [markerGradientDefs]);

  // bklit shell:265-277 visibleData; shell:341 yDomain on visible slice; shell:303-306 marks stay on full data (domain-clamp).
  const xAccessorForBrush = React.useMemo(() => createXAccessor(xDataKey), [xDataKey]);
  const visibleData = React.useMemo(() => {
    if (!xDomain) return data as unknown as Record<string, unknown>[];
    return filterDataByXDomain(data as unknown as Record<string, unknown>[], xDomain, xAccessorForBrush) as unknown as ChartDatum[];
  }, [data, xDomain, xAccessorForBrush]);

  // P6.2 — hoisted above the definition memo so every out-of-spec overlay
  // (profit-loss segments, projection marks/gradients, terminal + end anchors)
  // reads the SAME extent the spec's x domain gets, the way bklit's single
  // `useChartStable().xScale` does. The five copies that used to recompute
  // min/max inline from `renderData` silently skipped the `xDomain`
  // short-circuit below and misplaced their geometry (D347).
  const timeExtentRaw = React.useMemo(() => {
    if (xDomain) return { minTime: xDomain[0].getTime(), maxTime: xDomain[1].getTime() } as const;
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const d of renderData) {
      const v = d[xDataKey];
      if (v instanceof Date) {
        const t = v.getTime();
        if (t < minTime) minTime = t;
        if (t > maxTime) maxTime = t;
      }
    }
    if (!Number.isFinite(minTime)) return null;
    return { minTime, maxTime } as const;
  }, [renderData, xDataKey, xDomain]);
  // Rendered x-domain: data extent extended by the projection tail so every
  // consumer (selection scale, reference areas, x-axis overlay) matches the
  // spec's rendered scale. When xDomain is set the extent IS xDomain — no projection merge.
  const timeExtent = React.useMemo(() => {
    if (!timeExtentRaw) return null;
    if (xDomain) return timeExtentRaw;
    if (projectionConfigs.length === 0) return timeExtentRaw;
    return { minTime: timeExtentRaw.minTime, maxTime: mergeProjectionXDomainMax(timeExtentRaw.maxTime, projectionConfigs) } as const;
  }, [timeExtentRaw, projectionConfigs, xDomain]);

  // C6: native brushX control (line/area strip host only — instances with no
  // <ChartBrush> child have brushes.length === 0 and all of this collapses to
  // EMPTY_BRUSH_CONTROLS/no-ops). Superseded at v0.15 the (now-obsolete)
  // brush-drag.ts NON-VIABLE ruling: this host chart owns the control
  // directly via defineChart's `controls:`, instead of needing a second
  // <Chart> host — see the C6 executor report for the ruling text, preserved
  // verbatim before brush-drag.ts's deletion.
  const brushConfig = brushes[0] ?? null;
  const hasBrush = brushConfig != null;
  const brushTrackExtent = React.useMemo<[Date, Date] | null>(() => {
    if (!timeExtent) return null;
    return [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)];
  }, [timeExtent]);
  const brushFallbackRange = React.useMemo<BrushRange<Date> | null>(() => {
    if (!brushTrackExtent) return null;
    return { start: brushTrackExtent[0], end: brushTrackExtent[1] };
  }, [brushTrackExtent]);
  const brushInitialSelection = brushConfig?.initialSelection ?? null;
  // Value-stable (not reference-stable-per-render) so the ControlledSignal's
  // `value` argument only changes when start/end actually change — the docs'
  // "cancels divergent external updates" behavior compares this against its
  // own live echo, and a fresh-but-equal object every render would look like
  // a spurious external commit fighting an in-progress drag.
  const brushRangeValueRef = React.useRef<BrushRange<Date> | null>(null);
  const brushRangeValue = React.useMemo<BrushRange<Date> | null>(() => {
    const next: BrushRange<Date> | null = brushInitialSelection
      ? { start: brushInitialSelection.start, end: brushInitialSelection.end }
      : brushFallbackRange;
    const prev = brushRangeValueRef.current;
    if (prev && next && prev.start.getTime() === next.start.getTime() && prev.end.getTime() === next.end.getTime()) {
      return prev;
    }
    brushRangeValueRef.current = next;
    return next;
  }, [brushInitialSelection, brushFallbackRange]);
  const brushOnSelectionChangeRef = React.useRef(brushConfig?.onSelectionChange);
  brushOnSelectionChangeRef.current = brushConfig?.onSelectionChange;
  // Fires on every preview tick AND commit — NOT commit-only like the docs'
  // own toy example — for parity with legacy useBrushDrag, which called
  // onSelectionChange continuously during a drag so the detail chart's
  // narrowed `xDomain` and this strip's own portal chrome track live.
  const handleBrushChange = React.useCallback((next: BrushRange<Date>, context: { reason: BrushXChange<Date> }) => {
    const { reason } = context;
    if (reason.type === "cancel") return;
    const startMs = next.start.getTime();
    const endMs = next.end.getTime();
    if (startMs === endMs) {
      // bklit chart-brush.tsx:271-291 boundsToSelection — zero-width clears.
      // Only clear on a real commit; a transient zero-width mid-"creating"
      // preview shouldn't null out the detail chart's xDomain.
      if (reason.type === "commit") brushOnSelectionChangeRef.current?.(null);
      return;
    }
    brushOnSelectionChangeRef.current?.({ start: next.start, end: next.end });
  }, []);
  // D422 (intentional improvement, not a parity break) — `values` is the
  // FULL (non-decimated) x data, giving the native control real snap points
  // and keyboard stepping. Legacy's pixel-drag math had neither: it always
  // interpolated an exact Date from raw pixel position.
  const brushValues = React.useMemo<Date[] | null>(() => {
    if (!hasBrush) return null;
    const out: Date[] = [];
    for (const d of data as unknown as Record<string, unknown>[]) {
      const v = xAccessorForBrush(d);
      if (v instanceof Date) out.push(v);
    }
    return out;
  }, [hasBrush, data, xAccessorForBrush]);
  const brushControls = React.useMemo<readonly ChartControl<Date, number>[]>(() => {
    if (!hasBrush || !brushRangeValue || !brushValues || brushValues.length === 0) return EMPTY_BRUSH_CONTROLS;
    return [
      brushX<Date>({
        range: controlledSignal<BrushRange<Date>, BrushXChange<Date>>(brushRangeValue, handleBrushChange),
        values: brushValues,
        format: (d: Date) => shortDateFmt.format(d),
        ariaLabel: "Brush selection",
        startAriaLabel: "Selection start",
        endAriaLabel: "Selection end",
        selectionStyle: BRUSH_NATIVE_HIDDEN_STYLE,
        handleStyle: BRUSH_NATIVE_HIDDEN_STYLE,
      }),
    ];
  }, [hasBrush, brushRangeValue, brushValues, handleBrushChange]);

  // bklit y-domain parity — exact port of time-series-chart-shell.tsx
  // `resolveTimeSeriesYDomain` + `niceYDomain` (d3 .nice() applied by the
  // configured scale below): all-values>=0 -> [0, max*1.1]; mixed-sign ->
  // [min,max] padded 5% each side; empty -> [0,100]. Shared via
  // internal/y-domain.ts with area-chart.tsx and composed-chart.tsx.
  // shell:341 — yDomainTarget uses visibleData when brushing (marks stay on full data).
  // P5.7 Strand 5 (D257 §4 difference #3) — the y-gridlines sat at different
  // positions from bklit's during `status="loading"`, and this is why: bklit
  // does not lay the loading state out over the caller's data at all. Its
  // shell builds a SKELETON series (`time-series-chart-shell.tsx:228-234`) and
  // derives a separate `yDomainSkeletonByAxis` from it (`:327-334`), which is
  // what `useAnimatedYDomains` holds while the chart is loading; migrated
  // computed one domain from the real rows and used it in every phase. Same
  // resolver, same nice(), different SOURCE — hence five evenly-spaced
  // gridlines in both impls at five different y-pixels.
  //
  // Note this is geometry, not chrome: the skeleton VALUES had already been
  // ported (`line-chart.tsx`'s pulse path inlined the identical expression),
  // they simply never reached the domain. FD7/DOC-10 keeps the public
  // `generateChartSkeletonData` deleted; `buildLoadingSkeletonRows` is the
  // internal shape-only equivalent.
  const skeletonRows = React.useMemo(
    () => buildLoadingSkeletonRows(data.length, lines[0]?.dataKey ?? "value"),
    [data.length, lines],
  );
  const yDomainSource = React.useMemo(
    () => (status === "loading" ? skeletonRows : visibleData) as unknown as ChartDatum[],
    [status, skeletonRows, visibleData],
  );
  // P6.1 / T-F1 (L10) — one domain per `yAxisId` group instead of one for the
  // whole chart. For a single-axis chart every series normalizes to "left", so
  // this resolves ONE group and hands `resolveTimeSeriesYDomain` exactly the
  // arguments the old single call passed; `yDomain` below is then the same
  // tuple, and everything downstream of it is untouched.
  const yDomainsByAxis = React.useMemo(
    () =>
      resolveYDomainsByAxis({
        series: lines,
        resolveDomain: (axisLines) => resolveTimeSeriesYDomain(yDomainSource, axisLines),
      }),
    [yDomainSource, lines],
  );
  // The primary axis drives the grid, the y ticks, the crosshair and the
  // reference-area bands — same as bklit, whose axis chrome reads
  // `getPrimaryYScale`. Empty `lines` still yields [0,100], matching the old
  // call's `!Number.isFinite(min)` branch.
  const yDomain = React.useMemo(
    () => domainForAxis(yDomainsByAxis, DEFAULT_Y_AXIS_ID),
    [yDomainsByAxis],
  );

  const { niced: nicedYDomain, changed: nicedYDomainChanged } =
    useNicedYDomainChanged(yDomain);

  // Projection merge on top of the niced base. The merged result is NOT
  // nice'd again — bklit `buildYScalesFromDomains` builds `scaleLinear({domain})`
  // with no nice; value-identical to the plain niced domain when no
  // projection is present.
  const yDomainFinal = React.useMemo<[number, number]>(() => {
    if (projectionConfigs.length === 0) return nicedYDomain;
    return mergeProjectionYDomain(nicedYDomain, projectionConfigs, DEFAULT_Y_AXIS_ID);
  }, [nicedYDomain, projectionConfigs]);

  // P6.1 — the niced domain of every OTHER axis, and the projector that maps a
  // value from its own axis into the primary axis's domain. See
  // `createAxisValueProjector`: TanStack's spec carries one `y` scale, so a
  // second axis is expressed by reprojecting values into the shared one.
  // Identity for the primary axis, so single-axis charts are untouched.
  const nicedDomainsByAxis = React.useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      out[axisId] = createNicedYScale(domain).domain() as [number, number];
    }
    return out;
  }, [yDomainsByAxis]);
  const projectorFor = React.useMemo(
    () => createAxisValueProjector(nicedDomainsByAxis, yDomainFinal),
    [nicedDomainsByAxis, yDomainFinal],
  );

  // The y-domain tween triggers on the FINAL (projection-merged) domain;
  // identical to the shared niced-domain signal when no projection exists.
  const prevYDomainFinalRef = React.useRef(yDomainFinal);
  const yDomainChangedForTween =
    projectionConfigs.length === 0
      ? nicedYDomainChanged
      : prevYDomainFinalRef.current[0] !== yDomainFinal[0] ||
        prevYDomainFinalRef.current[1] !== yDomainFinal[1];
  prevYDomainFinalRef.current = yDomainFinal;

  const isLoading = status === "loading";
  // P5.7 FD6 — the pulse mode is a function of the lifecycle phase, not of
  // `status`: "loading" loops, "exiting" finishes its half-cycle, and
  // "revealingLoading" grows in. This call site previously hard-defaulted to
  // "loop", so the exit/enter shapes were unreachable.
  const pulseMode = resolveLineLoadingPulseMode(chartPhase);
  const marks = React.useMemo<ChartMark<ChartDatum, Date, number>[]>(
    () => {
      if (isLoading) return [];
      const gridGuideHL = resolveGridGuide(grid);
      const base = lines.map((line) => {
        const hasDashTail = resolveDashTailBounds(line.dashFromIndex, renderData.length);
        // P6.1 (L10): identity unless this series names a non-primary axis.
        const projectY = projectorFor(line.yAxisId);
        return lineY(renderData, {
          id: line.dataKey,
          x: (d: ChartDatum) => d[xDataKey] as Date,
          y: (d: ChartDatum) => projectY(d[line.dataKey] as number),
          // Series identity for group-x focus: without z, every series' points
          // carry group=null and focusX dedupes the group down to one point,
          // so multi-series hover would only ever surface a single series.
          z: () => line.dataKey,
          curve: d3Curve(line.curve ?? curveNatural),
          stroke: hasDashTail ? "transparent" : line.stroke,
          strokeOpacity: hasDashTail ? 0 : undefined,
          strokeWidth: line.strokeWidth ?? 2.5,
          // C1 (P6): legend-hover series dim — bklit SeriesHoverDim's
          // legend term (line.tsx dims to 0.3, 400ms ease-in-out). Programmatic-
          // source-only so pointer hover never triggers this (legend-driven).
          // C3: second entry — pointer-hover series dim (bklit SeriesHoverDim's
          // pointer term, hover-chrome.ts DIM_OPACITY="0.3"). No `transition`
          // field (D425 — the 0.4s term rides `.ts-chart__line path` in
          // styles.css instead, per the explicit pointer-hover-dim directive).
          states: [
            {
              when: whenSeriesDimmed(),
              style: { opacity: 0.3 },
              transition: { type: "tween", duration: 400, easing: "ease-in-out" },
            },
            pointerHoverDimState<ChartDatum>(0.3),
          ],
        });
      });
      // SeriesMarkers grid — dot marks ABOVE the line stroke (bklit line.tsx:317-401 z-order: hover-dim stroke -> markers -> highlight band). Null y values produce no dot (bklit series-markers.tsx:107-120).
      if (!isLoading && markerSeriesConfigs.some((s) => s.showMarkers)) {
        base.push(...buildMarkerMarks(renderData, xDataKey, markerSeriesConfigs, markerGradientIdByKey));
      }
      // C3: native crosshair (replaces hover-chrome's imperative
      // buildIndicator/positionIndicator) — x-only rule, gated on
      // tooltip.showCrosshair (bklit default true). References the app-owned
      // gradient def rendered in the JSX <defs> block below.
      if (tooltipEnabled && (tooltip?.showCrosshair ?? true)) {
        base.push(
          buildIndicatorMark({
            gradientId: crosshairGradientId,
            width: tooltip?.indicatorWidth,
            span: tooltip?.indicatorSpan,
            columnWidth: tooltip?.columnWidth,
            dasharray: tooltip?.indicatorDasharray,
            color: typeof tooltip?.indicatorColor === "string" ? tooltip.indicatorColor : undefined,
            discrete: isDiscrete,
          }) as unknown as ChartMark<ChartDatum, Date, number>,
        );
      }
      // C3: native hover dots (replaces ensureDot/updateDotPosition) — one
      // whenFocused(dot(...), {match:"x", retarget:true}) per series, gated
      // on tooltip.showDots (bklit default true).
      if (tooltipEnabled && (tooltip?.showDots ?? true)) {
        for (const line of lines) {
          base.push(
            buildHoverDotMark(
              renderData,
              xDataKey,
              { dataKey: line.dataKey, color: line.stroke ?? "var(--chart-line-primary)" },
              resolveHoverDotFill(line.stroke ?? "var(--chart-line-primary)", tooltip?.dotColor),
              {
                size: tooltip?.dotSize,
                strokeWidth: tooltip?.dotStrokeWidth,
                discrete: isDiscrete,
              },
            ),
          );
        }
      }
      // C3: native highlight band (replaces hover-chrome's imperative
      // clip-rect sweep) — reactive slice around `hoveredIndex`, driven by
      // React state set in handleFocusChange below, not DOM.
      if (tooltipEnabled) {
        base.push(
          ...buildHighlightBandMarks(
            renderData,
            xDataKey,
            hoveredIndex,
            lines.map((line) => ({
              dataKey: line.dataKey,
              color: line.stroke ?? "var(--chart-line-primary)",
              strokeWidth: line.strokeWidth ?? 2.5,
              showHighlight: line.showHighlight ?? true,
              curve: d3Curve(line.curve ?? curveNatural),
            })),
            { discrete: isDiscrete },
          ),
        );
      }
      // Grid highlight rows (bklit highlightRowValues) — solid lines under
      // the series marks; gated on the resolved grid horizontal default.
      // Native `ruleY` marks derive geometry (full plot width, y via the
      // chart's own scale) from the chart bounds themselves; the local y
      // scale here is only the non-finite-y row-filter oracle.
      if (grid && gridGuideHL.horizontal && grid.highlightRowValues && grid.highlightRowValues.length > 0 && width > 0) {
        const innerWHL = Math.max(0, width - margin.left - margin.right);
        const innerHHL = Math.max(0, heightPx - margin.top - margin.bottom);
        if (innerWHL > 0 && innerHHL > 0) {
          const yScaleHL = scaleLinear().domain(yDomainFinal).range([innerHHL, 0]);
          base.unshift(
            ...gridHighlightRowMarks({
              grid,
              yScale: (v: number) => yScaleHL(v),
            }),
          );
        }
      }
      // ProfitLossLine — sign-colored segments, distinct from projection
      const hasPL = profitLossLines.length > 0 && width > 0 && !isLoading;
      if (hasPL) {
        const innerWPL = Math.max(0, width - margin.left - margin.right);
        const innerHPL = Math.max(0, heightPx - margin.top - margin.bottom);
        if (innerWPL > 0 && innerHPL > 0) {
          const yScalePL = scaleLinear().domain(yDomainFinal).range([innerHPL, 0]);
          if (timeExtent && timeExtentRaw) {
            const xScalePL = (value: Date) =>
              timeToPixelX(value, timeExtentRaw.minTime, timeExtent.maxTime, innerWPL);
            const focusedPL = hoveredIndexForPL ?? plTooltipSignIndex;
            for (let i = 0; i < profitLossLines.length; i++) {
              const raw = profitLossLines[i] as unknown as Record<string, unknown> | undefined;
              const cfg = normalizeProfitLossConfig(raw);
              if (!cfg) continue;
              const marksPL = profitLossLineMarks({
                id: `${projectionGradientBaseId}-${i}`,
                config: cfg,
                data: renderData as ChartDatum[],
                xDataKey,
                xScale: xScalePL,
                yScale: (v: number) => yScalePL(v) ?? 0,
                innerWidth: innerWPL,
                focusedIndex: focusedPL,
                translateX: margin.left,
                translateY: margin.top,
              });
              for (const m of marksPL) base.push(m);
            }
          }
        }
      }

      if (projectionConfigs.length === 0 || width <= 0) return base;
      const innerW = Math.max(0, width - margin.left - margin.right);
      const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
      if (innerW <= 0 || innerH <= 0) return base;
      const yScale = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
      if (!timeExtent || !timeExtentRaw) return base;
      const xScaleWithProjection = (value: Date) =>
        timeToPixelX(value, timeExtentRaw.minTime, timeExtent.maxTime, innerW);
      for (let i = 0; i < projectionConfigs.length; i++) {
        const cfg = projectionConfigs[i];
        const p = projectionLines[i] as unknown as Record<string, unknown> | undefined;
        if (!p || !cfg || cfg.data.length < 2) continue;
        const stroke = (p["stroke"] as string | undefined) ?? "var(--chart-3)";
        const gid = `${projectionGradientBaseId}-proj-${i}`;
        const mark = projectionLineMark({
          id: `projection-line-${i}`,
          data: cfg.data,
          yAxisId: cfg.yAxisId,
          stroke,
          strokeStyle: ((p["strokeStyle"] as string | undefined) ?? "solid") as "solid" | "gradient",
          gradientStart: (p["gradientStart"] as string | undefined) ?? stroke,
          gradientEnd: (p["gradientEnd"] as string | undefined) ?? "var(--chart-5)",
          gradientId: gid,
          strokeWidth: (p["strokeWidth"] as number | undefined) ?? 2,
          curveKind: ((p["curveKind"] as string | undefined) ?? "linear") as "linear" | "bezier",
          strokeDasharray: (p["strokeDasharray"] as string | undefined) ?? "6,4",
          strokeOpacity: (p["strokeOpacity"] as number | undefined) ?? 1,
          showEndMarker: ((p["showEndMarker"] as boolean | undefined) ?? (p["showEndpoints"] as boolean | undefined) ?? true) as boolean,
          endpointRadius: (p["endpointRadius"] as number | undefined) ?? 5,
          className: (p["className"] as string | undefined) ?? "chart-projection-line",
          xScale: xScaleWithProjection,
          yScale: (v: number) => yScale(v) ?? 0,
          innerWidth: innerW,
          strokeVisible: !isLoading,
          translateX: margin.left,
          translateY: margin.top,
        });
        if (mark) base.push(mark);
      }
      return base;
    },
    [renderData, xDataKey, lines, isLoading, width, heightPx, yDomainFinal, projectorFor, projectionConfigs, projectionLines, projectionGradientBaseId, margin, profitLossLines, hoveredIndexForPL, plTooltipSignIndex, grid, markerSeriesConfigs, markerGradientIdByKey, timeExtent, timeExtentRaw, tooltipEnabled, tooltip, crosshairGradientId, isDiscrete, hoveredIndex],
  );

  const spec = React.useMemo(() => {
    if (width <= 0) return null;
    // C2: single source for the final y-domain — niced base with the
    // projection merge already applied (no re-nice). Reused below for the
    // native y axis's tick-value list.
    const niced = yDomainFinal;
    // D110 escape hatch: stash the ranged time scale in ChartScale.resolve;
    // xForIndex and the hover highlight consume the exact rendered mapping.
    const xScale: ChartScale = {
      id: "x",
      resolve(context) {
        const [r0, r1] = context.range;
        // P6.2 — the SPEC's x domain and every out-of-spec overlay now read the
        // one `timeExtent` memo (bklit shell:285-301: when xDomain is set the
        // domain narrows to xDomain and mergeProjectionXDomainMax is SKIPPED —
        // "Brush defines the viewport — projection horizon is included via brush
        // track extent, not by extending past the selection on the main chart").
        // This block used to recompute that extent inline, a sixth copy (D347).
        const minTime = timeExtent ? timeExtent.minTime : Number.NaN;
        const maxTime = timeExtent ? timeExtent.maxTime : Number.NaN;
        if (!Number.isFinite(minTime)) {
          const base = scaleUtc();
          base.domain([0, 0]);
          base.range([r0, r1]);
          xScaleD3Ref.current = base as unknown as ScaleTime<number, number>;
          return {
            id: context.id,
            type: "time",
            domain: base.domain(),
            map: (value: unknown) => {
              const m = base(value as Date);
              return m === undefined ? Number.NaN : m;
            },
            ticks: [],
            bandwidth: 0,
          };
        }
        const base = scaleUtc().domain([minTime, maxTime]).range([r0, r1]);
        xScaleD3Ref.current = base as unknown as ScaleTime<number, number>;
        // C4: when a native x axis is configured, the tick LIST comes from
        // bklit's own tick-choice algorithm (data-aligned/domain-interpolated
        // selection, projection-tail append) — verbatim moved to
        // internal/axis-ticks.ts's buildXAxisTickValues. Positions still come
        // from THIS resolver's own scale instance, so grid + tick labels stay
        // pixel-identical to the mark geometry.
        const tickList = xAxis
          ? buildXAxisTickValues({
              data: xDomain ? visibleData : renderData,
              xDataKey,
              rangeStart: r0,
              rangeEnd: r1,
              numTicks: xAxis.numTicks ?? 5,
              formatValue: xAxis.formatValue,
              domainMaxTime: timeExtent?.maxTime,
              xDomain: xDomain ?? null,
              tickMode: xAxis.tickMode,
            })
          : base.ticks(context.tickCount ?? 5).map((value) => ({ value, label: value.toISOString() }));
        return {
          id: context.id,
          type: "time",
          domain: base.domain(),
          map: (value: unknown) => {
            const m = base(value as Date);
            return m === undefined ? Number.NaN : m;
          },
          ticks: tickList.map((t) => ({
            value: t.value,
            position: base(t.value) ?? Number.NaN,
            label: t.label,
          })),
          bandwidth: 0,
        };
      },
    };
    const yScale = scaleLinear().domain(niced);
    const gridGuide = resolveGridGuide(grid);
    // C4: proximity-fade opacity for x tick labels — replaces date-pill.ts's
    // imperative span opacity styling. `ctx.position` is the same scene-x
    // space `labelFade.primaryX` (the focused point's rendered x) lives in.
    const xTickLabelOpacity = labelFade
      ? (ctx: { value: unknown; position: number }) =>
          tickLabelFadeOpacity(
            ctx.position,
            (xAxis?.formatValue ?? shortDateFmt.format)(ctx.value as Date),
            labelFade.primaryX,
            labelFade.hoveredLabel,
            xAxis?.tickerHalfWidth ?? TICKER_HALF_WIDTH,
            FADE_BUFFER,
          )
      : 1;
    // bklit shell:373-395 — effective tween enable = yDomainTween || (tweenYDomainOnXDomainChange && xDomain != null) already folded into effectiveYDomainTweenDuration; gate uses yDomainChangedForTween which tracks the visibleData-derived domain.
    // C5 (D432/A3): `svgAnimation` (renderer.js's blanket per-render-pass
    // reconcile, read only by the static SVG renderer) is dead once
    // rendering through `motion()` — replaced by a chart-level `motion`
    // callback carrying the SAME gate, now scoped per mark role/phase
    // instead of blanket:
    //  - phase "enter" on line/area/dot: `false` — RevealWipe (A2,
    //    internal/reveal-wipe.ts) owns entrance for these roles via its own
    //    clip-path sweep on `.ts-chart__marks`; letting native entrance
    //    choreography also fire would double-animate the same geometry.
    //  - phase "update" on line/area/dot: bklit's data-update contract
    //    (chart-phase.ts) — new data paints immediately; only a y-domain
    //    change tweens (500ms scale tween). Reusing the exact pre-C5
    //    `svgAnimation` gate reproduces this: tween iff the gate holds,
    //    else `false` (snap).
    //  - anything else (exit; any other role): `undefined` — falls through
    //    to the renderer's own cascade default instead of being silently
    //    disabled.
    const yDomainTweenGateActive = isChartInteractionPhase(chartPhase) && isLoaded && yDomainChangedForTween;
    const motion = (context: ChartMotionContext<unknown>) => {
      if (context.role === "line" || context.role === "area" || context.role === "dot") {
        if (context.phase === "enter") return false as const;
        if (context.phase === "update") {
          return yDomainTweenGateActive
            ? {
                transition: {
                  type: "tween" as const,
                  duration: effectiveYDomainTweenDuration as number,
                  easing: bezierEasing,
                },
              }
            : (false as const);
        }
      }
      return undefined;
    };
    // C5 (D432/A5): AX5 — bklit chart-phase.ts DEFAULT_Y_DOMAIN_TWEEN_MS,
    // the axis-label position tween (design-tokens.ts:48-53: `left`/`top`
    // CSS on the deleted HTML axis overlays, pre-C4). Native SVG tick
    // labels can't tween x/y via CSS (not CSS properties on `<text>`), so
    // the tween returns through `tickLabels.motion` here — scoped to
    // tick-label position only, never `ticks`/the grid (design-tokens.ts's
    // AX5 comment never mentions the grid).
    const tickLabelMotion = (context: ChartMotionContext<unknown>) =>
      context.phase === "enter"
        ? (false as const)
        : {
            transition: {
              type: "tween" as const,
              duration: DEFAULT_Y_DOMAIN_TWEEN_MS,
              easing: bezierEasing,
            },
          };
    const xScaleOptions: ChartPositionScaleOptions<Date> = {
      scale: xScale,
      grid: gridGuide.vertical,
      axis: {
        ticks: { count: gridGuide.columnTicks, size: 0, padding: 0 },
        line: false,
        tickLabels: xAxis
          ? {
              fontSize: 12,
              thin: false,
              dy: margin.bottom - 25,
              opacity: xTickLabelOpacity,
              motion: tickLabelMotion,
            }
          : false,
      },
    };
    // C4: with a native y axis configured, tick VALUES come from
    // buildYAxisTickValues (bklit's niced-domain 1–10 clamp) instead of
    // gridGuide.ticks's plain count hint — deviation: the horizontal grid
    // now follows the label ticks (identical output for default configs,
    // since both derive from the same niced domain, but the count POLICY
    // is replaced).
    const yScaleOptions: ChartPositionScaleOptions<number> = yAxis
      ? {
          scale: yScale,
          grid: gridGuide.horizontal,
          axis: {
            ticks: {
              values: buildYAxisTickValues(niced, yAxis.numTicks),
              format: (v: number) => formatYAxisTick(v, yAxis.formatValue, yAxis.formatLargeNumbers ?? true),
              size: 0,
              padding: 0,
            },
            line: false,
            tickLabels: {
              fontSize: 12,
              thin: false,
              opacity: 1,
              dx: yAxis.orientation === "right" ? 8 : -8,
              motion: tickLabelMotion,
            },
          },
          side: yAxis.orientation === "right" ? "right" : "left",
        }
      : {
          scale: yScale,
          grid: gridGuide.horizontal,
          axis: { ticks: { count: gridGuide.ticks, size: 0 }, line: false, tickLabels: false },
        };
    return {
      marks,
      // CH3/CH4: tick counts reach the guides only via `axis.ticks.count`
      // (charts-core resolveTickCount → context.tickCount); a bare `ticks:`
      // key on the spec is never read.
      scales: {
        x: xScaleOptions,
        y: yScaleOptions,
      },
      // C4: the only styling channel for native tick-label `fill` (v0.15.0)
      // — parity with the deleted overlays' `var(--color-chart-label, ...)`.
      theme: { muted: "var(--color-chart-label, var(--chart-label))" },
      margin,
      focus: "group-x" as const,
      // bklit has no native focus ring — its hover dot is the springed TooltipDot.
      focusRing: false,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      // C2 (P6): native tooltip extension replaces the imperative box panel
      // (tooltip-chrome.ts's buildBox/applyBoxContent/positionBox). Line/area
      // drive it off the SAME native focus:"group-x" mechanism the crosshair
      // chrome already uses — no extra pointer-injection wiring needed here
      // (contrast composed-chart.tsx, which drives its own bisector).
      tooltip: (tooltip?.enabled ?? false)
        ? {
            use: nativeTooltip,
            className: "bkm-native-tooltip",
            sticky: false,
            offset: BOX_OFFSET,
            placement: ["right", "left"] as const,
            motion:
              renderData.length > DISCRETE_INTERACTION_THRESHOLD
                ? (false as const)
                : ({
                    type: "spring" as const,
                    stiffness: TOOLTIP_BOX_SPRING.stiffness,
                    damping: TOOLTIP_BOX_SPRING.damping,
                  } as const),
          }
        : (false as const),
      motion,
      // C6: native brushX (strip host only — empty array elsewhere).
      controls: brushControls,
    };
  }, [marks, renderData, xDataKey, grid, width, yDomainFinal, yDomainChangedForTween, margin, chartPhase, isLoaded, effectiveYDomainTweenDuration, projectionConfigs, xDomain, timeExtent, tooltip, xAxis, yAxis, visibleData, labelFade, brushControls]);

  const definition = React.useMemo(() => {
    if (!spec) return null;
    return defineChart(spec);
  }, [spec]);

  // C2 (P6): renders inside the native tooltip extension's unstyled
  // `.ts-chart-tooltip__body` portal target — wraps the reused
  // `TooltipContent` in `.bkm-tooltip-panel` (styles.css) to reproduce the
  // old imperative box's visual chrome, since the native chrome is reset to
  // transparent by the `.bkm-native-tooltip` rule in styles.css. Custom
  // `tooltip.content` fully replaces the row list (bklit applyBoxContent
  // parity); otherwise default rows come from `lines`, honoring
  // `tooltip.rows` when the caller supplied it.
  const renderTooltipBody = React.useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): React.ReactNode => {
      const primary = ctx.points[0];
      if (!primary) return null;
      const datum = primary.datum as Record<string, unknown>;
      const cfg = tooltip ?? null;
      const panelClassName = cfg?.className ? `bkm-tooltip-panel ${cfg.className}` : "bkm-tooltip-panel";
      const panelStyle: React.CSSProperties | undefined =
        cfg?.panelStyle || cfg?.backgroundColor
          ? { ...cfg?.panelStyle, ...(cfg?.backgroundColor ? { backgroundColor: cfg.backgroundColor } : null) }
          : undefined;
      if (cfg?.content) {
        return (
          <div className={panelClassName} style={panelStyle}>
            {cfg.content({ point: datum, index: primary.datumIndex })}
          </div>
        );
      }
      const date = datum[xDataKey];
      const title = date instanceof Date ? weekdayDateFmt.format(date) : undefined;
      const rows: TooltipRow[] = cfg?.rows
        ? cfg.rows(datum)
        : lines.map((line) => {
            const v = datum[line.dataKey];
            return {
              color: line.stroke || ctx.points.find((p) => p.markId === line.dataKey)?.color || "transparent",
              label: line.dataKey,
              value: typeof v === "number" ? v : String(v ?? 0),
            };
          });
      return (
        <div className={panelClassName} style={panelStyle}>
          <TooltipContent title={title} rows={rows}>
            {cfg?.children}
          </TooltipContent>
        </div>
      );
    },
    [tooltip, xDataKey, lines],
  );
  // C3: internal/hover-chrome.ts + internal/use-hover-chrome.ts (both
  // deleted in this commit) are replaced by: native crosshair/hover-dot/
  // highlight-band marks (wired into `marks` above — native focus:"group-x"
  // drives them directly off the pointer, no React work per move), plus this
  // one unified focus handler for the remaining REACTIVE surfaces (profit/
  // loss sign flip, `hoveredIndex` for the highlight band, the marker-active-
  // date store, and the app-owned date-pill overlay).
  //
  // Suppression (drag-selection / xDomain-clamp / non-interactive phase): the
  // old imperative chrome only had to withhold data from its OWN writer, but
  // native marks read TanStack's own internal focus state straight off the
  // pointer — so suppressing them now additionally requires overriding that
  // state via `interaction.setControlledFocus(null, {source:"pointer"})`,
  // captured below from `onRender`'s context (D110-style escape hatch, same
  // shape as `useFocusInjection`'s own private capture).
  const interactionRef = React.useRef<ChartInteractionController<ChartDatum, Date, number> | null>(null);
  // C6: scene-space resolved-scale capture — feeds useChartSelection's
  // clientToScene + scene.scales.x.invert path (replaces the plot-local
  // xScaleForSelection duplicate scale below).
  const sceneRef = React.useRef<ChartScene<ChartDatum, Date, number> | null>(null);
  // bklit parity (use-chart-interaction.ts): drag selection suppresses the
  // hover chrome — cleared on mousedown, never rescheduled while dragging.
  const dragSelectionActiveRef = React.useRef(false);
  // Jump-vs-spring for the pill/crosshair/highlight motion on first show —
  // mirrors hover-chrome.ts's local `showing = !visible` flag.
  const wasVisibleRef = React.useRef(false);
  const chartConfig = useChartConfig();
  const dateLabelsForPill = React.useMemo(
    () =>
      renderData.map((d) => {
        const v = d[xDataKey];
        if (v instanceof Date) return shortDateFmt.format(v as Date);
        return String(v ?? "");
      }),
    [renderData, xDataKey],
  );
  const datePill = useDatePillOverlay({
    enabled: tooltipEnabled && (tooltip?.showDatePill ?? true),
    dateLabels: dateLabelsForPill,
    tooltipSpring: chartConfig.tooltipSpring,
  });
  // LM7/LM8 (P1.12): shared store carrying the live tooltip date for
  // ChartMarkersOverlay's isActive + useActiveMarkers consumers.
  const markerActiveStore = React.useMemo(() => createActiveMarkersStore(), []);

  // Shared by drag-start suppression and marker-hover-clear (LM6 legacy
  // interplay) — force-clears native focus AND every reactive surface this
  // file still owns, mirroring hover-chrome.ts's `hide()`.
  const clearFocusChrome = React.useCallback(() => {
    interactionRef.current?.setControlledFocus(null, { source: "pointer" });
    setHoveredIndex(null);
    if (profitLossLines.length > 0) setPlTooltipSignIndex(null);
    markerActiveStore.setActiveDate(null);
    wasVisibleRef.current = false;
    datePill.hide();
    setLabelFade(null);
  }, [profitLossLines, markerActiveStore, datePill]);

  const handleFocusChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      const rawPrimary = points[0];
      // bklit shell comment — interaction bisects only visiblePlotData; with
      // domain-clamp the focus stack is over full data, so an edge pointer
      // can resolve an off-viewport point.
      const outsideXDomain =
        xDomain != null && rawPrimary != null && isFocusOutsideXDomain(rawPrimary.datum, xDataKey, xDomain);
      const phaseGated = !(isChartInteractionPhase(chartPhase) && isLoaded);
      const suppressed = outsideXDomain || dragSelectionActiveRef.current || phaseGated;
      if (suppressed && points.length > 0) {
        interactionRef.current?.setControlledFocus(null, { source: "pointer" });
      }
      const primary = suppressed ? undefined : rawPrimary;

      // Line-only profit/loss sign flip (bklit use-hover-chrome.ts's
      // onFocusPoints, inlined here — Line is the only chart that needs it).
      if (profitLossLines.length > 0) {
        let next: number | null = null;
        if (primary) {
          const firstCfg = profitLossLines[0] as unknown as Record<string, unknown> | undefined;
          const dk = firstCfg?.["dataKey"] as string | undefined;
          if (dk) {
            const v = (primary.datum as unknown as Record<string, unknown>)?.[dk];
            if (typeof v === "number") next = v >= 0 ? 0 : 1;
          }
        }
        setPlTooltipSignIndex((prev) => (prev !== next ? next : prev));
      }

      setHoveredIndex(primary ? primary.datumIndex : null);

      const datum = primary?.datum as Record<string, unknown> | undefined;
      const rawDate = datum?.[xDataKey];
      const d = rawDate instanceof Date ? rawDate : rawDate != null ? new Date(rawDate as string | number) : null;
      markerActiveStore.setActiveDate(d && !Number.isNaN(d.getTime()) ? d : null);

      if (primary && (tooltip?.showDatePill ?? true)) {
        const label = d ? shortDateFmt.format(d) : null;
        const jump = !wasVisibleRef.current;
        wasVisibleRef.current = true;
        datePill.show(primary.x, { index: primary.datumIndex, label, discrete: isDiscrete, jump });
        // CH5/B12: bklit XAxis.tickerHalfWidth drives the date-pill label-fade
        // radius. C4: reactive state instead of date-pill.ts's imperative
        // span-opacity write — consumed by the x scale's native
        // `tickLabels.opacity` callback. Guarded so an unchanged focus point
        // doesn't force a `spec`/`definition` rebuild every pointer move.
        setLabelFade((prev) =>
          prev && prev.primaryX === primary.x && prev.hoveredLabel === label
            ? prev
            : { primaryX: primary.x, hoveredLabel: label },
        );
      } else {
        wasVisibleRef.current = false;
        datePill.hide();
        setLabelFade(null);
      }
    },
    [xDomain, xDataKey, chartPhase, isLoaded, profitLossLines, markerActiveStore, tooltip, isDiscrete, datePill, xAxis],
  );

  const markerRevealAnimsRef = React.useRef<Animation[]>([]);
  const markerRevealCancelRef = React.useRef<(() => void) | null>(null);
  // L2 replay key (D311 shape, sankey `seenRevealKeyRef`). `marks.dataset.bkmRevealed`
  // alone cannot express the contract once `revealSignature` is wired: the flag
  // latches for the life of the marks node, so a caller bumping the signature
  // would get nothing. The orchestrator already collapses
  // signature+animationDuration into `revealEpoch`, so one epoch ref is the
  // whole key — it re-opens a reveal window the DOM flag has closed.
  const revealedEpochRef = React.useRef<number | null>(null);
  // A1 (D432): `RendererChart`'s `onRender` passes a `ChartRendererRenderContext`
  // (`{container, scene, surface, interaction}`) — no `svg` field, since the
  // motion renderer's DOM root is reached via `surface.element` instead.
  // Nothing in this file's `handleRender` ever reached into `context.svg`,
  // so only the annotation changes.
  const handleRender = React.useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    // Cast: `useFocusInjection`'s `captureRenderContext` is typed against the
    // library's generic (unknown-typed) `ChartRenderContext`, which — because
    // `interaction.setControlledFocus` is checked contravariantly under
    // strictFunctionTypes — is not structurally assignable from our
    // concretely-typed context. Both denote the same live object at runtime.
    captureRenderContext(context as unknown as Pick<ChartRenderContext, "scene" | "interaction">);
    // C3: own capture, separate from useFocusInjection's private ref — that
    // hook's semantics are legend-hover programmatic focus injection, while
    // this one drives pointer-hover suppression (drag/xDomain/phase) inside
    // handleFocusChange above; conflating them would blur two different
    // sources of `focus`.
    interactionRef.current = context.interaction;
    sceneRef.current = context.scene;
    const marks = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    // A2 (D420/D432): the reveal sweep itself now lives in
    // internal/reveal-wipe.ts, shared byte-for-byte with area-chart.tsx/
    // composed-chart.tsx (see that module's header for why this stays a
    // WAAPI reach-in rather than a native `motion` entrance). Its return
    // value — did the sweep actually play this call? — gates the
    // per-marker fade stagger below exactly as the old inline
    // `shouldAnimate` did.
    const shouldAnimate = runRevealWipe({
      marks,
      epoch: revealEpoch,
      epochRef: revealedEpochRef,
      active: chartPhase === "revealing",
      animationDuration,
      prefersReducedMotion,
      durationMs: revealDurationMs,
      easingCss: revealEasingCss,
    });
    if (!marks || !shouldAnimate) return;
    if (!markerSeriesConfigs.some((s) => s.showMarkers)) return;
    const innerW = Math.max(0, width - margin.left - margin.right);
    // bklit series-markers.tsx:102 — the marker stagger spans the CLIP reveal's
    // duration (`clipRevealTransition(enterTransition).duration ?? animationDuration/1000`).
    const durationSec = revealDurationMs / 1000;
    for (const anim of markerRevealAnimsRef.current) { try { anim.cancel(); } catch { /* already canceled */ } }
    markerRevealAnimsRef.current = [];
    markerRevealCancelRef.current?.();
    const doMarkerReveal = () => {
      for (const s of markerSeriesConfigs) {
        if (!s.showMarkers) continue;
        const radius = s.markers?.radius ?? 5;
        const strokeWidth = s.markers?.strokeWidth ?? 2;
        const ringGap = s.markers?.ringGap ?? 2;
        const outlineWidth = s.markers?.outlineWidth ?? 0;
        const showActiveHighlight = s.markers?.showActiveHighlight ?? true;
        const ring = strokeWidth > 0 ? ringGap + strokeWidth : 0;
        const outline = outlineWidth > 0 ? outlineWidth : 0;
        const highlightPad = showActiveHighlight ? radius * 0.35 : 0;
        const visualExtent = radius + ring + outline + highlightPad + 2;
        const escaped = `${s.dataKey}__marker`.replace(/"/g, '\\"');
        const group = marks.querySelector<SVGGElement>(`.ts-chart__dot[data-ts-key="${escaped}"]`);
        if (!group) continue;
        const circles = group.querySelectorAll<SVGCircleElement>("circle");
        for (const circle of circles) {
          const cx = Number.parseFloat(circle.getAttribute("cx") ?? "0");
          const leadingEdge = Math.max(0, cx - visualExtent);
          const delaySec = innerW > 0 ? (leadingEdge / innerW) * durationSec : 0;
          const anim = circle.animate(
            [{ opacity: 0, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0px)" }],
            { duration: SERIES_MARKER_ENTER_MS, delay: delaySec * 1000, easing: animationEasing, fill: "backwards" },
          );
          markerRevealAnimsRef.current.push(anim);
        }
      }
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      let raf1 = 0, raf2 = 0, tId: number | null = null;
      let cancelled = false;
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          tId = window.setTimeout(() => { if (!cancelled) doMarkerReveal(); }, 0);
        });
      });
      markerRevealCancelRef.current = () => {
        cancelled = true;
        if (raf1) cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
        if (tId !== null) window.clearTimeout(tId);
      };
    } else {
      doMarkerReveal();
    }
  }, [animationDuration, animationEasing, revealDurationMs, revealEasingCss, revealEpoch, chartPhase, markerSeriesConfigs, width, margin.left, margin.right, prefersReducedMotion, captureRenderContext]);

  React.useEffect(() => {
    if (chartPhase !== "revealing") return;
    snapRevealWipe({
      marks: containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks"),
      active: true,
      animationDuration,
      prefersReducedMotion,
    });
  }, [chartPhase, revealEpoch, animationDuration, prefersReducedMotion]);
  React.useEffect(() => () => {
    for (const a of markerRevealAnimsRef.current) { try { a.cancel(); } catch { /* already canceled */ } }
    markerRevealAnimsRef.current = [];
    markerRevealCancelRef.current?.();
  }, []);

  // bklit line.tsx fadeEdges default true → edge-fade mask (styles.css),
  // resolved via the shared fade-mask module (single source).
  const fadeEdgesMask = resolveFadeEdgesMask(lines.map((l) => l.fadeEdges ?? true));

  // bklit shell:285-301 + shell:291-295 brush comment — second extent site (marks-level).
  // When xDomain is set, the spec's xScale domain already IS xDomain (see spec above) and
  // the marks-level extent helpers (terminal markers, projection anchors, x-axis overlay)
  // must match it; projection merge is skipped on this path too.

  const lineTerminalAnchors = React.useMemo(() => {
    if (terminalMarkers.length === 0 || renderData.length === 0 || width <= 0 || heightPx <= 0) return [];
    // P6.2 — the last VISIBLE row, not the last row of the raw `data` prop.
    // bklit publishes `visiblePlotData` as the provider's `data`
    // (time-series-chart-shell.tsx:418), and <LineSeriesTerminalMarker> anchors
    // to `data.at(-1)` off that (line-series-terminal-marker.tsx:37), so under a
    // narrowed `xDomain` the marker sits on the last point INSIDE the viewport.
    // Reading the unfiltered prop mapped a date past `xDomain[1]` and pushed the
    // marker off the right edge of the plot (D347).
    const lastRow = renderData[renderData.length - 1] as Record<string, unknown> | undefined;
    if (!lastRow) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
    const te = timeExtent;
    const teRaw = timeExtentRaw;
    if (!te || !teRaw) return [];
    const xForDate = (d: Date) => timeToPixelX(d, teRaw.minTime, te.maxTime, innerW);
    const yScale2 = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
    const out: Array<{ dataKey: string; cx: number; cy: number; fill: string; stroke: string; radius: number; ringGap: number; strokeWidth: number; outlineWidth: number; outlineColor?: string }> = [];
    for (const tm of terminalMarkers as unknown as Array<Record<string, unknown>>) {
      const dataKey = tm["dataKey"] as string;
      const v = lastRow[dataKey];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const dateVal = toDate(lastRow[xDataKey]);
      if (!dateVal) continue;
      const cx = xForDate(dateVal);
      const cy = (yScale2(v) ?? 0) as number;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      out.push({
        dataKey,
        cx,
        cy,
        fill: (tm["fill"] as string | undefined) ?? "transparent",
        stroke: (tm["stroke"] as string | undefined) ?? "var(--chart-1)",
        radius: (tm["radius"] as number | undefined) ?? 5,
        ringGap: (tm["ringGap"] as number | undefined) ?? 0,
        strokeWidth: (tm["strokeWidth"] as number | undefined) ?? 1.5,
        outlineWidth: (tm["outlineWidth"] as number | undefined) ?? 0,
        outlineColor: tm["outlineColor"] as string | undefined,
      });
    }
    return out;
  }, [terminalMarkers, renderData, width, heightPx, margin, xDataKey, yDomainFinal, timeExtent, timeExtentRaw]);
  const lineEndAnchors = React.useMemo(() => {
    if (projectionEndMarkers.length === 0 || width <= 0 || heightPx <= 0) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
    const te = timeExtent;
    const teRaw = timeExtentRaw;
    if (!te || !teRaw) return [];
    const xForDate = (d: Date) => timeToPixelX(d, teRaw.minTime, te.maxTime, innerW);
    const yScale2 = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
    const out: Array<{ cx: number; cy: number; stroke: string; strokeOpacity: number; radius: number }> = [];
    for (const em of projectionEndMarkers as unknown as Array<Record<string, unknown>>) {
      const pts = em["data"] as Array<{ date: Date; value: number }> | undefined;
      if (!pts || pts.length < 2) continue;
      const last = pts[pts.length - 1]!;
      const dateVal = last.date instanceof Date ? last.date : new Date(last.date as unknown as string);
      if (Number.isNaN(dateVal.getTime())) continue;
      const rawX = xForDate(dateVal);
      const radius = (em["radius"] as number | undefined) ?? 5;
      const edgePadding = radius + 1;
      const cx = Math.min(rawX, Math.max(0, innerW - edgePadding));
      const cy = (yScale2(last.value) ?? 0) as number;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      out.push({ cx, cy, stroke: (em["stroke"] as string | undefined) ?? "var(--chart-3)", strokeOpacity: (em["strokeOpacity"] as number | undefined) ?? 1, radius });
    }
    return out;
  }, [projectionEndMarkers, width, heightPx, margin, yDomainFinal, timeExtent, timeExtentRaw]);

  const projectionGradientDefs = React.useMemo(() => {
    if (projectionConfigs.length === 0 || width <= 0) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
    const yScale = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
    const te = timeExtent;
    const teRaw = timeExtentRaw;
    if (!te || !teRaw) return [];
    const xScaleWithProjection = (value: Date) => timeToPixelX(value, teRaw.minTime, te.maxTime, innerW);
    const defs: Array<{ id: string; startX: number; startY: number; endX: number; endY: number; gradientStart: string; gradientEnd: string }> = [];
    for (let i = 0; i < projectionLines.length; i++) {
      const p = projectionLines[i] as unknown as Record<string, unknown> | undefined;
      if (!p || ((p["strokeStyle"] as string | undefined) ?? "solid") !== "gradient") continue;
      const cfg = projectionConfigs[i];
      if (!cfg || cfg.data.length < 2) continue;
      const stroke = (p["stroke"] as string | undefined) ?? "var(--chart-3)";
      const gradientStart = (p["gradientStart"] as string | undefined) ?? stroke;
      const gradientEnd = (p["gradientEnd"] as string | undefined) ?? "var(--chart-5)";
      const strokeWidth = (p["strokeWidth"] as number | undefined) ?? 2;
      const curveKind = (p["curveKind"] as string | undefined) ?? "linear";
      const endpointRadius = (p["endpointRadius"] as number | undefined) ?? 5;
      const showEndMarker = ((p["showEndMarker"] as boolean | undefined) ?? (p["showEndpoints"] as boolean | undefined) ?? true) as boolean;
      const gid = `${projectionGradientBaseId}-proj-${i}`;
      const gd = resolveProjectionGradientDef({
        id: `projection-line-${i}`,
        data: cfg.data,
        yAxisId: cfg.yAxisId,
        stroke,
        strokeStyle: "gradient",
        gradientStart,
        gradientEnd,
        gradientId: gid,
        strokeWidth,
        curveKind: curveKind as "linear" | "bezier",
        strokeDasharray: (p["strokeDasharray"] as string | undefined) ?? "6,4",
        strokeOpacity: (p["strokeOpacity"] as number | undefined) ?? 1,
        showEndMarker,
        endpointRadius,
        className: (p["className"] as string | undefined) ?? "chart-projection-line",
        xScale: xScaleWithProjection,
        yScale: (v: number) => yScale(v) ?? 0,
        innerWidth: innerW,
        strokeVisible: !isLoading,
        translateX: margin.left,
        translateY: margin.top,
      });
      if (gd) defs.push(gd);
    }
    return defs;
  }, [projectionConfigs, projectionLines, width, margin, heightPx, yDomainFinal, timeExtent, timeExtentRaw, projectionGradientBaseId, isLoading]);

  const profitLossGradientDefs = React.useMemo(() => {
    if (profitLossLines.length === 0 || width <= 0) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    if (innerW <= 0) return [];
    const configs = profitLossLines.map((raw) => normalizeProfitLossConfig(raw as unknown as Record<string, unknown>)).filter(Boolean) as ReturnType<typeof normalizeProfitLossConfig>[];
    const valid = configs.filter(Boolean) as NonNullable<typeof configs[number]>[];
    return resolveProfitLossGradientDefs(valid, innerW, projectionGradientBaseId);
  }, [profitLossLines, width, margin, projectionGradientBaseId]);

  // C3: app-owned <linearGradient> def feeding the native crosshair mark's
  // `stroke: url(#id)` vertical fade. Color-fallback expression ported
  // verbatim from internal/tooltip-chrome.ts's `buildIndicator` — a function
  // form of `tooltip.indicatorColor` falls back to the CSS var exactly like
  // the old imperative code (only a string form is honored inline). Rendered
  // unconditionally whenever the crosshair mark itself is enabled, even in
  // the dashed-stroke branch where the mark doesn't reference the gradient —
  // matching hover-chrome.ts's own always-build behavior for this def.
  const crosshairGradientDef = React.useMemo(() => {
    if (!(tooltipEnabled && (tooltip?.showCrosshair ?? true))) return null;
    const color = typeof tooltip?.indicatorColor === "string" ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipEnabled, tooltip, crosshairGradientId]);

  const overlayRendered = (lineTerminalAnchors.length > 0 || lineEndAnchors.length > 0) && width > 0 && heightPx > 0;
  React.useLayoutEffect(() => {
    if (!overlayRendered) return;
    projectionPhasePortRef.current?.setPhase(phaseRef.current);
  }, [overlayRendered]);

  // C6: replaces the deleted plot-local `xScaleForSelection` duplicate d3
  // scale — resolves through the host's own live interaction/scene refs
  // (margin-inclusive scene coordinates), so it tracks the resolved chart
  // exactly instead of re-deriving a scale from timeExtent/innerWidth.
  const resolveScenePos = React.useCallback(
    (clientX: number, clientY: number) => interactionRef.current?.clientToScene(clientX, clientY) ?? null,
    [],
  );
  const invertSceneX = React.useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX) ?? null,
    [],
  );

  const { selection: chartSelection } = useChartSelection({
    enabled: true,
    innerWidth,
    marginLeft: margin.left,
    data: data as unknown as Array<Record<string, unknown>>,
    xDataKey,
    resolveScenePos,
    invertSceneX,
    containerRef,
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      clearFocusChrome();
    },
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
  });

  const segmentComponents = React.useMemo(() => extractSegmentComponents(children), [children]);
  const refAreaChildren = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  // D431: ReferenceArea axisLabelColor per-tick y-label color dropped —
  // native tickLabels have no per-tick fill channel (v0.15.0).

  // BrushHost + clipping: trackExtent is this host's own final xScale domain
  // (after projection merge when un-brushed; equals bklit's context xScale domain).
  // Clipping: with a narrowed xDomain, full-data paths map outside [0, innerWidth];
  // gate a clipPath over the plot rect when xDomain is set so they don't bleed into margins.
  const innerWidthForBrush = Math.max(0, width - margin.left - margin.right);
  const innerHeightForBrush = Math.max(0, heightPx - margin.top - margin.bottom);
  const brushClipId = useSanitizedId();
  const needsBrushClip = !!xDomain && innerWidthForBrush > 0 && innerHeightForBrush > 0;
  // C6: BrushHost for the portal chrome only now (mechanics moved into the
  // spec's `controls:` above) — trackExtent reuses the same brushTrackExtent
  // the native brushX's fallback range is built from.
  const brushHost = React.useMemo<BrushHost | null>(() => {
    if (!brushTrackExtent || innerWidthForBrush <= 0) return null;
    return { containerRef: containerRef as unknown as React.RefObject<HTMLElement | null>, margin, trackExtent: brushTrackExtent };
  }, [brushTrackExtent, innerWidthForBrush, margin]);
  // Pixel extent for the portal chrome, derived from the SAME controlled
  // BrushRange<Date> fed into the native brushX control — through the host's
  // independent trackExtent scale (NOT the chart's own rescaling xScale; see
  // the BrushHost comment in brush-chrome.tsx for why they must stay separate).
  const brushPixelExtent = React.useMemo(() => {
    if (!brushHost || !brushRangeValue) return null;
    return selectionToPixelExtent(brushRangeValue, brushHost.trackExtent, innerWidthForBrush);
  }, [brushHost, brushRangeValue, innerWidthForBrush]);

  return (
    <ChartSelectionContext.Provider value={chartSelection}>
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio, isolation: "isolate", ...style } as React.CSSProperties}
      data-bkm-chart="line"
      {...fadeEdgesMask}
    >
      {needsBrushClip ? (
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={brushClipId}>
              <rect x={margin.left} y={margin.top} width={innerWidthForBrush} height={innerHeightForBrush} />
            </clipPath>
          </defs>
        </svg>
      ) : null}
      {hasBrush && brushHost && brushPixelExtent ? (
        <BrushChrome
          host={brushHost}
          x0={brushPixelExtent.x0}
          x1={brushPixelExtent.x1}
          innerWidth={innerWidthForBrush}
          innerHeight={innerHeightForBrush}
          blurPx={brushConfig?.blurPx}
          fadeOuterEdges={brushConfig?.fadeOuterEdges}
          selectionPattern={brushConfig?.selectionPattern}
          selectedBoxStyle={brushConfig?.selectedBoxStyle}
        />
      ) : null}
      {isLoading && loadingLabel ? <LoadingLabel text={loadingLabel} /> : null}
      {background ? (
        <BackgroundLayer
          config={background}
          innerWidth={innerWidth}
          innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
          marginLeft={margin.left}
          marginTop={margin.top}
          isLoaded={isLoaded}
        />
      ) : null}
      {definition ? (
        <div style={needsBrushClip ? { clipPath: `url(#${brushClipId})` } : undefined}>
          <RendererChart
            renderer={chartMotionRenderer<ChartDatum, Date, number>()}
            ariaLabel={ariaLabel}
            ariaDescription={ariaDescription}
            aspectRatio={parseAspectRatio(aspectRatio)}
            height={heightPx > 0 ? heightPx : undefined}
            definition={definition}
            onFocusGroupChange={handleFocusChange}
            onRender={handleRender}
            renderTooltipBody={tooltipEnabled ? renderTooltipBody : undefined}
          />
        </div>
      ) : null}
      {definition && (
        <>
          {heightPx > 0 && (
            <ReferenceAreaLayers
              configs={refAreaChildren}
              geom={{
                width,
                height: heightPx,
                margin,
                yDomain: yDomainFinal,
                yDomainsByAxis: nicedDomainsByAxis,
                xDomain: timeExtent ? ([new Date(timeExtent.minTime), new Date(timeExtent.maxTime)] as unknown as [Date, Date]) : undefined,
                isTimeScale: true,
                phase: chartPhase,
                isLoaded,
              }}
            />
          )}
          <SegmentOverlay
            selection={chartSelection}
            innerWidth={innerWidth}
            innerHeight={heightPx - margin.top - margin.bottom}
            marginLeft={margin.left}
            marginTop={margin.top}
            components={segmentComponents}
          />
          {projectionGradientDefs.length > 0 ? (
            <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
              <defs>
                {projectionGradientDefs.map((g) => (
                  <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse" x1={g.startX} y1={g.startY} x2={g.endX} y2={g.endY}>
                    <stop offset="0%" stopColor={g.gradientStart} />
                    <stop offset="100%" stopColor={g.gradientEnd} />
                  </linearGradient>
                ))}
              </defs>
            </svg>
          ) : null}
          {profitLossGradientDefs.length > 0 ? (
            <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
              <defs>
                {profitLossGradientDefs.map((g) => (
                  <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse" x1={0} x2={g.endX} y1={0} y2={0}>
                    {g.stops.map((s) => (
                      <stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
                    ))}
                  </linearGradient>
                ))}
              </defs>
            </svg>
          ) : null}
          {crosshairGradientDef ? (
            <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id={crosshairGradientDef.id} gradientUnits="objectBoundingBox" x1="0%" y1="0%" x2="0%" y2="100%">
                  {crosshairGradientDef.stops.map((s) => (
                    <stop key={s.offset} offset={s.offset} stopColor={crosshairGradientDef.color} stopOpacity={s.opacity} />
                  ))}
                </linearGradient>
              </defs>
            </svg>
          ) : null}
          {overlayRendered ? (
            <ProjectionMarkerOverlay
              width={width}
              height={heightPx}
              margin={margin}
              terminalMarkers={lineTerminalAnchors}
              projectionEndMarkers={lineEndAnchors}
              phasePort={projectionPhasePortRef}
            />
          ) : null}
          {tooltipEnabled ? (
            <div
              ref={datePill.overlayHostRef}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            />
          ) : null}
          {markerGradientDefs.length > 0 ? (
            <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
              <defs>
                {markerGradientDefs.map((g) => (
                  <radialGradient key={g.id} id={g.id}>
                    <stop offset="0%" stopColor={g.fill} stopOpacity={1} />
                    <stop offset={`${g.fillFadeStart}%`} stopColor={g.fill} stopOpacity={1} />
                    <stop offset={`${g.fillFadeEnd}%`} stopColor={g.fill} stopOpacity={0} />
                    <stop offset={`${g.gapFadeStart}%`} stopColor={g.stroke} stopOpacity={0} />
                    <stop offset={`${g.gapFadeEnd}%`} stopColor={g.stroke} stopOpacity={1} />
                    <stop offset="100%" stopColor={g.stroke} stopOpacity={1} />
                  </radialGradient>
                ))}
              </defs>
            </svg>
          ) : null}
          <DashTailOverlay
            containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
            width={width}
            height={heightPx}
            margin={margin}
            renderData={renderData as unknown as Record<string, unknown>[]}
            xDataKey={xDataKey}
            series={lines.map((l) => ({
              dataKey: l.dataKey,
              stroke: l.stroke ?? "var(--chart-line-primary)",
              strokeWidth: l.strokeWidth ?? 2.5,
              dashFromIndex: l.dashFromIndex,
              dashArray: l.dashArray,
            }))}
            innerWidth={innerWidth}
            innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
          />
          {chartMarkers ? (
            <MarkerActiveTooltipProvider store={markerActiveStore}>
            <ChartMarkersOverlay
              items={chartMarkers.items}
              size={chartMarkers.size}
              showLines={chartMarkers.showLines}
              animate={chartMarkers.animate}
              maxFanned={chartMarkers.maxFanned}
              xScale={(d: Date) => {
                // xScaleD3Ref's range is [margin.left, margin.left + innerWidth]
                // (chart.x = margin.left is baked directly into the host
                // chart's scale, mirroring how it draws its own marks with no
                // extra translate group) — i.e. it returns ABSOLUTE
                // margin-inclusive coordinates. ChartMarkersOverlay's
                // contract expects an INNER-relative (0..innerWidth) scale
                // and adds marginLeft itself (matching bklit's
                // `portalX = x + marginLeft`), so subtract margin.left back
                // out here to avoid double-counting it (confirmed live: the
                // uncorrected offset landed markers ~margin.left px right of
                // bklit's).
                const s = xScaleD3Ref.current;
                if (!s) return null;
                const v = s(d);
                return v == null ? null : v - margin.left;
              }}
              marginLeft={margin.left}
              marginTop={margin.top}
              innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
              containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
              animationDuration={animationDuration}
              onMarkerHoverChange={(markers) => {
                // LM6 legacy interplay (chart-markers.tsx handleMarkerHover):
                // hovering a marker group hides the crosshair/tooltip chrome
                // (legacy called setTooltipData(null)) AND drops isActive
                // (guide lines return to rest opacity); leaving leaves both
                // cleared until the next chart hover, like legacy.
                if (markers) {
                  clearFocusChrome();
                }
              }}
            />
            </MarkerActiveTooltipProvider>
          ) : null}
        </>
      )}
      {!definition && isLoading && width > 0 && (
            <svg
              width={width}
              height={heightPx}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
              aria-hidden="true"
            >
              <g transform={`translate(${margin.left},${margin.top})`}>
                {(() => {
                  const innerW = Math.max(0, width - margin.left - margin.right);
                  const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
                  if (innerW <= 0 || innerH <= 0) return null;
                  const yScale = d3ScaleLinear().domain(yDomainFinal).range([innerH, 0]);
                  const linePts = (() => {
                    if (lines.length === 0) return "";
                    const pts: { x: number; y: number }[] = [];
                    const n = 7;
                    for (let i = 0; i < n; i++) {
                      const x = (i / (n - 1)) * innerW;
                      const v = 110 + Math.sin(i * 1.15) * 36 + i * 9;
                      pts.push({ x, y: yScale(v) ?? innerH / 2 });
                    }
                    if (pts.length < 2) return "";
                    let d = `M${pts[0]!.x},${pts[0]!.y}`;
                    for (let i = 1; i < pts.length; i++) d += ` L${pts[i]!.x},${pts[i]!.y}`;
                    return d;
                  })();
                  if (!linePts) return null;
                  return (
                    // P5.7 L9 — `loadingStroke`/`loadingStrokeOpacity` were typed
                    // on `LineConfig` (`internal/types.ts:54,56`) and consumed by
                    // nothing. Ruling was "forward to LineLoadingPulse or drop from
                    // type"; forwarded, because the seam already existed —
                    // `LineLoadingPulse` has taken `stroke`/`strokeOpacity` props
                    // since it was ported (`internal/loading-chrome.tsx:29,30`) and
                    // only this call site declined to pass them. Reading them off
                    // `lines[0]` matches how `strokeWidth` is already resolved here
                    // and how bklit drives the pulse from the primary series.
                    // Undefined falls through to the component's own defaults
                    // (`var(--foreground)` / 0.5), so unset props are a no-op.
                    <LineLoadingPulse
                      pathD={linePts}
                      width={innerW}
                      height={innerH}
                      stroke={lines[0]?.loadingStroke}
                      strokeOpacity={lines[0]?.loadingStrokeOpacity}
                      strokeWidth={lines[0]?.strokeWidth ?? 2.5}
                      mode={pulseMode ?? "loop"}
                    />
                  );
                })()}
              </g>
            </svg>
          )}
    </div>
    </ChartSelectionContext.Provider>
  );
}

// Legacy parity: bklit `line-chart.tsx` ships `export default LineChart;` (T-E2).
export default LineChart;
