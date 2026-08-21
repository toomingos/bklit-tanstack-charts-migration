// Migrated bklit-ui LineChart — same public API, rendered by TanStack Charts.
// Architecture per docs/LOG.md D10: children are config carriers compiled into
// one `defineChart` spec; React commits the SVG once (TanStack adapter);
// data changes go through adapter.update(); the mount reveal is a WAAPI
// clip-path animation on the marks group (zero per-frame JS/React).
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleTime } from "d3-scale";
import { curveNatural } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { d3Curve, defineChart, lineY } from "@tanstack/charts";
import type { ChartMark, ChartScale } from "@tanstack/charts";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { extractChildren } from "./children";
import {
  useHoverChrome,
  type HoverChromeFocusPoint,
} from "./internal/use-hover-chrome";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
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
import {
  extractProfitLossHoveredIndex,
  normalizeProfitLossConfig,
} from "./internal/profit-loss-config";
import {
  profitLossLineMarks,
  resolveProfitLossGradientDefs,
} from "./internal/profit-loss-line-mark";
import { toDate } from "./internal/coerce-date";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import { YAxisOverlay } from "./internal/y-axis-overlay";
import type { ChartDatum, ChartStatus } from "./internal/types";
import { type ChartPhase, isChartInteractionPhase } from "./internal/chart-phase";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import { resolveFadeEdgesMask } from "./internal/fade-mask";
import { resolveGridGuide } from "./internal/grid";
import { gridHighlightRowMarks } from "./internal/grid-highlight-mark";
import { LoadingLabel, LineLoadingPulse } from "./internal/loading-chrome";
import { scaleLinear as d3ScaleLinear } from "d3-scale";
import {
  resolveTimeSeriesYDomain,
  useNicedYDomainChanged,
} from "./internal/y-domain";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { useChartMargin, useDebouncedContainerSize } from "./internal";
import { useChartPhaseOrchestrator } from "./internal/use-chart-phase-orchestrator";
import { filterDataByXDomain, createXAccessor } from "./internal/brush-selection";
import { BrushHostContext } from "./internal/brush-drag";
import { DashTailOverlay, resolveDashTailBounds } from "./internal/dash-tail";
import { buildMarkerGradientDefs, buildMarkerMarks } from "./internal/series-marker-mark";
import { ChartMarkersOverlay } from "./internal/chart-markers";
import "./styles.css";

// bklit animation constants (animation.ts): reveal 1100ms cubic-bezier(.85,0,.15,1)
const DEFAULT_ANIMATION_DURATION_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
// bklit chart-phase.ts DEFAULT_Y_DOMAIN_TWEEN_MS
const DATA_TWEEN_MS = 500;

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

export interface LineChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  status?: ChartStatus;
  animationDuration?: number;
  margin?: Partial<Margin>;
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
  // accepted for bklit API parity (shell:317-326 columnWidth); no line/area consumer
  xDomainSlotCount?: number;
  tweenYDomainOnXDomainChange?: boolean;
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
  animationEasing = REVEAL_EASING,
  yDomainTween = true,
  yDomainTweenDuration: _yDomainTweenDuration = DATA_TWEEN_MS,
  xDomain,
  xDomainSlotCount: _xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
}: LineChartProps) {
  const margin = useChartMargin(marginProp, DEFAULT_MARGIN);
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

  const innerWidthEarly = Math.max(0, width - margin.left - margin.right);
  const earlyRenderData = React.useMemo(() => {
    if (innerWidthEarly <= 0) return data;
    return decimateTimeSeries(data, maxRenderPointsForWidth(innerWidthEarly), []);
  }, [data, innerWidthEarly]);
  void earlyRenderData;

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
    revealSignature: "",
  });

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

  const { lines, grid, xAxis, yAxis, tooltip, projectionLines, projectionEndMarkers, terminalMarkers, profitLossLines, chartMarkers, brushes } = React.useMemo(
    () => extractChildren(children),
    [children],
  );

  const staticRefConfigs = React.useMemo(() => extractReferenceAreaConfigs(children), [children]);
  const projectionConfigs = React.useMemo(() => extractProjectionLineConfigs(children), [children]);
  const projectionGradientBaseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const profitLossHoveredIndex = extractProfitLossHoveredIndex(children);
  const hoveredIndexForPL = profitLossHoveredIndex;
  const [plTooltipSignIndex, setPlTooltipSignIndex] = React.useState<number | null>(null);
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const renderData = React.useMemo(() => {
    if (innerWidth <= 0) return data;
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      lines.map((l) => l.dataKey),
    );
  }, [data, innerWidth, lines]);

  const markerGradientBaseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
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

  // bklit y-domain parity — exact port of time-series-chart-shell.tsx
  // `resolveTimeSeriesYDomain` + `niceYDomain` (d3 .nice() applied by the
  // configured scale below): all-values>=0 -> [0, max*1.1]; mixed-sign ->
  // [min,max] padded 5% each side; empty -> [0,100]. Shared via
  // internal/y-domain.ts with area-chart.tsx and composed-chart.tsx.
  // shell:341 — yDomainTarget uses visibleData when brushing (marks stay on full data).
  const yDomain = React.useMemo(
    () => resolveTimeSeriesYDomain(visibleData as unknown as ChartDatum[], lines),
    [visibleData, lines],
  );

  const { niced: nicedYDomain, changed: nicedYDomainChanged } =
    useNicedYDomainChanged(yDomain);

  // Projection merge on top of the niced base. The merged result is NOT
  // nice'd again — bklit `buildYScalesFromDomains` builds `scaleLinear({domain})`
  // with no nice; value-identical to the plain niced domain when no
  // projection is present.
  const yDomainFinal = React.useMemo<[number, number]>(() => {
    if (projectionConfigs.length === 0) return nicedYDomain;
    return mergeProjectionYDomain(nicedYDomain, projectionConfigs, "left");
  }, [nicedYDomain, projectionConfigs]);

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
  const marks = React.useMemo<ChartMark<ChartDatum, Date, number>[]>(
    () => {
      if (isLoading) return [];
      const base = lines.map((line) => {
        const hasDashTail = resolveDashTailBounds(line.dashFromIndex, renderData.length);
        return lineY(renderData, {
          id: line.dataKey,
          x: (d: ChartDatum) => d[xDataKey] as Date,
          y: (d: ChartDatum) => d[line.dataKey] as number,
          // Series identity for group-x focus: without z, every series' points
          // carry group=null and focusX dedupes the group down to one point,
          // so multi-series hover would only ever surface a single series.
          z: () => line.dataKey,
          curve: d3Curve(line.curve ?? curveNatural),
          stroke: hasDashTail ? "transparent" : line.stroke,
          strokeOpacity: hasDashTail ? 0 : undefined,
          strokeWidth: line.strokeWidth ?? 2.5,
        });
      });
      // SeriesMarkers grid — dot marks ABOVE the line stroke (bklit line.tsx:317-401 z-order: hover-dim stroke -> markers -> highlight band). Null y values produce no dot (bklit series-markers.tsx:107-120).
      if (!isLoading && markerSeriesConfigs.some((s) => s.showMarkers)) {
        base.push(...buildMarkerMarks(renderData, xDataKey, markerSeriesConfigs, markerGradientIdByKey));
      }
      // Grid highlight rows (bklit highlightRowValues) — solid lines under
      // the series marks; inert unless the <Grid> child passes the prop.
      if (grid?.horizontal && grid.highlightRowValues && grid.highlightRowValues.length > 0 && width > 0) {
        const innerWHL = Math.max(0, width - margin.left - margin.right);
        const innerHHL = Math.max(0, heightPx - margin.top - margin.bottom);
        if (innerWHL > 0 && innerHHL > 0) {
          const yScaleHL = scaleLinear().domain(yDomainFinal).range([innerHHL, 0]);
          base.unshift(
            ...gridHighlightRowMarks({
              grid,
              yScale: (v: number) => yScaleHL(v),
              innerWidth: innerWHL,
              translateX: margin.left,
              translateY: margin.top,
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
          let minTimePL = Infinity;
          let maxTimePL = -Infinity;
          for (const d of renderData) {
            const v = (d as Record<string, unknown>)[xDataKey];
            if (v instanceof Date) {
              const t = v.getTime();
              if (t < minTimePL) minTimePL = t;
              if (t > maxTimePL) maxTimePL = t;
            }
          }
          if (Number.isFinite(minTimePL)) {
            const extMaxPL = projectionConfigs.length > 0 ? mergeProjectionXDomainMax(maxTimePL, projectionConfigs) : maxTimePL;
            const xScalePL = (value: Date) => {
              const t = value.getTime();
              const r = extMaxPL - minTimePL;
              if (r <= 0) return 0;
              return ((t - minTimePL) / r) * innerWPL;
            };
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
      let minTime = Infinity;
      let maxTime = -Infinity;
      for (const d of renderData) {
        const v = (d as Record<string, unknown>)[xDataKey];
        if (v instanceof Date) {
          const t = v.getTime();
          if (t < minTime) minTime = t;
          if (t > maxTime) maxTime = t;
        }
      }
      if (!Number.isFinite(minTime)) return base;
      const extMax = mergeProjectionXDomainMax(maxTime, projectionConfigs);
      const xScaleWithProjection = (value: Date) => {
        const t = value.getTime();
        const r = extMax - minTime;
        if (r <= 0) return 0;
        return ((t - minTime) / r) * innerW;
      };
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
    [renderData, xDataKey, lines, isLoading, width, heightPx, yDomainFinal, projectionConfigs, projectionLines, projectionGradientBaseId, margin, profitLossLines, hoveredIndexForPL, plTooltipSignIndex, grid, markerSeriesConfigs, markerGradientIdByKey],
  );

  const spec = React.useMemo(() => {
    if (width <= 0) return null;
    // C2: single source for the final y-domain — niced base with the
    // projection merge already applied (no re-nice). Reuse the same tuple
    // here and pass it through to YAxisOverlay.
    const niced = yDomainFinal;
    // D110 escape hatch: stash the ranged time scale in ChartScale.resolve;
    // xForIndex and the hover highlight consume the exact rendered mapping.
    const xScale: ChartScale = {
      id: "x",
      resolve(context) {
        const [r0, r1] = context.range;
        // bklit shell:285-301 — when xDomain is set, domain narrows to xDomain and
        // mergeProjectionXDomainMax is SKIPPED: "Brush defines the viewport — projection
        // horizon is included via brush track extent, not by extending past the selection on the main chart."
        let minTime: number;
        let maxTime: number;
        if (xDomain) {
          minTime = xDomain[0].getTime();
          maxTime = xDomain[1].getTime();
        } else {
          minTime = Infinity;
          maxTime = -Infinity;
          for (const d of renderData) {
            const v = d[xDataKey];
            if (v instanceof Date) {
              const t = v.getTime();
              if (t < minTime) minTime = t;
              if (t > maxTime) maxTime = t;
            }
          }
          if (projectionConfigs.length > 0 && Number.isFinite(maxTime)) {
            maxTime = mergeProjectionXDomainMax(maxTime, projectionConfigs);
          }
        }
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
        const ticks = base.ticks(context.tickCount ?? 5);
        return {
          id: context.id,
          type: "time",
          domain: base.domain(),
          map: (value: unknown) => {
            const m = base(value as Date);
            return m === undefined ? Number.NaN : m;
          },
          ticks: ticks.map((value) => ({
            value,
            position: base(value) ?? Number.NaN,
            label: value.toISOString(),
          })),
          bandwidth: 0,
        };
      },
    };
    const yScale = scaleLinear().domain(niced);
    const gridGuide = resolveGridGuide(grid);
    // bklit shell:373-395 — effective tween enable = yDomainTween || (tweenYDomainOnXDomainChange && xDomain != null) already folded into effectiveYDomainTweenDuration; gate uses yDomainChangedForTween which tracks the visibleData-derived domain.
    const svgAnimation =
      isChartInteractionPhase(chartPhase) && isLoaded && yDomainChangedForTween
        ? { duration: effectiveYDomainTweenDuration as number, easing: bezierEasing }
        : false;
    return {
      marks,
      x: { scale: xScale, guide: false },
      y: { scale: yScale, grid: gridGuide.horizontal, ticks: gridGuide.ticks },
      margin,
      focus: "group-x" as const,
      // bklit has no native focus ring — its hover dot is the springed TooltipDot.
      focusRing: false,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      svgAnimation,
    };
  }, [marks, renderData, xDataKey, grid, width, yDomainFinal, yDomainChangedForTween, margin, chartPhase, isLoaded, effectiveYDomainTweenDuration, projectionConfigs, xDomain]);

  const definition = React.useMemo(() => {
    if (!spec) return null;
    return defineChart(spec);
  }, [spec]);

  // Hover chrome (bklit ChartTooltip): imperative overlays driven by
  // TanStack's focus callbacks — no React work per pointer move. The state
  // ref keeps the chrome reading current geometry without re-attaching.
  // Wiring (refs, pill labels, attach/reanchor/syncDim effects, xDomain
  // focus-clamp) is shared with area-chart.tsx via ./internal/use-hover-chrome
  // — only chromeStateRef.current's series shape and this profit/loss sign
  // flip are Line-specific.
  const tooltipEnabled = tooltip?.enabled ?? false;
  const xForIndex = React.useCallback(
    (index: number) => {
      const xScaleInstance = xScaleD3Ref.current;
      const row = renderData[index];
      const value = row?.[xDataKey];
      if (!xScaleInstance || !(value instanceof Date)) return margin.left;
      const mapped = xScaleInstance(value);
      return mapped ?? margin.left;
    },
    [renderData, xDataKey, margin.left],
  );
  const handleProfitLossFocus = React.useCallback(
    (points: readonly HoverChromeFocusPoint[]) => {
      if (profitLossLines.length > 0) {
        let next: number | null = null;
        if (points.length > 0) {
          const firstCfg = profitLossLines[0] as unknown as Record<string, unknown> | undefined;
          const dk = firstCfg?.["dataKey"] as string | undefined;
          if (dk) {
            const v = (points[0]!.datum as unknown as Record<string, unknown>)?.[dk];
            if (typeof v === "number") next = v >= 0 ? 0 : 1;
          }
        }
        setPlTooltipSignIndex((prev) => (prev !== next ? next : prev));
      }
    },
    [profitLossLines],
  );
  const {
    chromeRef,
    dragSelectionActiveRef,
    chromeStateRef,
    overlayHostRef,
    dateLabelsForPill,
    handleFocusGroupChange,
  } = useHoverChrome({
    renderData,
    xDataKey,
    chartPhase,
    isLoaded,
    xDomain,
    legendHoveredIndex,
    tooltipEnabled,
    width,
    onFocusPoints: handleProfitLossFocus,
  });
  chromeStateRef.current = {
    margin,
    series: lines.map((line) => ({
      dataKey: line.dataKey,
      color: line.stroke ?? "",
      strokeWidth: line.strokeWidth ?? 2.5,
      showHighlight: line.showHighlight ?? true,
      marker: line.showMarkers ? { fill: line.markers?.fill ?? line.stroke ?? "", stroke: line.markers?.stroke ?? line.markers?.fill ?? line.stroke ?? "", strokeWidth: line.markers?.strokeWidth ?? 2, ringGap: line.markers?.ringGap ?? 2, radius: line.markers?.radius ?? 5, outlineWidth: line.markers?.outlineWidth ?? 0, outlineColor: line.markers?.outlineColor, showActiveHighlight: line.markers?.showActiveHighlight ?? true } : null,
    })),
    xDataKey,
    pointCount: renderData.length,
    xForIndex,
    showCrosshair: tooltip?.showCrosshair ?? true,
    showDots: tooltip?.showDots ?? true,
    showDatePill: tooltip?.showDatePill ?? true,
    tooltip: tooltip ?? null,
    dateLabels: dateLabelsForPill,
    legendHoveredIndex,
    // D4: shared re-anchor support (./internal/hover-reanchor via
    // hover-chrome.ts's `reanchor()`) — replaces this file's former bespoke
    // bisect-and-rebuild-points effect below with the one shared
    // implementation, wired once in hover-chrome.ts.
    chartPhase,
    isLoaded,
    renderData,
    xScale: xScaleD3Ref.current,
    resolvePoints: (x, index, datum) => {
      const state = chromeStateRef.current;
      if (!state) return null;
      // Same scene mapping as the rendered lineY marks (and the terminal
      // markers above): margin.top + scaleLinear(yDomainFinal).range([innerH, 0]).
      const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
      const span = yDomainFinal[1] - yDomainFinal[0];
      const row = datum as Record<string, unknown>;
      return state.series.map((s) => {
        const v = row?.[s.dataKey];
        const y = typeof v === "number" && Number.isFinite(v) && span !== 0 && innerH > 0
          ? margin.top + innerH - ((v - yDomainFinal[0]) / span) * innerH
          : margin.top + innerH;
        return {
          markId: s.dataKey,
          datum,
          datumIndex: index,
          x,
          y,
          color: s.color,
        };
      });
    },
  };

  const markerRevealAnimsRef = React.useRef<Animation[]>([]);
  const markerRevealCancelRef = React.useRef<(() => void) | null>(null);
  const handleRender = React.useCallback(() => {
    const marks = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marks) return;
    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shouldAnimate = chartPhase === "revealing" && animationDuration > 0 && !prefersReduced && marks.dataset.bkmRevealed !== "1";
    if (!shouldAnimate) {
      if (marks.dataset.bkmRevealed !== "1") marks.dataset.bkmRevealed = "1";
      marks.style.clipPath = "";
      if (markerSeriesConfigs.some((s) => s.showMarkers) && marks && animationDuration > 0 && !prefersReduced) {
        const hasMarkers = !!marks.querySelector(".ts-chart__dot[data-ts-key$=\"__marker\"]");
        if (hasMarkers) {
          marks.dataset.bkmRevealed = "1";
        }
      }
      return;
    }
    marks.dataset.bkmRevealed = "1";
    marks.animate(
      [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: animationDuration, easing: animationEasing },
    );
    if (!markerSeriesConfigs.some((s) => s.showMarkers)) return;
    const innerW = Math.max(0, width - margin.left - margin.right);
    const durationSec = animationDuration / 1000;
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
            { duration: 500, delay: delaySec * 1000, easing: animationEasing, fill: "backwards" },
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
  }, [animationDuration, animationEasing, chartPhase, markerSeriesConfigs, width, margin.left, margin.right]);

  React.useEffect(() => {
    if (chartPhase !== "revealing") return;
    const marks = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marks) return;
    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || animationDuration <= 0) {
      marks.style.clipPath = "";
      marks.dataset.bkmRevealed = "1";
    }
  }, [chartPhase, revealEpoch, animationDuration]);
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

  const lineTerminalAnchors = React.useMemo(() => {
    if (terminalMarkers.length === 0 || data.length === 0 || width <= 0 || heightPx <= 0) return [];
    const lastRow = data[data.length - 1] as Record<string, unknown> | undefined;
    if (!lastRow) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
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
    if (!Number.isFinite(minTime)) return [];
    const extMax = projectionConfigs.length > 0 ? mergeProjectionXDomainMax(maxTime, projectionConfigs) : maxTime;
    const xForDate = (d: Date) => {
      const r = extMax - minTime;
      if (r <= 0) return 0;
      return ((d.getTime() - minTime) / r) * innerW;
    };
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
  }, [terminalMarkers, data, width, heightPx, margin, renderData, xDataKey, yDomainFinal, projectionConfigs]);
  const lineEndAnchors = React.useMemo(() => {
    if (projectionEndMarkers.length === 0 || width <= 0 || heightPx <= 0) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
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
    if (!Number.isFinite(minTime)) return [];
    const extMax = projectionConfigs.length > 0 ? mergeProjectionXDomainMax(maxTime, projectionConfigs) : maxTime;
    const xForDate = (d: Date) => {
      const r = extMax - minTime;
      if (r <= 0) return 0;
      return ((d.getTime() - minTime) / r) * innerW;
    };
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
  }, [projectionEndMarkers, width, heightPx, margin, renderData, xDataKey, yDomainFinal, projectionConfigs]);

  const projectionGradientDefs = React.useMemo(() => {
    if (projectionConfigs.length === 0 || width <= 0) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
    const yScale = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const d of renderData) {
      const v = (d as Record<string, unknown>)[xDataKey];
      if (v instanceof Date) {
        const t = v.getTime();
        if (t < minTime) minTime = t;
        if (t > maxTime) maxTime = t;
      }
    }
    if (!Number.isFinite(minTime)) return [];
    const extMax = mergeProjectionXDomainMax(maxTime, projectionConfigs);
    const xScaleWithProjection = (value: Date) => {
      const t = value.getTime();
      const r = extMax - minTime;
      if (r <= 0) return 0;
      return ((t - minTime) / r) * innerW;
    };
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
  }, [projectionConfigs, projectionLines, width, margin, heightPx, yDomainFinal, renderData, xDataKey, projectionGradientBaseId, isLoading]);

  const profitLossGradientDefs = React.useMemo(() => {
    if (profitLossLines.length === 0 || width <= 0) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    if (innerW <= 0) return [];
    const configs = profitLossLines.map((raw) => normalizeProfitLossConfig(raw as unknown as Record<string, unknown>)).filter(Boolean) as ReturnType<typeof normalizeProfitLossConfig>[];
    const valid = configs.filter(Boolean) as NonNullable<typeof configs[number]>[];
    return resolveProfitLossGradientDefs(valid, innerW, projectionGradientBaseId);
  }, [profitLossLines, width, margin, projectionGradientBaseId]);

  const overlayRendered = (lineTerminalAnchors.length > 0 || lineEndAnchors.length > 0) && width > 0 && heightPx > 0;
  React.useLayoutEffect(() => {
    if (!overlayRendered) return;
    projectionPhasePortRef.current?.setPhase(phaseRef.current);
  }, [overlayRendered]);

  const xScaleForSelection = React.useMemo(() => {
    if (!timeExtent) return null;
    return scaleUtc().domain([timeExtent.minTime, timeExtent.maxTime]).range([0, innerWidth]);
  }, [timeExtent, innerWidth]);

  const { selection: chartSelection } = useChartSelection({
    enabled: true,
    innerWidth,
    marginLeft: margin.left,
    data: data as unknown as Array<Record<string, unknown>>,
    xDataKey,
    xScale: xScaleForSelection as unknown as { invert: (px: number) => Date } | null,
    containerRef,
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      chromeRef.current?.onFocusGroupChange([]);
    },
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
  });

  const segmentComponents = React.useMemo(() => extractSegmentComponents(children), [children]);
  const refAreaChildren = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  const yTickColorForValue = React.useMemo(() => createTickColorResolver(staticRefConfigs, yDomainFinal), [staticRefConfigs, yDomainFinal]);

  // BrushHost + clipping: trackExtent is this host's own final xScale domain
  // (after projection merge when un-brushed; equals bklit's context xScale domain).
  // Clipping: with a narrowed xDomain, full-data paths map outside [0, innerWidth];
  // gate a clipPath over the plot rect when xDomain is set so they don't bleed into margins.
  const innerWidthForBrush = Math.max(0, width - margin.left - margin.right);
  const innerHeightForBrush = Math.max(0, heightPx - margin.top - margin.bottom);
  const brushClipId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const needsBrushClip = !!xDomain && innerWidthForBrush > 0 && innerHeightForBrush > 0;
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
      {brushHostValue ? (
        <BrushHostContext.Provider value={brushHostValue as unknown as import("./internal/brush-drag").BrushHost}>
          <div style={{ display: "contents" }}>{brushElements}</div>
        </BrushHostContext.Provider>
      ) : null}
      {isLoading && loadingLabel ? <LoadingLabel text={loadingLabel} /> : null}
      {definition ? (
        <div style={needsBrushClip ? { clipPath: `url(#${brushClipId})` } : undefined}>
          <Chart
            ariaLabel="Line chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            height={heightPx > 0 ? heightPx : undefined}
            definition={definition}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
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
              ref={overlayHostRef}
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
              onMarkerHoverChange={(entered) => {
                if (entered) chromeRef.current?.onFocusGroupChange([]);
              }}
            />
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
                    <LineLoadingPulse
                      pathD={linePts}
                      width={innerW}
                      height={innerH}
                      strokeWidth={lines[0]?.strokeWidth ?? 2.5}
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
