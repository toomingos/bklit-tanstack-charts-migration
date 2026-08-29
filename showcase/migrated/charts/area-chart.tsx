// Migrated bklit-ui AreaChart — same public API, rendered by TanStack
// Charts. Minimal diff on line-chart.tsx (docs/LOG.md D10/area task):
//   - Two marks per series: `areaFill` (custom fill mark, id `${dataKey}__fill`)
//     under a `lineY` (boundary stroke, id `dataKey` — SAME id convention as
//     <Line>, so the native crosshair/hover-dot/highlight-band marks in
//     internal/hover-geometry.ts work unchanged) on top, per "Layering area
//     and line" (TanStack docs).
//   - Per-series vertical gradient (fill fading to transparent, bklit's
//     area-gradient-defs.tsx defaults) rendered in a 0x0 sibling <svg>
//     AFTER <Chart> — same url()-resolves-document-wide technique as
//     scatter-chart.tsx's marker gradients.
//   - areaY's own `fillOpacity` is always 1: bklit never double-applies
//     fillOpacity on both the shape and the gradient — all of it lives in
//     the gradient stops (area.tsx: `<AreaClosed fill={areaFill} .../>`
//     with NO fillOpacity prop at all).
//   - Area's own bklit defaults differ from Line's: curveMonotoneX (not
//     curveNatural), fadeEdges default false (not true), strokeWidth
//     default 2 (not 2.5).
//   - Hover dim is 0.6 (not Line's 0.3) — area.tsx hardcodes
//     `<SeriesHoverDim dimOpacity={0.6} .../>`; ported to `AREA_DIM_OPACITY`
//     below, applied via both native mark `states` (lineY) and a reactive
//     `fillOpacity` term (areaFill — see its header for why it can't use
//     `states`).
//   - No path-morph on data update (bklit Area has no useAnimatedSeriesPath
//     equivalent) — same as migrated Line, the shared shell's y-domain
//     tween is the only data-update animation either chart has (I8).
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveMonotoneX } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { Chart } from "@tanstack/react-charts/tooltip";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { d3Curve, defineChart, lineY } from "@tanstack/charts";
import { tooltip as nativeTooltip } from "@tanstack/charts/tooltip";
import type {
  ChartInteractionController,
  ChartMark,
  ChartPoint,
  ChartRenderContext,
  StaticChartDefinition,
} from "@tanstack/charts";
import { areaFill } from "./internal/area-fill-mark";
import { patternAreaMark } from "./internal/pattern-area-mark";
import { renderPatternPreset } from "./internal/pattern-preset";
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
  extractReferenceAreaConfigs,
  extractReferenceAreaProps,
} from "./internal/reference-area-config";
import { createTickColorResolver } from "./internal/reference-area-geometry";
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
import { toDate } from "./internal/coerce-date";
import { timeToPixelX } from "./internal/x-time-scale";
import {
  BOX_OFFSET,
  DISCRETE_INTERACTION_THRESHOLD,
  SERIES_MARKER_ENTER_MS,
  TOOLTIP_BOX_SPRING,
} from "./internal/design-tokens";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { TooltipContent } from "./internal/tooltip-components";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import { YAxisOverlay } from "./internal/y-axis-overlay";
import type { ChartDatum, ChartStatus, TooltipRow } from "./internal/types";
import { type ChartPhase, DEFAULT_Y_DOMAIN_TWEEN_MS, isChartInteractionPhase } from "./internal/chart-phase";
import type { ChartScale } from "@tanstack/charts";
import { useChartConfig } from "./internal/chart-config-context";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import { resolveGridGuide } from "./internal/grid";
import { resolveFadeEdgesMask } from "./internal/fade-mask";
import { LoadingLabel, buildLoadingSkeletonRows } from "./internal/loading-chrome";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { useChartMargin, DEFAULT_CHART_MARGIN, useMeasuredRect, type ChartMargin } from "./internal";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { DEFAULT_Y_AXIS_ID } from "./internal/y-axis-id";
import {
  createAxisValueProjector,
  createNicedYScale,
  domainForAxis,
  resolveTimeSeriesYDomain,
  resolveYDomainsByAxis,
  useNicedYDomainChanged,
} from "./internal/y-domain";
import { useChartPhaseOrchestrator } from "./internal/use-chart-phase-orchestrator";
import { filterDataByXDomain, createXAccessor } from "./internal/brush-selection";
import { BrushHostContext } from "./internal/brush-drag";
import { DashTailOverlay, resolveDashTailBounds } from "./internal/dash-tail";
import { buildMarkerGradientDefs, buildMarkerMarks } from "./internal/series-marker-mark";
import { ChartMarkersOverlay } from "./internal/chart-markers";
import { createActiveMarkersStore, MarkerActiveTooltipProvider } from "./internal/marker-tooltip";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import { isRevealed, markRevealed } from "./internal/deferred-reveal";
import { clipRevealTiming, type EnterTransition } from "./internal/enter-transition";
import "./styles.css";
// Area's own hover dim (area.tsx hardcodes dimOpacity={0.6}; Line uses 0.3).
const AREA_DIM_OPACITY = 0.6;

export interface AreaChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  status?: ChartStatus;
  animationDuration?: number;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  loadingLabel?: string;
  children?: React.ReactNode;
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
  /** P5.5 (charter gap, D329) — bklit `area-chart.tsx:41`. Same contract as
      LineChart's: overrides the clip-reveal timing, spring coerced to tween. */
  enterTransition?: EnterTransition;
  /** P5.5 (charter gap, D329) — bklit `area-chart.tsx:43`. Replay epoch input;
      forwarded to the orchestrator, which already keys its reveal on it. */
  revealSignature?: string;
}

interface ResolvedArea {
  dataKey: string;
  /** P6.1 (L10): carried through so `resolvedAreas` can be the series list the
      per-axis domain resolver groups on — undefined means the default axis. */
  yAxisId?: string | number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillOpacity: number;
  curve: CurveFactory;
  showLine: boolean;
  gradientToOpacity: number;
  gradientSpan: number;
  fadeEdges: boolean | "left" | "right";
  showHighlight: boolean;
  dashFromIndex?: number;
  dashArray?: string;
  showMarkers?: boolean;
  markers?: import("./internal/types").SeriesPointMarkerStyle;
}

export function AreaChart({
  data,
  xDataKey = "date",
  status = "ready",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  loadingLabel,
  children,
  style,
  animationEasing = DEFAULT_ANIMATION_EASING,
  yDomainTween = true,
  yDomainTweenDuration: _yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain,
  xDomainSlotCount: _xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  enterTransition,
  revealSignature = "",
}: AreaChartProps) {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { width, height: measuredHeight } = useMeasuredRect(containerRef);
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

  // Clip-reveal timing, bklit `animation.ts:18` semantics. Primitive deps:
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

  const { areas, patternAreas, grid, xAxis, yAxis, background, tooltip, projectionLines, projectionEndMarkers, terminalMarkers, chartMarkers, brushes } = React.useMemo(
    () => extractChildren(children),
    [children],
  );
  // C3: moved up from below the `definition` memo — the native crosshair/
  // hover-dot/highlight-band marks built inside that memo need this flag.
  const tooltipEnabled = tooltip?.enabled ?? false;
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const prefersReducedMotion = usePrefersReducedMotion();
  // C1 (P6): legend hover -> native mark states via programmatic focus
  // injection (replaces the old hover-chrome DOM-mutation dim path).
  const { captureRenderContext, focusSeries, clearFocus } = useFocusInjection();
  React.useEffect(() => {
    const seriesKey = legendHoveredIndex != null ? (areas[legendHoveredIndex]?.dataKey ?? null) : null;
    if (seriesKey != null) focusSeries(seriesKey);
    else clearFocus();
  }, [legendHoveredIndex, areas, focusSeries, clearFocus]);
  const staticRefConfigs = React.useMemo(() => extractReferenceAreaConfigs(children), [children]);
  const projectionConfigs = React.useMemo(() => extractProjectionLineConfigs(children), [children]);
  const projectionGradientBaseId = useSanitizedId();

  // bklit area.tsx / extractAreaConfigs resolved defaults:
  //  - fill default "var(--chart-line-primary)"
  //  - stroke default `stroke ?? fill ?? "var(--chart-line-primary)"`
  //    (extractAreaConfigs's own fallback chain over the RAW props, which
  //    lands on the identical value as Area's internal `resolvedStroke`
  //    whenever `fill` is left at its own default — verified by reading
  //    both call sites in repos/bklit-ui/packages/ui/src/charts/area.tsx
  //    and area-chart.tsx)
  //  - strokeWidth default 2 (area.tsx — Line's bklit default is 2.5)
  //  - fillOpacity default 0.4 (area.tsx)
  //  - curve default curveMonotoneX (area.tsx — Line's default is
  //    curveNatural; the registry demo/bench scenario overrides this
  //    explicitly with curveNatural on both charts)
  //  - fadeEdges default false (area.tsx — Line's default is true)
  //  - showHighlight default true (area.tsx)
  const resolvedAreas = React.useMemo<ResolvedArea[]>(
    () =>
      areas.map((a) => {
        const fill = a.fill ?? "var(--chart-line-primary)";
        return {
          dataKey: a.dataKey,
          yAxisId: a.yAxisId,
          fill,
          stroke: a.stroke ?? fill,
          strokeWidth: a.strokeWidth ?? 2,
          fillOpacity: a.fillOpacity ?? 0.4,
          curve: a.curve ?? curveMonotoneX,
          showLine: a.showLine ?? true,
          gradientToOpacity: a.gradientToOpacity ?? 0,
          gradientSpan: a.gradientSpan ?? 1,
          fadeEdges: a.fadeEdges ?? false,
          showHighlight: a.showHighlight ?? true,
          dashFromIndex: (a as { dashFromIndex?: number }).dashFromIndex,
          dashArray: (a as { dashArray?: string }).dashArray,
          showMarkers: a.showMarkers,
          markers: a.markers,
        };
      }),
    [areas],
  );

  interface ResolvedPatternArea {
    dataKey: string;
    fill?: string;
    patternPreset?: import("./internal/pattern-preset").PatternPresetId;
    patternColor?: string;
    curve: CurveFactory;
  }
  const resolvedPatternAreas = React.useMemo<ResolvedPatternArea[]>(
    () =>
      patternAreas.map((p) => ({
        dataKey: p.dataKey,
        fill: p.fill,
        patternPreset: p.patternPreset,
        patternColor: p.patternColor,
        curve: p.curve ?? curveMonotoneX,
      })),
    [patternAreas],
  );
  const patternBaseId = useSanitizedId();
  const patternDefs = React.useMemo(() => {
    const out: Array<{
      dataKey: string;
      id: string;
      preset: import("./internal/pattern-preset").PatternPresetId;
      color?: string;
      node: React.ReactNode;
    }> = [];
    for (let i = 0; i < resolvedPatternAreas.length; i++) {
      const pa = resolvedPatternAreas[i]!;
      if (pa.fill != null) continue;
      const preset = pa.patternPreset ?? "diagonal";
      if (preset === "none") continue;
      const id = `${patternBaseId}-pattern-area-${i}`;
      const node = renderPatternPreset(preset, `${id}-base`, { color: pa.patternColor });
      if (!node) continue;
      out.push({ dataKey: pa.dataKey, id, preset, color: pa.patternColor, node });
    }
    return out;
  }, [resolvedPatternAreas, patternBaseId]);
  const patternIdByKey = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const d of patternDefs) m.set(d.dataKey, d.id);
    return m;
  }, [patternDefs]);

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const renderData = React.useMemo(() => {
    if (innerWidth <= 0) return data;
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      [...resolvedAreas.map((a) => a.dataKey), ...resolvedPatternAreas.map((p) => p.dataKey)],
    );
  }, [data, innerWidth, resolvedAreas, resolvedPatternAreas]);
  // C3: bklit's `pointCount > DISCRETE_INTERACTION_THRESHOLD` gate, reused by
  // the native crosshair/hover-dot/highlight-band marks below (snap instead
  // of spring on dense data).
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
  // C3: replaces hover-chrome's imperative `highlightXSpring`/
  // `highlightWidthSpring` clip-rect sweep — the reactive index driving the
  // native highlight-band marks below.
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  // C3: app-owned <linearGradient> def id for the native crosshair mark's
  // vertical fade — same useSanitizedId()/rendered-<defs> mechanism as the
  // projection/marker gradient defs.
  const crosshairGradientId = useSanitizedId();

  const areaMarkerBaseId = useSanitizedId();
  const areaMarkerConfigs = React.useMemo(() => resolvedAreas.map((a) => ({ dataKey: a.dataKey, stroke: a.stroke, showMarkers: a.showMarkers, markers: a.markers })), [resolvedAreas]);
  const areaMarkerGradientDefs = React.useMemo(() => buildMarkerGradientDefs(areaMarkerConfigs, areaMarkerBaseId), [areaMarkerConfigs, areaMarkerBaseId]);
  const areaMarkerGradientIdByKey = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const g of areaMarkerGradientDefs) m.set(g.dataKey, g.id);
    return m;
  }, [areaMarkerGradientDefs]);

  // bklit shell:265-277 visibleData; shell:341 yDomain on visible slice; shell:303-306 marks stay on full data (domain-clamp).
  const xAccessorForBrush = React.useMemo(() => createXAccessor(xDataKey), [xDataKey]);
  const visibleData = React.useMemo(() => {
    if (!xDomain) return data as unknown as Record<string, unknown>[];
    return filterDataByXDomain(data as unknown as Record<string, unknown>[], xDomain, xAccessorForBrush) as unknown as ChartDatum[];
  }, [data, xDomain, xAccessorForBrush]);

  // bklit y-domain parity — exact port of time-series-chart-shell.tsx
  // `resolveTimeSeriesYDomain` + `niceYDomain` (d3 .nice() applied by the
  // configured scale below): all-values>=0 -> [0, max*1.1]; mixed-sign ->
  // [min,max] padded 5% each side; empty -> [0,100]. Shared via
  // internal/y-domain.ts with line-chart.tsx and composed-chart.tsx (same
  // shell), scoped to `resolvedAreas` dataKeys.
  // shell:341 — yDomainTarget uses visibleData when brushing (marks stay on full data).
  // P5.7 Strand 5 — same loading-state y-domain divergence fixed in
  // `line-chart.tsx` (see the long note there): bklit derives the loading
  // gridlines from a skeleton series, migrated derived them from the caller's
  // real rows in every phase. Area shares the shell, so it shares the defect.
  const skeletonRows = React.useMemo(
    () => buildLoadingSkeletonRows(data.length, resolvedAreas[0]?.dataKey ?? "value"),
    [data.length, resolvedAreas],
  );
  // P6.1 / T-F1 (L10) — one domain per `yAxisId` group instead of one for the
  // whole chart. `resolvedAreas` is the series list either way, and for a chart
  // where every area sits on the default axis (every area chart in the codebase
  // today) this returns `{ left: <exactly the old tuple> }`, so `yDomain` below
  // is byte-identical and nothing downstream moves.
  const yDomainSource = React.useMemo(
    () => (status === "loading" ? skeletonRows : visibleData) as unknown as ChartDatum[],
    [status, skeletonRows, visibleData],
  );
  const yDomainsByAxis = React.useMemo(
    () =>
      resolveYDomainsByAxis({
        series: resolvedAreas,
        resolveDomain: (axisAreas) => resolveTimeSeriesYDomain(yDomainSource, axisAreas),
      }),
    [yDomainSource, resolvedAreas],
  );
  const yDomain = React.useMemo(
    () => domainForAxis(yDomainsByAxis, DEFAULT_Y_AXIS_ID),
    [yDomainsByAxis],
  );

  // bklit data-update behavior (chart-phase.ts): new data paints IMMEDIATELY;
  // only a y-DOMAIN change tweens (500ms scale tween). bklit's Area has no
  // path-morph equivalent to a hypothetical `useAnimatedSeriesPath` (it
  // never had one — that's Line-specific machinery bklit doesn't ship for
  // Area either), so this is exactly Line's existing conditional: animate
  // the scene only when the final domain actually moved, otherwise snap.
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

  // Secondary axes are expressed by reprojecting values into the primary
  // domain — TanStack's spec carries exactly one `y` scale (see
  // `createAxisValueProjector`). Each per-axis domain is niced the same way the
  // primary one is, so a series on `"right"` gets the same tick-friendly extent
  // it would have had as the only series on the chart.
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
  const yDomainChanged =
    projectionConfigs.length === 0
      ? nicedYDomainChanged
      : prevYDomainFinalRef.current[0] !== yDomainFinal[0] ||
        prevYDomainFinalRef.current[1] !== yDomainFinal[1];
  prevYDomainFinalRef.current = yDomainFinal;

  // Per-series vertical gradient defs — verbatim port of bklit
  // area-gradient-defs.tsx's stop-list math: top stop at `fillOpacity`, mid
  // stop at offset `gradientSpan*100%` fading to `gradientToOpacity`, plus a
  // trailing 100%-stop at `gradientToOpacity` ONLY when span < 1 (span=1
  // collapses to exactly the historic two stops). span clamps to
  // [0.01, 1] (AreaGradientDefs' `Math.min(1, Math.max(0.01, ...))`).
  // Emitted natively via `spec.gradients` (T-D5): TanStack's SVG renderer
  // writes these into `<defs data-ts-key="gradients">` inside the chart svg
  // and rewrites matching `fill="url(#id)"` mark refs itself.
  const gradientBaseId = useSanitizedId();
  const gradientDefs = React.useMemo(
    () =>
      resolvedAreas.map((area, i) => ({
        dataKey: area.dataKey,
        id: `${gradientBaseId}-area-grad-${i}`,
        fill: area.fill,
        fillOpacity: area.fillOpacity,
        gradientToOpacity: area.gradientToOpacity ?? 0,
        spanPct: Math.min(1, Math.max(0.01, area.gradientSpan ?? 1)) * 100,
      })),
    [gradientBaseId, resolvedAreas],
  );
  const nativeAreaGradients = React.useMemo(
    () =>
      gradientDefs.map((g) => ({
        id: g.id,
        // objectBoundingBox fractions — serialized as x1="0%" y1="0%"
        // x2="0%" y2="100%", byte-identical to the retired JSX attrs.
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 1,
        stops: [
          { offset: 0, color: g.fill, opacity: g.fillOpacity },
          { offset: g.spanPct / 100, color: g.fill, opacity: g.gradientToOpacity },
          ...(g.spanPct < 100
            ? [{ offset: 1, color: g.fill, opacity: g.gradientToOpacity }]
            : []),
        ],
      })),
    [gradientDefs],
  );
  const gradientIdBySeries = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const g of gradientDefs) map.set(g.dataKey, g.id);
    return map;
  }, [gradientDefs]);

  // bklit sizes the chart from the measured container box in BOTH modes —
  // see line-chart.tsx: width/aspectRatio is only the pre-measure fallback.
  const heightPx = width > 0 ? (measuredHeight > 0.5 ? measuredHeight : width / parseAspectRatio(aspectRatio)) : 0;
  // bklit shell:285-301 + shell:291-295 — when xDomain is set, the brushed extent IS xDomain (no projection merge).
  const timeExtentRaw = React.useMemo(() => {
    if (xDomain) return { minTime: xDomain[0].getTime(), maxTime: xDomain[1].getTime() } as const;
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const d of renderData) {
      const v = d[xDataKey];
      if (v instanceof Date) { const t = v.getTime(); if (t < minTime) minTime = t; if (t > maxTime) maxTime = t; }
    }
    if (!Number.isFinite(minTime)) return null;
    return { minTime, maxTime } as const;
  }, [renderData, xDataKey, xDomain]);
  // Rendered x-domain: data extent extended by the projection tail so every
  // consumer (spec scale, selection scale, reference areas, x-axis overlay)
  // matches the rendered mapping. When xDomain is set, no projection merge.
  const timeExtent = React.useMemo(() => {
    if (!timeExtentRaw) return null;
    if (xDomain) return timeExtentRaw;
    if (projectionConfigs.length === 0) return timeExtentRaw;
    return { minTime: timeExtentRaw.minTime, maxTime: mergeProjectionXDomainMax(timeExtentRaw.maxTime, projectionConfigs) } as const;
  }, [timeExtentRaw, projectionConfigs, xDomain]);

  const isLoading = status === "loading";

  // bklit area.tsx fadeEdges → edge-fade mask (styles.css), resolved via the
  // shared fade-mask module (single source, same as line-chart.tsx). Defaults
  // are applied per-series first (`?? false` — Area's own default), then the
  // helper computes the aggregate + directional attributes: both-edge mask
  // when ANY series is non-false, left/right attributes when any series
  // requests that side (the CSS :not() rules pick left-only/right-only/both).
  const fadeEdgesMask = resolveFadeEdgesMask(resolvedAreas.map((a) => a.fadeEdges));

  const areaTerminalAnchors = React.useMemo(() => {
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
      out.push({ dataKey, cx, cy, fill: (tm["fill"] as string | undefined) ?? "transparent", stroke: (tm["stroke"] as string | undefined) ?? "var(--chart-1)", radius: (tm["radius"] as number | undefined) ?? 5, ringGap: (tm["ringGap"] as number | undefined) ?? 0, strokeWidth: (tm["strokeWidth"] as number | undefined) ?? 1.5, outlineWidth: (tm["outlineWidth"] as number | undefined) ?? 0, outlineColor: tm["outlineColor"] as string | undefined });
    }
    return out;
  }, [terminalMarkers, renderData, width, heightPx, margin, yDomainFinal, timeExtent, timeExtentRaw, xDataKey]);
  const areaEndAnchors = React.useMemo(() => {
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
  const projectionGradientDefsArea = React.useMemo(() => {
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

  // C3: app-owned <linearGradient> def feeding the native crosshair mark's
  // `stroke: url(#id)` vertical fade — see line-chart.tsx for the full
  // color-fallback rationale (ported verbatim from
  // internal/tooltip-chrome.ts's `buildIndicator`).
  const crosshairGradientDef = React.useMemo(() => {
    if (!(tooltipEnabled && (tooltip?.showCrosshair ?? true))) return null;
    const color = typeof tooltip?.indicatorColor === "string" ? tooltip.indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipEnabled, tooltip, crosshairGradientId]);

  const definition = React.useMemo(() => {
    if (width <= 0) return null;
    if (isLoading) {
      const gridGuide = resolveGridGuide(grid);
      const emptySpec = {
        marks: [] as unknown as ChartMark<ChartDatum, Date, number>[],
        scales: {
          x: { scale: scaleUtc as unknown as ChartScale, grid: gridGuide.vertical, axis: { ticks: { count: gridGuide.columnTicks } } },
          y: {
            scale: scaleLinear().domain(yDomainFinal) as unknown as ChartScale,
            grid: gridGuide.horizontal,
            axis: { ticks: { count: gridGuide.ticks } },
          },
        },
        margin,
        focus: "group-x" as const,
        // bklit has no native focus ring — its hover dot is the springed TooltipDot.
        focusRing: false,
        maxFocusDistance: Number.POSITIVE_INFINITY,
        svgAnimation: false as const,
      } as const;
      const base = defineChart(emptySpec as never);
      return base as unknown as StaticChartDefinition<ChartDatum, Date, number, "dom">;
    }
    // Typed accessors (ChartDatum values are `unknown`, so bare key strings
    // don't satisfy TanStack's ChannelAccessor value types); the explicit
    // element type keeps defineChart's D/X/Y inference concrete.
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
    for (const pa of resolvedPatternAreas) {
      const curve = d3Curve(pa.curve);
      const fill = pa.fill ?? (patternIdByKey.get(pa.dataKey) ? `url(#${patternIdByKey.get(pa.dataKey)!})` : "var(--chart-1)");
      marks.push(
        patternAreaMark(renderData, {
          id: `pattern-area-${pa.dataKey}`,
          x: (d: ChartDatum) => d[xDataKey] as Date,
          y: (d: ChartDatum) => d[pa.dataKey] as number,
          curve,
          fill,
        }),
      );
    }
    // C1 (P6): legend-hover fill dim — areaFill emits no ChartPoints, so mark
    // states can't reach it; the dim arrives reactively via fillOpacity here.
    // C3: pointer-hover dim (hover-chrome.ts DIM_OPACITY, parameterized to
    // Area's 0.6) rides the SAME reactive fillOpacity term for the same
    // reason — areaFill has no ChartPoints for native `states` to match
    // either. Unlike the legend term (which dims every OTHER series and
    // spares the highlighted one), pointer-hover dims EVERY series
    // uniformly the instant any point is focused (matching the boundary
    // lineY's own `pointerHoverDimState` below and bklit's SeriesHoverDim,
    // which dims all series alike and relies on the highlight band to
    // restore the near slice) — so it does not gate on `area.dataKey`.
    const legendHoveredKey =
      legendHoveredIndex != null ? (areas[legendHoveredIndex]?.dataKey ?? null) : null;
    const pointerHoverDimmed = tooltipEnabled && hoveredIndex != null;
    for (const area of resolvedAreas) {
      const gradientId = gradientIdBySeries.get(area.dataKey);
      const curve = d3Curve(area.curve);
      // P6.1 (L10): identity unless this series names a non-primary axis. Both
      // the fill and the boundary line take it, or the two would disagree.
      const projectY = projectorFor(area.yAxisId);
      // Fill FIRST, lineY SECOND ("Layering area and line" — TanStack docs:
      // area marks never draw their own boundary stroke; composing a lineY
      // on top is the documented pattern). `areaFill` is a minimal custom
      // mark replacing `areaY`: identical pixels and DOM contract, but no
      // per-datum ChartPoints / retained polygon arrays — areaY's duplicate
      // focus geometry put heap 19% over bklit at n=1000, failing G4 (the
      // boundary lineY below already supplies this series' focus points).
      // fillOpacity 1 at rest — bklit never double-applies it (the opacity
      // lives in the gradient stops above); 0.6 is the legend-dim term
      // (SeriesHoverDim, matching the boundary lineY's state below).
      marks.push(
        areaFill(renderData, {
          id: `${area.dataKey}__fill`,
          x: (d: ChartDatum) => d[xDataKey] as Date,
          y: (d: ChartDatum) => projectY(d[area.dataKey] as number),
          curve,
          fill: gradientId ? `url(#${gradientId})` : area.fill,
          fillOpacity:
            pointerHoverDimmed || !(legendHoveredKey == null || legendHoveredKey === area.dataKey)
              ? AREA_DIM_OPACITY
              : 1,
        }),
      );
      // Same id as a migrated Line's boundary mark would use for this
      // dataKey — the native crosshair/hover-dot/highlight-band marks below
      // (and the tooltip's own point lookup) find this mark by `dataKey`
      // with no Area-specific branching.
      {
        const hasDashTail = resolveDashTailBounds(area.dashFromIndex, renderData.length);
        // A4: bklit keeps its measuring LinePath mounted when showLine=false
        // (only its stroke goes transparent), so this mark stays too — it
        // also carries the series' focus geometry for group-x hover.
        const boundaryVisible = area.showLine && !hasDashTail;
        marks.push(
          lineY(renderData, {
            id: area.dataKey,
            x: (d: ChartDatum) => d[xDataKey] as Date,
            y: (d: ChartDatum) => projectY(d[area.dataKey] as number),
            // Series identity for group-x focus: without z, every series' points
            // carry group=null and focusX dedupes the group down to one point,
            // so multi-series hover would only ever surface a single series.
            z: () => area.dataKey,
            curve,
            stroke: boundaryVisible ? area.stroke : "transparent",
            strokeOpacity: boundaryVisible ? undefined : 0,
            strokeWidth: area.strokeWidth,
            // C1 (P6): legend-hover series dim — bklit SeriesHoverDim's
            // legend term (area.tsx dims to 0.6, 400ms ease-in-out).
            // Programmatic-source-only so pointer hover never triggers this.
            // C3: pointer-hover dim (same 0.6, D425 — timing rides
            // `.ts-chart__line path` in styles.css, no `transition` field
            // here) sits alongside it as a second state entry.
            states: [
              {
                when: whenSeriesDimmed(),
                style: { opacity: AREA_DIM_OPACITY },
                transition: { type: "tween", duration: 400, easing: "ease-in-out" },
              },
              pointerHoverDimState<ChartDatum>(AREA_DIM_OPACITY),
            ],
          }),
        );
      }
      // showMarkers && showSeriesContent gate matches bklit area.tsx:337 (`showMarkers && showSeriesContent`).
      const showAreaSeriesContent = !isLoading;
      if (showAreaSeriesContent && areaMarkerConfigs.some((s) => s.showMarkers)) {
        marks.push(...buildMarkerMarks(renderData, xDataKey, areaMarkerConfigs, areaMarkerGradientIdByKey));
      }
    }
    // C3: native crosshair/hover-dot/highlight-band marks (replace
    // hover-chrome.ts's imperative indicator/dot/highlight-sweep overlays).
    // Same construction as line-chart.tsx; see internal/hover-geometry.ts
    // for the shared implementation and its `retarget`/`motion` reasoning.
    if (tooltipEnabled && (tooltip?.showCrosshair ?? true)) {
      marks.push(
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
    if (tooltipEnabled && (tooltip?.showDots ?? true)) {
      for (const area of resolvedAreas) {
        marks.push(
          buildHoverDotMark(
            renderData,
            xDataKey,
            { dataKey: area.dataKey, color: area.stroke },
            resolveHoverDotFill(area.stroke, tooltip?.dotColor),
            { size: tooltip?.dotSize, strokeWidth: tooltip?.dotStrokeWidth, discrete: isDiscrete },
          ),
        );
      }
    }
    if (tooltipEnabled) {
      marks.push(
        ...buildHighlightBandMarks(
          renderData,
          xDataKey,
          hoveredIndex,
          resolvedAreas.map((area) => ({
            dataKey: area.dataKey,
            color: area.stroke,
            strokeWidth: area.strokeWidth,
            showHighlight: area.showHighlight,
            // A4: bklit gates SeriesHighlightLayer on `showHighlight &&
            // showLine` — the dim state above stays on regardless; only the
            // band itself is suppressed when showLine is false.
            showLine: area.showLine,
            curve: d3Curve(area.curve),
          })),
          { discrete: isDiscrete },
        ),
      );
    }
    // Projection marks render inside the same marks group as the series
    // (clip-path reveal covers them; strokeVisible handles loading).
    if (projectionConfigs.length > 0) {
      const innerW = Math.max(0, width - margin.left - margin.right);
      const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
      const te = timeExtent;
      const teRaw = timeExtentRaw;
      if (innerW > 0 && innerH > 0 && te && teRaw) {
        const yScale = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
        const xScaleWithProjection = (value: Date) => timeToPixelX(value, teRaw.minTime, te.maxTime, innerW);
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
          if (mark) marks.push(mark);
        }
      }
    }
    // Single-object form: definition options live in the spec (the two-arg
    // overload only accepts an already-built definition, and infers D/X/Y
    // from phantom fields a raw spec object doesn't carry).
    const xScaleDef = (() => {
      if (projectionConfigs.length === 0) return { scale: scaleUtc, guide: false as const };
      const xScale: ChartScale = {
        id: "x",
        resolve(context) {
          const [r0, r1] = context.range;
          const te = timeExtent;
          if (!te) {
            const base = scaleUtc().domain([0, 0]).range([r0, r1]);
            return { id: (context as unknown as { id: string }).id, type: "time" as const, domain: base.domain(), map: (v: unknown) => { const m = (base as unknown as { (x: Date): number | undefined })(v as Date); return m === undefined ? Number.NaN : m; }, ticks: [], bandwidth: 0 };
          }
          const base = scaleUtc().domain([te.minTime, te.maxTime]).range([r0, r1]);
          const ticks = base.ticks(context.tickCount ?? 5);
          return { id: (context as unknown as { id: string }).id, type: "time" as const, domain: base.domain(), map: (v: unknown) => { const m = (base as unknown as { (x: Date): number | undefined })(v as Date); return m === undefined ? Number.NaN : m; }, ticks: ticks.map((value: Date) => ({ value, position: base(value) ?? Number.NaN, label: value.toISOString() })), bandwidth: 0 };
        },
      };
      return { scale: xScale, guide: false as const };
    })();
    const gridGuide = resolveGridGuide(grid);
    return defineChart({
      marks,
      // CH3/CH4: tick counts reach the guides only via `axis.ticks.count`
      // (charts-core resolveTickCount → context.tickCount); a bare `ticks:`
      // key on the spec is never read.
      scales: {
        x: {
          ...xScaleDef,
          grid: gridGuide.vertical,
          axis: { ticks: { count: gridGuide.columnTicks } },
        },
        y: {
          scale: scaleLinear().domain(yDomainFinal),
          grid: gridGuide.horizontal,
          axis: { ticks: { count: gridGuide.ticks } },
        },
      },
      margin,
      focus: "group-x",
      focusRing: false,
      // bklit's hover works anywhere over the plot; TanStack defaults to 48px.
      maxFocusDistance: Number.POSITIVE_INFINITY,
      gradients: nativeAreaGradients,
      // C2 (P6): native tooltip extension replaces the imperative box panel
      // (tooltip-chrome.ts's buildBox/applyBoxContent/positionBox). Area
      // drives it off the SAME native focus:"group-x" mechanism the
      // crosshair chrome already uses (line-chart.tsx parity).
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
      svgAnimation:
        isChartInteractionPhase(chartPhase) && isLoaded && yDomainChanged
          ? { duration: effectiveYDomainTweenDuration as number, easing: bezierEasing }
          : false,
    });
  }, [renderData, xDataKey, resolvedAreas, resolvedPatternAreas, patternIdByKey, gradientIdBySeries, grid, width, yDomainFinal, yDomainChanged, projectorFor, margin, isLoading, chartPhase, isLoaded, projectionConfigs, projectionLines, projectionGradientBaseId, heightPx, timeExtent, timeExtentRaw, effectiveYDomainTweenDuration, areaMarkerConfigs, areaMarkerGradientIdByKey, nativeAreaGradients, legendHoveredIndex, areas, tooltip, tooltipEnabled, crosshairGradientId, isDiscrete, hoveredIndex]);

  // C3: hover-chrome.ts's imperative overlays are gone — native crosshair/
  // hover-dot/highlight-band marks (built inside the `definition` memo
  // above) and the app-owned date-pill overlay (below) replace them.
  // `tooltipEnabled` was moved up above the `definition` memo (it gates
  // those marks too). Focus-point dedup: both the areaFill mark (no
  // ChartPoints — see internal/area-fill-mark.ts's header) and the lineY
  // boundary mark participate in focus, but only the boundary mark emits a
  // ChartPoint per datum, so `onFocusGroupChange` never sees a duplicate per
  // series — no explicit filtering needed.
  // C2 (P6): renders inside the native tooltip extension's unstyled
  // `.ts-chart-tooltip__body` portal target — see line-chart.tsx for the
  // full contract note. Rows default from `resolvedAreas`, honoring
  // `tooltip.rows`/`tooltip.content`.
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
        : resolvedAreas.map((area) => {
            const v = datum[area.dataKey];
            return {
              color: area.stroke || ctx.points.find((p) => p.markId === area.dataKey)?.color || "transparent",
              label: area.dataKey,
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
    [tooltip, xDataKey, resolvedAreas],
  );
  // C3: replaces hover-chrome.ts + use-hover-chrome.ts entirely. Mirrors
  // line-chart.tsx's own wiring (no profit/loss term — Area has none).
  const interactionRef = React.useRef<ChartInteractionController<ChartDatum, Date, number> | null>(null);
  const dragSelectionActiveRef = React.useRef(false);
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

  const clearFocusChrome = React.useCallback(() => {
    interactionRef.current?.setControlledFocus(null, { source: "pointer" });
    setHoveredIndex(null);
    markerActiveStore.setActiveDate(null);
    wasVisibleRef.current = false;
    datePill.hide();
    datePill.resetFade();
  }, [markerActiveStore, datePill]);

  const handleFocusChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      const rawPrimary = points[0];
      const outsideXDomain =
        xDomain != null && rawPrimary != null && isFocusOutsideXDomain(rawPrimary.datum, xDataKey, xDomain);
      const phaseGated = !(isChartInteractionPhase(chartPhase) && isLoaded);
      const suppressed = outsideXDomain || dragSelectionActiveRef.current || phaseGated;
      if (suppressed && points.length > 0) {
        interactionRef.current?.setControlledFocus(null, { source: "pointer" });
      }
      const primary = suppressed ? undefined : rawPrimary;

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
        datePill.applyFade(primary.x, label, xAxis?.tickerHalfWidth);
      } else {
        wasVisibleRef.current = false;
        datePill.hide();
        datePill.resetFade();
      }
    },
    [xDomain, xDataKey, chartPhase, isLoaded, markerActiveStore, tooltip, isDiscrete, datePill, xAxis],
  );

  const areaMarkerRevealAnimsRef = React.useRef<Animation[]>([]);
  const areaMarkerRevealCancelRef = React.useRef<(() => void) | null>(null);
  // Replay key (D311 shape). `marks.dataset.bkmRevealed` latches for the life of
  // the marks node; the epoch re-opens a window the flag has closed. See
  // line-chart.tsx for the full note.
  const revealedEpochRef = React.useRef<number | null>(null);
  const handleRender = React.useCallback((context: ChartRenderContext<ChartDatum, Date, number>) => {
    // Cast: `useFocusInjection`'s `captureRenderContext` is typed against the
    // library's generic (unknown-typed) `ChartRenderContext`, which — because
    // `interaction.setControlledFocus` is checked contravariantly under
    // strictFunctionTypes — is not structurally assignable from our
    // concretely-typed context. Both denote the same live object at runtime.
    captureRenderContext(context as unknown as Pick<ChartRenderContext, "scene" | "interaction">);
    // C3: own capture, separate from useFocusInjection's private ref — feeds
    // clearFocusChrome's `setControlledFocus(null, ...)` pointer-source clear.
    interactionRef.current = context.interaction;
    const marks = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marks) return;
    const epochUnseen = revealedEpochRef.current !== revealEpoch;
    const shouldAnimate = chartPhase === "revealing" && animationDuration > 0 && !prefersReducedMotion && (epochUnseen || !isRevealed(marks));
    if (!shouldAnimate) {
      markRevealed(marks);
      marks.style.clipPath = "";
      return;
    }
    markRevealed(marks);
    revealedEpochRef.current = revealEpoch;
    marks.animate(
      [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: revealDurationMs, easing: revealEasingCss },
    );
    if (!areaMarkerConfigs.some((s) => s.showMarkers)) return;
    const innerW = Math.max(0, width - margin.left - margin.right);
    // bklit series-markers.tsx:102 — the marker stagger spans the CLIP reveal.
    const durationSec = revealDurationMs / 1000;
    for (const anim of areaMarkerRevealAnimsRef.current) { try { anim.cancel(); } catch { /* already canceled */ } }
    areaMarkerRevealAnimsRef.current = [];
    areaMarkerRevealCancelRef.current?.();
    const doReveal = () => {
      for (const s of areaMarkerConfigs) {
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
          areaMarkerRevealAnimsRef.current.push(anim);
        }
      }
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      let raf1 = 0, raf2 = 0, tId: number | null = null;
      let cancelled = false;
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          tId = window.setTimeout(() => { if (!cancelled) doReveal(); }, 0);
        });
      });
      areaMarkerRevealCancelRef.current = () => {
        cancelled = true;
        if (raf1) cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
        if (tId !== null) window.clearTimeout(tId);
      };
    } else { doReveal(); }
  }, [animationDuration, animationEasing, revealDurationMs, revealEasingCss, revealEpoch, chartPhase, areaMarkerConfigs, width, margin.left, margin.right, prefersReducedMotion, captureRenderContext]);

  React.useEffect(() => {
    if (chartPhase !== "revealing") return;
    const marks = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marks) return;
    if (prefersReducedMotion || animationDuration <= 0) {
      marks.style.clipPath = "";
      markRevealed(marks);
    }
  }, [chartPhase, revealEpoch, animationDuration, prefersReducedMotion]);
  React.useEffect(() => () => {
    for (const a of areaMarkerRevealAnimsRef.current) { try { a.cancel(); } catch { /* already canceled */ } }
    areaMarkerRevealCancelRef.current?.();
  }, []);

  const overlayRenderedArea = (areaTerminalAnchors.length > 0 || areaEndAnchors.length > 0) && width > 0 && heightPx > 0;
  React.useLayoutEffect(() => {
    if (!overlayRenderedArea) return;
    projectionPhasePortRef.current?.setPhase(phaseRef.current);
  }, [overlayRenderedArea]);

  const innerWidthArea = Math.max(0, width - margin.left - margin.right);
  const areaXScaleD3Ref = React.useRef<ReturnType<typeof scaleUtc> | null>(null);
  React.useEffect(() => {
    if (!timeExtent) { areaXScaleD3Ref.current = null; return; }
    areaXScaleD3Ref.current = scaleUtc().domain([timeExtent.minTime, timeExtent.maxTime]).range([0, innerWidthArea]) as unknown as ReturnType<typeof scaleUtc>;
  }, [timeExtent, innerWidthArea]);
  const xScaleSel = React.useMemo(() => {
    if (!timeExtent) return null;
    return scaleUtc().domain([timeExtent.minTime, timeExtent.maxTime]).range([0, innerWidthArea]);
  }, [timeExtent, innerWidthArea]);
  const { selection: chartSelection } = useChartSelection({
    enabled: true,
    innerWidth: innerWidthArea,
    marginLeft: margin.left,
    data: data as unknown as Array<Record<string, unknown>>,
    xDataKey,
    xScale: xScaleSel as unknown as { invert: (px: number) => Date } | null,
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
  const yTickColorForValue = React.useMemo(() => createTickColorResolver(staticRefConfigs, yDomainFinal, DEFAULT_Y_AXIS_ID), [staticRefConfigs, yDomainFinal]);

  // BrushHost + clipping — same shape as line-chart.tsx (strip = un-brushed => trackExtent = final xScale domain)
  const innerWidthForBrush = Math.max(0, width - margin.left - margin.right);
  const innerHeightForBrush = Math.max(0, heightPx - margin.top - margin.bottom);
  const areaBrushClipId = useSanitizedId();
  const needsAreaBrushClip = !!xDomain && innerWidthForBrush > 0 && innerHeightForBrush > 0;
  const trackExtentForBrush = React.useMemo<[Date, Date] | null>(() => {
    if (!timeExtent) return null;
    return [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)];
  }, [timeExtent]);
  const brushHostValue = React.useMemo(() => {
    if (!trackExtentForBrush || innerWidthForBrush <= 0) return null;
    return { containerRef: containerRef as unknown as React.RefObject<HTMLElement | null>, margin, trackExtent: trackExtentForBrush } as const;
  }, [trackExtentForBrush, innerWidthForBrush, margin]);
  const brushElements = brushes.length > 0 && brushHostValue ? (brushes as unknown as React.ReactNode[]) : null;

  return (
    <ChartSelectionContext.Provider value={chartSelection}>
    <div
      ref={containerRef}
      className={className}
      // bklit area-chart.tsx:232 — touchAction "none" keeps vertical page
      // scroll from hijacking drag-selection strokes on touch devices.
      style={{ position: "relative", width: "100%", aspectRatio, touchAction: "none", isolation: "isolate", ...style } as React.CSSProperties}
      data-bkm-chart="area"
      {...fadeEdgesMask}
    >
      {needsAreaBrushClip ? (
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={areaBrushClipId}>
              <rect x={margin.left} y={margin.top} width={innerWidthForBrush} height={innerHeightForBrush} />
            </clipPath>
          </defs>
        </svg>
      ) : null}
      {brushHostValue ? (
        <BrushHostContext.Provider value={brushHostValue as unknown as import("./internal/brush-drag").BrushHost}>
          <div style={{ display: "contents" }}>{brushElements}</div>
        </BrushHostContext.Provider>
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
        <div style={needsAreaBrushClip ? { clipPath: `url(#${areaBrushClipId})` } : undefined}>
          <Chart
            ariaLabel="Area chart"
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
          {xAxis ? (
            <XAxisOverlay
              data={xDomain ? visibleData : renderData}
              xDataKey={xDataKey}
              rangeStart={margin.left}
              rangeEnd={width - margin.right}
              numTicks={xAxis.numTicks ?? 5}
              formatValue={xAxis.formatValue}
              domainMaxTime={timeExtent?.maxTime}
              xDomain={xDomain ?? null}
              tickMode={xAxis.tickMode}
            />
          ) : null}
          {yAxis ? (
            <YAxisOverlay
              yDomain={yDomainFinal}
              chartTop={margin.top}
              chartBottom={heightPx - margin.bottom}
              chartLeft={margin.left}
              chartRight={margin.right}
              orientation={yAxis.orientation ?? "left"}
              numTicks={yAxis.numTicks ?? 5}
              formatLargeNumbers={yAxis.formatLargeNumbers ?? true}
              formatValue={yAxis.formatValue}
              tickColorForValue={yTickColorForValue}
            />
          ) : null}
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
            innerWidth={innerWidthArea}
            innerHeight={heightPx - margin.top - margin.bottom}
            marginLeft={margin.left}
            marginTop={margin.top}
            components={segmentComponents}
          />
          {overlayRenderedArea ? (
            <ProjectionMarkerOverlay
              width={width}
              height={heightPx}
              margin={margin}
              terminalMarkers={areaTerminalAnchors}
              projectionEndMarkers={areaEndAnchors}
              phasePort={projectionPhasePortRef}
            />
          ) : null}
          {tooltipEnabled ? (
            <div
              ref={datePill.overlayHostRef}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            />
          ) : null}
          <DashTailOverlay
            containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
            width={width}
            height={heightPx}
            margin={margin}
            renderData={renderData as unknown as Record<string, unknown>[]}
            xDataKey={xDataKey}
            // A4: series with showLine=false get no dash tail (bklit gates
            // SeriesDashTailOverlay on `showSeriesStroke = ... && showLine`).
            series={resolvedAreas.flatMap((a) =>
              a.showLine
                ? [{
                    dataKey: a.dataKey,
                    stroke: a.stroke,
                    strokeWidth: a.strokeWidth,
                    dashFromIndex: a.dashFromIndex,
                    dashArray: a.dashArray,
                  }]
                : [],
            )}
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
                const s = areaXScaleD3Ref.current;
                if (!s) return null;
                const v = (s as unknown as { (x: Date): number | undefined })(d);
                return v == null ? null : v;
              }}
              marginLeft={margin.left}
              marginTop={margin.top}
              innerHeight={Math.max(0, heightPx - margin.top - margin.bottom)}
              containerRef={containerRef as unknown as React.RefObject<HTMLElement | null>}
              animationDuration={animationDuration}
              onMarkerHoverChange={(markers) => {
                // LM6 legacy interplay: hovering a marker group hides the
                // crosshair/tooltip chrome (legacy setTooltipData(null)) AND
                // drops isActive (guide lines return to rest opacity);
                // leaving leaves both cleared until the next chart hover,
                // like legacy.
                if (markers) {
                  clearFocusChrome();
                }
              }}
            />
            </MarkerActiveTooltipProvider>
          ) : null}
        </>
      )}
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
      {(projectionGradientDefsArea.length > 0 || areaMarkerGradientDefs.length > 0) && (
            <svg
              width={0}
              height={0}
              style={{ position: "absolute" }}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                {projectionGradientDefsArea.map((g) => (
                  <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse" x1={g.startX} y1={g.startY} x2={g.endX} y2={g.endY}>
                    <stop offset="0%" stopColor={g.gradientStart} />
                    <stop offset="100%" stopColor={g.gradientEnd} />
                  </linearGradient>
                ))}
                {areaMarkerGradientDefs.map((g) => (
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
          )}
      {patternDefs.length > 0 && (
        <svg
          width={0}
          height={0}
          style={{ position: "absolute" }}
          aria-hidden="true"
          focusable="false"
        >
          <defs>{patternDefs.map((p) => (
            <React.Fragment key={p.id}>
              {p.node}
              {/* bklit paints marks inside <g transform=translate(margin)>, so its
                  userSpaceOnUse tiles anchor at (margin.left, margin.top); TanStack
                  bakes margins into path coordinates, so the tile grid must be
                  phase-shifted by the margin to match. */}
              <pattern
                id={p.id}
                href={`#${p.id}-base`}
                xlinkHref={`#${p.id}-base`}
                patternTransform={`translate(${margin.left} ${margin.top})`}
              />
            </React.Fragment>
          ))}</defs>
        </svg>
      )}
    </div>
    </ChartSelectionContext.Provider>
  );
}

// Legacy parity: bklit `area-chart.tsx` ships `export default AreaChart;` (T-E2).
export default AreaChart;
