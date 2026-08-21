// Migrated bklit-ui AreaChart — same public API, rendered by TanStack
// Charts. Minimal diff on line-chart.tsx (docs/LOG.md D10/area task):
//   - Two TanStack marks per series: `areaY` (fill, id `${dataKey}__fill`)
//     under a `lineY` (boundary stroke, id `dataKey` — SAME id convention
//     as <Line>, so the shared hover-chrome's series-by-markId lookups
//     work unchanged) on top, per "Layering area and line" (TanStack docs).
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
//   - Hover chrome dims to 0.6 (not Line's 0.3) — area.tsx hardcodes
//     `<SeriesHoverDim dimOpacity={0.6} .../>`; parameterized in
//     internal/hover-chrome.ts (see attachHoverChrome's `dimOpacity` option).
//   - No path-morph on data update (bklit Area has no useAnimatedSeriesPath
//     equivalent) — same as migrated Line, the shared shell's y-domain
//     tween is the only data-update animation either chart has (I8).
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveMonotoneX } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { d3Curve, defineChart, lineY } from "@tanstack/charts";
import type { ChartMark, StaticChartDefinition } from "@tanstack/charts";
import { areaFill } from "./internal/area-fill-mark";
import { patternAreaMark } from "./internal/pattern-area-mark";
import { renderPatternPreset } from "./internal/pattern-preset";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { extractChildren } from "./children";
import { useHoverChrome } from "./internal/use-hover-chrome";
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
import { toDate } from "./internal/coerce-date";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import { YAxisOverlay } from "./internal/y-axis-overlay";
import type { ChartDatum, ChartStatus } from "./internal/types";
import { type ChartPhase, isChartInteractionPhase } from "./internal/chart-phase";
import type { ChartScale } from "@tanstack/charts";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import { resolveGridGuide } from "./internal/grid";
import { LoadingLabel } from "./internal/loading-chrome";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { useChartMargin, useMeasuredRect } from "./internal";
import {
  resolveTimeSeriesYDomain,
  useNicedYDomainChanged,
} from "./internal/y-domain";
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
// Area's own hover dim (area.tsx hardcodes dimOpacity={0.6}; Line uses 0.3).
const AREA_DIM_OPACITY = "0.6";

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

export interface AreaChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  status?: ChartStatus;
  animationDuration?: number;
  margin?: Partial<Margin>;
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
  // accepted for bklit API parity (shell:317-326 columnWidth); no line/area consumer
  xDomainSlotCount?: number;
  tweenYDomainOnXDomainChange?: boolean;
}

interface ResolvedArea {
  dataKey: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillOpacity: number;
  curve: CurveFactory;
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
  yDomainTween = true,
  yDomainTweenDuration: _yDomainTweenDuration = DATA_TWEEN_MS,
  xDomain,
  xDomainSlotCount: _xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
}: AreaChartProps) {
  const margin = useChartMargin(marginProp, DEFAULT_MARGIN);
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

  const { areas, patternAreas, grid, xAxis, yAxis, tooltip, projectionLines, projectionEndMarkers, terminalMarkers, chartMarkers, brushes } = React.useMemo(
    () => extractChildren(children),
    [children],
  );
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  const staticRefConfigs = React.useMemo(() => extractReferenceAreaConfigs(children), [children]);
  const projectionConfigs = React.useMemo(() => extractProjectionLineConfigs(children), [children]);
  const projectionGradientBaseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

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
          fill,
          stroke: a.stroke ?? fill,
          strokeWidth: a.strokeWidth ?? 2,
          fillOpacity: a.fillOpacity ?? 0.4,
          curve: a.curve ?? curveMonotoneX,
          fadeEdges: a.fadeEdges ?? false,
          showHighlight: a.showHighlight ?? true,
          dashFromIndex: (a as { dashFromIndex?: number }).dashFromIndex,
          dashArray: (a as { dashArray?: string }).dashArray,
          showMarkers: (a as { showMarkers?: boolean }).showMarkers,
          markers: (a as { markers?: import("./internal/types").SeriesPointMarkerStyle }).markers,
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
  const patternBaseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
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

  const areaMarkerBaseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
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
  const yDomain = React.useMemo(
    () => resolveTimeSeriesYDomain(visibleData as unknown as ChartDatum[], resolvedAreas),
    [visibleData, resolvedAreas],
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
    return mergeProjectionYDomain(nicedYDomain, projectionConfigs, "left");
  }, [nicedYDomain, projectionConfigs]);

  // The y-domain tween triggers on the FINAL (projection-merged) domain;
  // identical to the shared niced-domain signal when no projection exists.
  const prevYDomainFinalRef = React.useRef(yDomainFinal);
  const yDomainChanged =
    projectionConfigs.length === 0
      ? nicedYDomainChanged
      : prevYDomainFinalRef.current[0] !== yDomainFinal[0] ||
        prevYDomainFinalRef.current[1] !== yDomainFinal[1];
  prevYDomainFinalRef.current = yDomainFinal;

  // Per-series vertical gradient defs (bklit area-gradient-defs.tsx default
  // stops: 0% at `fillOpacity`, 100% at 0 — `gradientToOpacity` default 0
  // and `gradientSpan` default 1 collapse the 2-or-3-stop gradient down to
  // exactly these two stops; those two knobs aren't part of the pilot's
  // <Area> prop surface, so this is the only shape ever produced here).
  // Rendered in a 0x0 sibling <svg> AFTER <Chart> — same
  // url()-resolves-document-wide technique as scatter-chart.tsx.
  const gradientBaseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradientDefs = React.useMemo(
    () =>
      resolvedAreas.map((area, i) => ({
        dataKey: area.dataKey,
        id: `${gradientBaseId}-area-grad-${i}`,
        fill: area.fill,
        fillOpacity: area.fillOpacity,
      })),
    [gradientBaseId, resolvedAreas],
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
  // consumer (spec scale, selection scale, reference areas, x-axis overlay,
  // hover xForIndex) matches the rendered mapping. When xDomain is set, no projection merge.
  const timeExtent = React.useMemo(() => {
    if (!timeExtentRaw) return null;
    if (xDomain) return timeExtentRaw;
    if (projectionConfigs.length === 0) return timeExtentRaw;
    return { minTime: timeExtentRaw.minTime, maxTime: mergeProjectionXDomainMax(timeExtentRaw.maxTime, projectionConfigs) } as const;
  }, [timeExtentRaw, projectionConfigs, xDomain]);

  const isLoading = status === "loading";

  const areaTerminalAnchors = React.useMemo(() => {
    if (terminalMarkers.length === 0 || data.length === 0 || width <= 0 || heightPx <= 0) return [];
    const lastRow = data[data.length - 1] as Record<string, unknown> | undefined;
    if (!lastRow) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
    const te = timeExtent;
    const teRaw = timeExtentRaw;
    if (!te || !teRaw) return [];
    const xForDate = (d: Date) => {
      const r = te.maxTime - teRaw.minTime;
      if (r <= 0) return 0;
      return ((d.getTime() - teRaw.minTime) / r) * innerW;
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
      out.push({ dataKey, cx, cy, fill: (tm["fill"] as string | undefined) ?? "transparent", stroke: (tm["stroke"] as string | undefined) ?? "var(--chart-1)", radius: (tm["radius"] as number | undefined) ?? 5, ringGap: (tm["ringGap"] as number | undefined) ?? 0, strokeWidth: (tm["strokeWidth"] as number | undefined) ?? 1.5, outlineWidth: (tm["outlineWidth"] as number | undefined) ?? 0, outlineColor: tm["outlineColor"] as string | undefined });
    }
    return out;
  }, [terminalMarkers, data, width, heightPx, margin, yDomainFinal, timeExtent, timeExtentRaw, xDataKey]);
  const areaEndAnchors = React.useMemo(() => {
    if (projectionEndMarkers.length === 0 || width <= 0 || heightPx <= 0) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
    const te = timeExtent;
    const teRaw = timeExtentRaw;
    if (!te || !teRaw) return [];
    const xForDate = (d: Date) => {
      const r = te.maxTime - teRaw.minTime;
      if (r <= 0) return 0;
      return ((d.getTime() - teRaw.minTime) / r) * innerW;
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
    const xScaleWithProjection = (value: Date) => {
      const t = value.getTime();
      const r = te.maxTime - teRaw.minTime;
      if (r <= 0) return 0;
      return ((t - teRaw.minTime) / r) * innerW;
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
  }, [projectionConfigs, projectionLines, width, margin, heightPx, yDomainFinal, timeExtent, timeExtentRaw, projectionGradientBaseId, isLoading]);

  const definition = React.useMemo(() => {
    if (width <= 0) return null;
    if (isLoading) {
      const gridGuide = resolveGridGuide(grid);
      const emptySpec = {
        marks: [] as unknown as ChartMark<ChartDatum, Date, number>[],
        x: { scale: scaleUtc as unknown as ChartScale, guide: false },
        y: { scale: scaleLinear().domain(yDomainFinal) as unknown as ChartScale, grid: gridGuide.horizontal, ticks: gridGuide.ticks },
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
    for (const area of resolvedAreas) {
      const gradientId = gradientIdBySeries.get(area.dataKey);
      const curve = d3Curve(area.curve);
      // Fill FIRST, lineY SECOND ("Layering area and line" — TanStack docs:
      // area marks never draw their own boundary stroke; composing a lineY
      // on top is the documented pattern). `areaFill` is a minimal custom
      // mark replacing `areaY`: identical pixels and DOM contract, but no
      // per-datum ChartPoints / retained polygon arrays — areaY's duplicate
      // focus geometry put heap 19% over bklit at n=1000, failing G4 (the
      // boundary lineY below already supplies this series' focus points).
      // fillOpacity always 1 — bklit never double-applies it; the opacity
      // lives entirely in the gradient stops above.
      marks.push(
        areaFill(renderData, {
          id: `${area.dataKey}__fill`,
          x: (d: ChartDatum) => d[xDataKey] as Date,
          y: (d: ChartDatum) => d[area.dataKey] as number,
          curve,
          fill: gradientId ? `url(#${gradientId})` : area.fill,
        }),
      );
      // Same id as <Line> would use for this dataKey — the shared
      // hover-chrome's series-by-markId lookups (dots, tooltip rows,
      // highlight-band re-stroke) find this mark without any Area-specific
      // branching in hover-chrome.ts.
      {
        const hasDashTail = resolveDashTailBounds(area.dashFromIndex, renderData.length);
        marks.push(
          lineY(renderData, {
            id: area.dataKey,
            x: (d: ChartDatum) => d[xDataKey] as Date,
            y: (d: ChartDatum) => d[area.dataKey] as number,
            // Series identity for group-x focus: without z, every series' points
            // carry group=null and focusX dedupes the group down to one point,
            // so multi-series hover would only ever surface a single series.
            z: () => area.dataKey,
            curve,
            stroke: hasDashTail ? "transparent" : area.stroke,
            strokeOpacity: hasDashTail ? 0 : undefined,
            strokeWidth: area.strokeWidth,
          }),
        );
      }
      // showMarkers && showSeriesContent gate matches bklit area.tsx:337 (`showMarkers && showSeriesContent`).
      const showAreaSeriesContent = !isLoading;
      if (showAreaSeriesContent && areaMarkerConfigs.some((s) => s.showMarkers)) {
        marks.push(...buildMarkerMarks(renderData, xDataKey, areaMarkerConfigs, areaMarkerGradientIdByKey));
      }
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
        const xScaleWithProjection = (value: Date) => {
          const t = value.getTime();
          const r = te.maxTime - teRaw.minTime;
          if (r <= 0) return 0;
          return ((t - teRaw.minTime) / r) * innerW;
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
      x: xScaleDef,
      y: {
        scale: scaleLinear().domain(yDomainFinal),
        grid: gridGuide.horizontal,
        ticks: gridGuide.ticks,
      },
      margin,
      focus: "group-x",
      focusRing: false,
      // bklit's hover works anywhere over the plot; TanStack defaults to 48px.
      maxFocusDistance: Number.POSITIVE_INFINITY,
      svgAnimation:
        isChartInteractionPhase(chartPhase) && isLoaded && yDomainChanged
          ? { duration: effectiveYDomainTweenDuration as number, easing: bezierEasing }
          : false,
    });
  }, [renderData, xDataKey, resolvedAreas, resolvedPatternAreas, patternIdByKey, gradientIdBySeries, grid, width, yDomainFinal, yDomainChanged, margin, isLoading, chartPhase, isLoaded, projectionConfigs, projectionLines, projectionGradientBaseId, heightPx, timeExtent, timeExtentRaw, effectiveYDomainTweenDuration, areaMarkerConfigs, areaMarkerGradientIdByKey]);

  // Hover chrome (bklit ChartTooltip): imperative overlays driven by
  // TanStack's focus callbacks — no React work per pointer move. Reuses
  // Line's exact chrome (wiring shared via ./internal/use-hover-chrome), dim
  // opacity parameterized to Area's 0.6 (Line keeps its own 0.3 default —
  // see internal/hover-chrome.ts). Focus-point dedup: `onFocusGroupChange`
  // receives one ChartPoint per MARK at the focused x (both the areaY fill
  // mark AND the lineY boundary mark emit a point for the same
  // datum/coordinate), but `chromeStateRef.series` below lists each series
  // by its LINE id (`area.dataKey`, not `${area.dataKey}__fill`) — the
  // chrome's `pointByMark` Map is keyed by markId, so
  // `pointByMark.get(series.dataKey)` only ever resolves the lineY point;
  // the areaY point (stored under the sibling `__fill` key) is simply never
  // looked up. No explicit filtering needed.
  const tooltipEnabled = tooltip?.enabled ?? false;
  // Scene x of rendered point `index` — same linear time→px mapping the
  // rendered x scale applies, extended by the projection tail when present.
  const xForIndex = (index: number) => {
    const te = timeExtent;
    const teRaw = timeExtentRaw;
    const value = renderData[index]?.[xDataKey];
    if (!(value instanceof Date) || !te || !teRaw) return margin.left;
    const r = te.maxTime - teRaw.minTime;
    if (r <= 0) return margin.left;
    return margin.left + ((value.getTime() - teRaw.minTime) / r) * innerWidth;
  };
  // D4 parity fix: this used to be missing, silently no-op'ing
  // HoverChrome.reanchor() for Area (a data change mid-hover never
  // re-anchored the dot/crosshair). Same px mapping as xForIndex above —
  // teRaw.minTime === te.minTime always (only maxTime moves, when a
  // projection extends the domain), so a reanchored point lands exactly
  // where xForIndex would place it.
  const xScaleForReanchor = React.useMemo(() => {
    const te = timeExtent;
    const teRaw = timeExtentRaw;
    if (!te || !teRaw) return null;
    const r = te.maxTime - teRaw.minTime;
    if (r <= 0) return null;
    const map = (v: Date) => margin.left + ((v.getTime() - teRaw.minTime) / r) * innerWidth;
    const invert = (x: number) => new Date(teRaw.minTime + ((x - margin.left) / innerWidth) * r);
    return Object.assign(map, { invert });
  }, [timeExtent, timeExtentRaw, margin.left, innerWidth]);
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
    dimOpacity: AREA_DIM_OPACITY,
  });
  chromeStateRef.current = {
    margin,
    series: resolvedAreas.map((area) => ({
      dataKey: area.dataKey,
      color: area.stroke,
      strokeWidth: area.strokeWidth,
      showHighlight: area.showHighlight,
      marker: area.showMarkers ? { fill: area.markers?.fill ?? area.stroke, stroke: area.markers?.stroke ?? area.markers?.fill ?? area.stroke, strokeWidth: area.markers?.strokeWidth ?? 2, ringGap: area.markers?.ringGap ?? 2, radius: area.markers?.radius ?? 5, outlineWidth: area.markers?.outlineWidth ?? 0, outlineColor: area.markers?.outlineColor, showActiveHighlight: area.markers?.showActiveHighlight ?? true } : null,
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
    chartPhase,
    isLoaded,
    renderData,
    xScale: xScaleForReanchor,
    resolvePoints: (x, index, datum) => {
      const state = chromeStateRef.current;
      if (!state) return null;
      // Same scene mapping as the rendered lineY boundary marks (and the
      // terminal markers above): margin.top + scaleLinear(yDomainFinal)
      // .range([innerH, 0]). Areas don't stack — each series plots its raw value.
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

  const areaMarkerRevealAnimsRef = React.useRef<Animation[]>([]);
  const areaMarkerRevealCancelRef = React.useRef<(() => void) | null>(null);
  const handleRender = React.useCallback(() => {
    const marks = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marks) return;
    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shouldAnimate = chartPhase === "revealing" && animationDuration > 0 && !prefersReduced && marks.dataset.bkmRevealed !== "1";
    if (!shouldAnimate) {
      if (marks.dataset.bkmRevealed !== "1") marks.dataset.bkmRevealed = "1";
      marks.style.clipPath = "";
      return;
    }
    marks.dataset.bkmRevealed = "1";
    marks.animate(
      [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: animationDuration, easing: REVEAL_EASING },
    );
    if (!areaMarkerConfigs.some((s) => s.showMarkers)) return;
    const innerW = Math.max(0, width - margin.left - margin.right);
    const durationSec = animationDuration / 1000;
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
            { duration: 500, delay: delaySec * 1000, easing: REVEAL_EASING, fill: "backwards" },
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
  }, [animationDuration, chartPhase, areaMarkerConfigs, width, margin.left, margin.right]);

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
      chromeRef.current?.onFocusGroupChange([]);
    },
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
  });
  const segmentComponents = React.useMemo(() => extractSegmentComponents(children), [children]);
  const refAreaChildren = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  const yTickColorForValue = React.useMemo(() => createTickColorResolver(staticRefConfigs, yDomainFinal), [staticRefConfigs, yDomainFinal]);

  // BrushHost + clipping — same shape as line-chart.tsx (strip = un-brushed => trackExtent = final xScale domain)
  const innerWidthForBrush = Math.max(0, width - margin.left - margin.right);
  const innerHeightForBrush = Math.max(0, heightPx - margin.top - margin.bottom);
  const areaBrushClipId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
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
      style={{ position: "relative", width: "100%", aspectRatio, isolation: "isolate", ...style } as React.CSSProperties}
      data-bkm-chart="area"
      data-bkm-fade-edges={
        resolvedAreas.length > 0 &&
        resolvedAreas.every((a) => a.fadeEdges === true)
          ? ""
          : undefined
      }
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
      {definition ? (
        <div style={needsAreaBrushClip ? { clipPath: `url(#${areaBrushClipId})` } : undefined}>
          <Chart
            ariaLabel="Area chart"
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
              ref={overlayHostRef}
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
            series={resolvedAreas.map((a) => ({
              dataKey: a.dataKey,
              stroke: a.stroke,
              strokeWidth: a.strokeWidth,
              dashFromIndex: a.dashFromIndex,
              dashArray: a.dashArray,
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
              onMarkerHoverChange={(entered) => {
                if (entered) chromeRef.current?.onFocusGroupChange([]);
              }}
            />
          ) : null}
        </>
      )}
      {((!isLoading && gradientDefs.length > 0) || projectionGradientDefsArea.length > 0 || areaMarkerGradientDefs.length > 0) && (
            <svg
              width={0}
              height={0}
              style={{ position: "absolute" }}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                {!isLoading
                  ? gradientDefs.map((g) => (
                      <linearGradient
                        key={g.id}
                        id={g.id}
                        x1="0%"
                        x2="0%"
                        y1="0%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor={g.fill}
                          stopOpacity={g.fillOpacity}
                        />
                        <stop offset="100%" stopColor={g.fill} stopOpacity={0} />
                      </linearGradient>
                    ))
                  : null}
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
