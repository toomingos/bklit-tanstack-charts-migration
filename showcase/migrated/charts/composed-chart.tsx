// Migrated bklit-ui ComposedChart — same public API, rendered by TanStack
// Charts. Combines <SeriesBar> (bars, RAW data), <Area> (fill+boundary,
// DECIMATED renderData), and <Line> (boundary only, DECIMATED renderData) in
// one shared x/y frame, matching bklit's own layer order (bars UNDER area
// UNDER line — composed-chart.tsx `ChartInner`).
//
// Architecture summary (docs/LOG.md, this migration):
//  - Dedicated single-pass extraction (`extractComposed` below), NOT
//    `children.tsx`'s generic `extractChildren`: bklit's `extractComposedSeries`
//    upserts ONE shared `lines` entry per dataKey across bar/area/line
//    children in DOCUMENT order (later children overwrite stroke/strokeWidth/
//    showHighlight on an existing entry rather than adding a second one) — the
//    pilot fixture's <Area dataKey="line"> + <Line dataKey="line"> merge into
//    a SINGLE tooltip row/y-domain contributor, exactly like bklit.
//  - Exact bklit stroke-fallback formulas per role (composed-chart.tsx
//    `tryAppendSeriesBar`/`tryAppendArea`/`tryAppendLine`, re-verified against
//    source this session):
//      SeriesBar: stroke || fill || DEFAULT_COLOR, strokeWidth always 0.
//      Area:      stroke || fill || DEFAULT_COLOR, strokeWidth default 2.
//      Line:      stroke || DEFAULT_COLOR (no fill fallback), strokeWidth 2.5.
//  - Decimation asymmetry preserved AS-IS (bklit quirk, not "fixed"): bars
//    render RAW `data`; area/line render `renderData` (LTTB-decimated), whose
//    valueKeys are the FULL merged series list including the bar's own
//    dataKey — bklit's shell passes the same merged list into
//    `decimateTimeSeries` regardless of whether bars ever consume the result.
//  - y-domain scans ALL merged series (bar shim included) over RAW `data`
//    (bklit `resolveTimeSeriesYDomain` over the full `lines` list).
//  - x scale: scaleUtc, FULL range, no inset (unlike Scatter's xRangePadding)
//    — bklit ComposedChart has no marker-radius concept to pad for.
//  - Reveal is DOUBLE: (1) the shared percentage clip-path wipe (identical
//    technique to Line/Area) governs the phase state machine at flat
//    `animationDuration`, and ALSO auto-reproduces bklit's padded bar-overhang
//    reveal (`computeSeriesBarRevealClipPadding`, internal/series-bar-
//    layout.ts) with no separate padded clip-rect element — verified
//    algebraically, see that file's header comment; (2) an INDEPENDENT
//    per-bar WAAPI grow-from-baseline stagger (bar-chart.tsx's exact
//    formulas), decoupled from the state machine, cancelling itself at its
//    OWN `animationDuration + staggerSpreadMs` deadline. `ComposedChartProps`
//    has no `status` prop (confirmed from bklit source) — `phaseRef` always
//    starts at "loading", so — like Line/Area, unlike Scatter/Bar — no
//    ref-guard-bypass effect is needed (the initial value already differs
//    from the first real transition, "revealing").
//  - Hover: bklit's `resolveTooltipFromX` bisector algorithm (use-chart-
//    interaction.ts), replicated via our own native pointermove listener
//    (same technique as scatter-chart.tsx) rather than TanStack's focus
//    system, driving the SHARED `hover-chrome.ts` used by Line/Area. Two
//    independent bisects run per move: one over RAW `data` (tooltip row
//    values, bar per-row fade via `barRowIndex`) and one over `renderData`
//    (`datumIndex`, feeding the highlight-band geometry that reads pixel
//    positions of the actually-rendered/decimated line/area points via
//    `xForIndex`) — these indices diverge once decimation reduces point
//    count, and mixing them would misalign the highlight band.
//  - `focus:"group-x"`/`maxFocusDistance:Infinity` are configured in
//    `defineChart` for internal consistency (matching every other migrated
//    chart) but `onFocusGroupChange` is deliberately left inert — same
//    documented pattern as scatter-chart.tsx.
//
// Documented pilot-scope deviations (all intentional, not oversights):
//  - `stacked`/`stackGap` are accepted for prop-surface parity but ALWAYS
//    render unstacked (bklit's `computeComposedYScaleDomainMax` stacked-sum
//    branch is never invoked) — out of pilot scope per the task spec.
//  - Composed's <Area> does not support `fadeEdges` (the pilot fixture never
//    sets it; Line/Area's own charts already cover that feature).
//  - `attachHoverChrome`'s single `dimOpacity` option is chart-wide, not
//    per-series — a Composed instance mixing Area (bklit hardcodes 0.6) and
//    Line (0.3) can only use one; this file keeps Line's 0.3 default.
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleLinear, ScaleTime } from "d3-scale";
import { curveMonotoneX, curveNatural } from "d3-shape";
import type { CurveFactory } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { d3Curve, defineChart, lineY } from "@tanstack/charts";
import type { ChartMark, ChartPoint, ChartScale } from "@tanstack/charts";
import { areaFill } from "./internal/area-fill-mark";
import { seriesBarMark } from "./internal/series-bar-mark";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { roleOf } from "./children";
import {
  attachHoverChrome,
  type FocusPoint,
  type HoverChrome,
  type HoverChromeState,
} from "./internal/hover-chrome";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import {
  extractReferenceAreaConfigs,
  extractReferenceAreaProps,
} from "./internal/reference-area-config";
import {
  ChartSelectionContext,
  extractSegmentComponents,
  useChartSelection,
} from "./internal/chart-selection";
import { SegmentOverlay } from "./internal/segment-visuals";
import { useChartConfig } from "./internal/chart-config-context";
import { useChartLegendHover } from "./internal/chart-legend-hover";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import {
  extractProjectionLineConfigs,
  mergeProjectionXDomainMax,
  mergeProjectionYDomain,
} from "./internal/projection-config";
import { projectionLineMark, resolveProjectionGradientDef } from "./internal/projection-line-mark";
import { ProjectionMarkerOverlay, type ProjectionPhaseHandle } from "./internal/terminal-marker";
import type {
  AreaConfig,
  ChartDatum,
  ChartTooltipConfig,
  GridConfig,
  LineConfig,
  SeriesBarConfig,
  XAxisConfig,
} from "./internal/types";
import { type ChartPhase, isChartInteractionPhase } from "./internal/chart-phase";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { useChartMargin, useDebouncedContainerWidth } from "./internal";
import {
  resolveTimeSeriesYDomain,
  useNicedYDomainChanged,
} from "./internal/y-domain";
import { resolveNearestIndex } from "./internal/bisect";
import { toDate } from "./internal/coerce-date";
import { resolveGridGuide } from "./internal/grid";
import { useChartPhaseOrchestrator } from "./internal/use-chart-phase-orchestrator";
import "./styles.css";

// bklit animation constants (animation.ts): reveal 1100ms cubic-bezier(.85,0,.15,1)
const DEFAULT_ANIMATION_DURATION_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
// bklit chart-phase.ts DEFAULT_Y_DOMAIN_TWEEN_MS
const DATA_TWEEN_MS = 500;
// Shared fallback color across every role's stroke/fill chain
// (composed-chart.tsx tryAppendSeriesBar/tryAppendArea/tryAppendLine all
// bottom out on this same CSS var).
const DEFAULT_COLOR = "var(--chart-line-primary)";
// bklit ComposedChart prop defaults (composed-chart.tsx).
const DEFAULT_BAR_GAP = 4;

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

export interface ComposedChartProps {
  data: ChartDatum[];
  /** Default: "date" (bklit ComposedChartProps default). */
  xDataKey?: string;
  animationDuration?: number;
  margin?: Partial<Margin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  /** Recharts-style target bar width in px (composed-chart.tsx `barSize`). */
  barSize?: number;
  maxBarSize?: number;
  /** Gap between grouped bars, px. Default: 4 (bklit ComposedChart default). */
  barGap?: number;
  /** Accepted for API parity; ALWAYS rendered unstacked in this pilot — see
      file header "Documented pilot-scope deviations". */
  stacked?: boolean;
  children?: React.ReactNode;
}

// --- Dedicated single-pass extraction (bklit `extractComposedSeries`) -----

interface ComposedSeriesEntry {
  dataKey: string;
  stroke: string;
  strokeWidth: number;
  showHighlight: boolean;
}

interface ExtractedComposed {
  barConfigs: SeriesBarConfig[];
  areaConfigs: AreaConfig[];
  lineConfigs: LineConfig[];
  /** ONE upserted entry per dataKey, in first-seen order — bklit's shared
      `lines` list (composed-chart.tsx `upsertLineConfig`): later children
      targeting the same dataKey overwrite stroke/strokeWidth/showHighlight
      on the SAME entry rather than adding a second one (e.g. the pilot
      fixture's <Area dataKey="line"> + <Line dataKey="line">, which merge
      into a single tooltip row / y-domain contributor). */
  composedSeries: ComposedSeriesEntry[];
  grid: GridConfig | null;
  xAxis: XAxisConfig | null;
  tooltip: ChartTooltipConfig | null;
}

function upsertComposedSeries(list: ComposedSeriesEntry[], entry: ComposedSeriesEntry): void {
  const existing = list.find((e) => e.dataKey === entry.dataKey);
  if (existing) {
    existing.stroke = entry.stroke;
    existing.strokeWidth = entry.strokeWidth;
    existing.showHighlight = entry.showHighlight;
  } else {
    list.push(entry);
  }
}

function extractComposed(children: React.ReactNode): ExtractedComposed {
  const barConfigs: SeriesBarConfig[] = [];
  const areaConfigs: AreaConfig[] = [];
  const lineConfigs: LineConfig[] = [];
  const composedSeries: ComposedSeriesEntry[] = [];
  let grid: GridConfig | null = null;
  let xAxis: XAxisConfig | null = null;
  let tooltip: ChartTooltipConfig | null = null;

  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      const role = roleOf(child.type);
      const props = child.props as never;
      if (role === "seriesBar") {
        const bar = props as SeriesBarConfig;
        barConfigs.push(bar);
        // tryAppendSeriesBar: stroke fallback chain, strokeWidth always 0
        // (no boundary line — the bar shim exists purely for the tooltip
        // row / y-domain scan; showHighlight is never applicable to a bar
        // series — the path-highlight-band mechanism is line/area-only).
        upsertComposedSeries(composedSeries, {
          dataKey: bar.dataKey,
          stroke: bar.stroke || bar.fill || DEFAULT_COLOR,
          strokeWidth: 0,
          showHighlight: false,
        });
      } else if (role === "area") {
        const area = props as AreaConfig;
        areaConfigs.push(area);
        // tryAppendArea: stroke || fill || DEFAULT_COLOR.
        upsertComposedSeries(composedSeries, {
          dataKey: area.dataKey,
          stroke: area.stroke || area.fill || DEFAULT_COLOR,
          strokeWidth: area.strokeWidth ?? 2,
          showHighlight: area.showHighlight ?? true,
        });
      } else if (role === "line") {
        const line = props as LineConfig;
        lineConfigs.push(line);
        // tryAppendLine: stroke || DEFAULT_COLOR — NO fill fallback (Line
        // has no `fill` prop at all).
        upsertComposedSeries(composedSeries, {
          dataKey: line.dataKey,
          stroke: line.stroke || DEFAULT_COLOR,
          strokeWidth: line.strokeWidth ?? 2.5,
          showHighlight: line.showHighlight ?? true,
        });
      } else if (role === "grid") {
        grid = props as GridConfig;
      } else if (role === "xAxis") {
        xAxis = props as XAxisConfig;
      } else if (role === "tooltip") {
        tooltip = { enabled: true, ...(props as ChartTooltipConfig) };
      } else if (role === "projectionLine" || role === "projectionEndMarker" || role === "terminalMarker") {
        // Distinct roles — terminal marker's dataKey never registers as a series (bklit LINE_DOMAIN_EXCLUDED_NAMES parity-for-free).
      }
    }
  };
  visit(children);
  return { barConfigs, areaConfigs, lineConfigs, composedSeries, grid, xAxis, tooltip };
}

interface ResolvedBar {
  dataKey: string;
  fill: string;
  radius: number;
  fadedOpacity: number;
}
interface ResolvedArea {
  dataKey: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillOpacity: number;
  curve: CurveFactory;
}
interface ResolvedLine {
  dataKey: string;
  stroke: string;
  strokeWidth: number;
  curve: CurveFactory;
}

export function ComposedChart({
  data,
  xDataKey = "date",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  barSize,
  maxBarSize,
  barGap = DEFAULT_BAR_GAP,
  children,
}: ComposedChartProps) {
  const margin = useChartMargin(marginProp, DEFAULT_MARGIN);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const width = useDebouncedContainerWidth(containerRef);
  const onPhaseChangeRef = React.useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const {
    chartPhase,
    isLoaded,
    revealEpoch,
    notifyYDomainTweenComplete,
  } = useChartPhaseOrchestrator({
    chartStatus: "ready",
    targetData: data as unknown as Record<string, unknown>[],
    skeletonData: [],
    animationDuration,
    yDomainTweenDuration: DATA_TWEEN_MS,
    revealSignature: "",
  });

  const phaseRef = React.useRef<ChartPhase>(chartPhase);
  phaseRef.current = chartPhase;
  // Pixel mandate (D-composed-settle-regression follow-up): the `definition`
  // useMemo below reads chartPhase/isLoaded through THESE refs, not as memo
  // deps. Pre-init-5 this was a plain `phaseRef.current === "ready"` ref read
  // (never a dep), so the memo never recomputed on phase transitions alone.
  // Adding `chartPhase`/`isLoaded` to that memo's dep array made TanStack
  // rebuild `marks`'s definition (and re-render) the moment the orchestrator
  // flips revealing -> ready, producing a subtly different resting raster
  // than the post-reveal DOM state bklit's screenshot compares against
  // (composed settled 0.30% vs frozen 0.199-0.261% band). Keep the
  // isChartInteractionPhase() semantics (Q3 forbids raw "ready" comparisons)
  // but go back to ref reads so the memo has no phase/isLoaded deps.
  const isLoadedRef = React.useRef<boolean>(isLoaded);
  isLoadedRef.current = isLoaded;

  // Externally-reported "ready" must wait for the per-bar reveal stagger
  // (barsDeadlineMs = animationDuration * 1.4), not just the orchestrator's
  // flat animationDuration timer — otherwise the QA harness's armBklitSettle
  // resolves ~440ms before the bar rects finish growing and screenshots the
  // chart mid-stagger (settled 1.2-1.8% vs frozen 0.27-0.42 band). Same
  // contract bar-chart.tsx enforces via setRevealDeadline -> setPhase("ready");
  // here the orchestrator owns chartPhase, so only the onPhaseChange output is
  // held back — internal phase-driven machinery is untouched.
  const pendingBarsRevealRef = React.useRef(false);
  React.useEffect(() => {
    if (chartPhase === "ready" && pendingBarsRevealRef.current) return;
    onPhaseChangeRef.current?.(chartPhase);
  }, [chartPhase]);

  React.useEffect(() => {
    if (chartPhase === "gridTweenReady" || chartPhase === "gridTweenLoading") {
      notifyYDomainTweenComplete();
    }
  }, [chartPhase, notifyYDomainTweenComplete]);

  const revealAnimationsRef = React.useRef<Animation[]>([]);
  const revealDeadlineRef = React.useRef<number | null>(null);
  const revealPostPaintCancelRef = React.useRef<(() => void) | null>(null);
  const mountedRef = React.useRef(true);
  const xScaleD3Ref = React.useRef<ScaleTime<number, number> | null>(null);
  const yScaleD3Ref = React.useRef<ScaleLinear<number, number> | null>(null);

  // Projection marker overlay phase port — the orchestrator owns the phase;
  // the overlay mirrors it through this handle (same wiring as Line/Area).
  const projectionPhasePortRef = React.useRef<ProjectionPhaseHandle | null>(null);
  React.useEffect(() => {
    projectionPhasePortRef.current?.setPhase(chartPhase);
  }, [chartPhase]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (revealDeadlineRef.current !== null) {
        clearTimeout(revealDeadlineRef.current);
        revealDeadlineRef.current = null;
      }
      revealPostPaintCancelRef.current?.();
      revealPostPaintCancelRef.current = null;
      for (const anim of revealAnimationsRef.current) {
        try {
          anim.cancel();
        } catch {
          // detached DOM
        }
      }
      revealAnimationsRef.current = [];
    };
  }, []);

  const { barConfigs, areaConfigs, lineConfigs, composedSeries, grid, xAxis, tooltip } =
    React.useMemo(() => extractComposed(children), [children]);
  const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
  void extractReferenceAreaConfigs;

  const projectionConfigs = React.useMemo(() => extractProjectionLineConfigs(children), [children]);
  const composedProjectionLines = React.useMemo((): Array<Record<string, unknown>> => {
    const out: Array<Record<string, unknown>> = [];
    for (const child of React.Children.toArray(children)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) continue;
      const role = roleOf(child.type);
      if (role === "projectionLine") out.push(child.props as Record<string, unknown>);
    }
    return out;
  }, [children]);
  const composedProjectionEndMarkers = React.useMemo((): Array<Record<string, unknown>> => {
    const out: Array<Record<string, unknown>> = [];
    for (const child of React.Children.toArray(children)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) continue;
      const role = roleOf(child.type);
      if (role === "projectionEndMarker") out.push(child.props as Record<string, unknown>);
    }
    return out;
  }, [children]);
  const composedTerminalMarkers = React.useMemo((): Array<Record<string, unknown>> => {
    const out: Array<Record<string, unknown>> = [];
    for (const child of React.Children.toArray(children)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) continue;
      const role = roleOf(child.type);
      if (role === "terminalMarker") out.push(child.props as Record<string, unknown>);
    }
    return out;
  }, [children]);
  const projectionGradientBaseIdComposed = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const resolvedBars = React.useMemo<ResolvedBar[]>(
    () =>
      barConfigs.map((b) => ({
        dataKey: b.dataKey,
        fill: b.fill ?? DEFAULT_COLOR,
        radius: b.radius ?? 0,
        fadedOpacity: b.fadedOpacity ?? 0.3,
      })),
    [barConfigs],
  );
  const resolvedAreas = React.useMemo<ResolvedArea[]>(
    () =>
      areaConfigs.map((a) => {
        const fill = a.fill ?? DEFAULT_COLOR;
        return {
          dataKey: a.dataKey,
          fill,
          stroke: a.stroke ?? fill,
          strokeWidth: a.strokeWidth ?? 2,
          fillOpacity: a.fillOpacity ?? 0.4,
          curve: a.curve ?? curveMonotoneX,
        };
      }),
    [areaConfigs],
  );
  const resolvedLines = React.useMemo<ResolvedLine[]>(
    () =>
      lineConfigs.map((l) => ({
        dataKey: l.dataKey,
        stroke: l.stroke ?? DEFAULT_COLOR,
        strokeWidth: l.strokeWidth ?? 2.5,
        curve: l.curve ?? curveNatural,
      })),
    [lineConfigs],
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  // Decimation applies ONLY to area/line rendering — bars stay on RAW `data`
  // (the confirmed bklit quirk, ported as-is). valueKeys is the FULL merged
  // `composedSeries` list, bar shim dataKey included, matching bklit's shell
  // exactly (it passes the same merged list into `decimateTimeSeries`
  // regardless of whether bars ever consume the decimated result).
  const renderData = React.useMemo(() => {
    if (innerWidth <= 0) return data;
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      composedSeries.map((s) => s.dataKey),
    );
  }, [data, innerWidth, composedSeries]);

  // bklit y-domain parity (resolveTimeSeriesYDomain), scanning ALL merged
  // series (bar shim included) over RAW `data` — shared via
  // internal/y-domain.ts with Line/Area, scoped to `composedSeries` instead
  // of a single-role list.
  const yDomain = React.useMemo(
    () => resolveTimeSeriesYDomain(data, composedSeries),
    [data, composedSeries],
  );
  const { niced: nicedYDomainBase, changed: nicedYDomainChanged } =
    useNicedYDomainChanged(yDomain);
  // Projection y-domain merge seeds from the NICED base and is NOT re-nice'd
  // (bklit x-axis.tsx projection parity — same rule as Line/Area). The exact
  // two-step structure (left-merge, then fabricated [0,100] union for
  // non-left axes) is preserved. Non-projection path returns the niced base
  // unchanged — value-identical to the frozen D220 behavior.
  const yDomainFinal = React.useMemo<[number, number]>(() => {
    if (projectionConfigs.length === 0) return nicedYDomainBase;
    let next = nicedYDomainBase;
    const leftConfigs = projectionConfigs.filter((c) => c.yAxisId === "left");
    const otherConfigs = projectionConfigs.filter((c) => c.yAxisId !== "left");
    if (leftConfigs.length > 0) {
      next = mergeProjectionYDomain(next, projectionConfigs, "left");
    }
    if (otherConfigs.length > 0) {
      const fabricated = mergeProjectionYDomain([0, 100], projectionConfigs, otherConfigs[0]!.yAxisId);
      const min = Math.min(next[0], fabricated[0]);
      const max = Math.max(next[1], fabricated[1]);
      next = [min, max];
    }
    return next;
  }, [nicedYDomainBase, projectionConfigs]);

  // bklit data-update behavior (I8): animate the scene only when the FINAL
  // y-domain actually moved, otherwise snap — identical to Line/Area. With
  // no projections the shared hook's change flag is used verbatim (frozen
  // D220 semantics); with projections the merged final domain is compared.
  const prevYDomainFinalRef = React.useRef(yDomainFinal);
  const yDomainFinalMoved =
    prevYDomainFinalRef.current[0] !== yDomainFinal[0] ||
    prevYDomainFinalRef.current[1] !== yDomainFinal[1];
  prevYDomainFinalRef.current = yDomainFinal;
  const yDomainChanged =
    projectionConfigs.length === 0 ? nicedYDomainChanged : yDomainFinalMoved;

  // Bar geometry is handled inside the custom seriesBarMark — uses bklit's
  // exact `computeSeriesBarWidth` (`slot × 0.88`) and `computeSeriesBarLayout`
  // group positioning (see D82 revert for the root-cause analysis).
  // No stock barY/inferBandwidth/groupScale plumbing needed here.

  // Per-area vertical gradient defs — identical technique/defaults to
  // area-chart.tsx (bklit area-gradient-defs.tsx: 0%@fillOpacity, 100%@0).
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

  const heightPxComp = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;
  // Raw data extent (LTTB preserves first/last points, so renderData's
  // extent === raw data's extent) and the projection-extended extent. ALL
  // downstream x-domain consumers (selection scale, ReferenceAreaLayers,
  // XAxisOverlay) read the EXTENDED extent; anchor/gradient mapping needs
  // both (pixel x = (t - rawMin) / (extendedMax - rawMin) * innerW).
  const timeExtentCompRaw = React.useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const d of renderData) {
      const parsed = toDate(d[xDataKey]);
      if (!parsed) continue;
      const t = parsed.getTime();
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;
    }
    if (!Number.isFinite(minTime)) return null;
    return { minTime, maxTime } as const;
  }, [renderData, xDataKey]);
  const timeExtentComp = React.useMemo(() => {
    if (!timeExtentCompRaw) return null;
    if (projectionConfigs.length === 0) return timeExtentCompRaw;
    return {
      minTime: timeExtentCompRaw.minTime,
      maxTime: mergeProjectionXDomainMax(timeExtentCompRaw.maxTime, projectionConfigs),
    } as const;
  }, [timeExtentCompRaw, projectionConfigs]);

  const composedTerminalAnchors = React.useMemo(() => {
    if (composedTerminalMarkers.length === 0 || data.length === 0 || width <= 0 || heightPxComp <= 0) return [];
    const lastRow = data[data.length - 1] as Record<string, unknown> | undefined;
    if (!lastRow) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPxComp - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
    const te = timeExtentComp;
    const teRaw = timeExtentCompRaw;
    if (!te || !teRaw) return [];
    const xForDate = (d: Date) => {
      const r = te.maxTime - teRaw.minTime;
      if (r <= 0) return 0;
      return ((d.getTime() - teRaw.minTime) / r) * innerW;
    };
    const yScale2 = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
    const out: Array<{ dataKey: string; cx: number; cy: number; fill: string; stroke: string; radius: number; ringGap: number; strokeWidth: number; outlineWidth: number; outlineColor?: string }> = [];
    for (const tm of composedTerminalMarkers as unknown as Array<Record<string, unknown>>) {
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
  }, [composedTerminalMarkers, data, width, heightPxComp, margin, yDomainFinal, timeExtentComp, timeExtentCompRaw, xDataKey]);
  const composedEndAnchors = React.useMemo(() => {
    if (composedProjectionEndMarkers.length === 0 || width <= 0 || heightPxComp <= 0) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPxComp - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
    const te = timeExtentComp;
    const teRaw = timeExtentCompRaw;
    if (!te || !teRaw) return [];
    const xForDate = (d: Date) => {
      const r = te.maxTime - teRaw.minTime;
      if (r <= 0) return 0;
      return ((d.getTime() - teRaw.minTime) / r) * innerW;
    };
    const yScale2 = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
    const out: Array<{ cx: number; cy: number; stroke: string; strokeOpacity: number; radius: number }> = [];
    for (const em of composedProjectionEndMarkers as unknown as Array<Record<string, unknown>>) {
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
  }, [composedProjectionEndMarkers, width, heightPxComp, margin, yDomainFinal, timeExtentComp, timeExtentCompRaw]);
  const projectionGradientDefsComposed = React.useMemo(() => {
    if (projectionConfigs.length === 0 || width <= 0 || heightPxComp <= 0) return [];
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPxComp - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0) return [];
    const yScale = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
    const te = timeExtentComp;
    const teRaw = timeExtentCompRaw;
    if (!te || !teRaw) return [];
    const xScaleWithProjection = (value: Date) => {
      const t = value.getTime();
      const r = te.maxTime - teRaw.minTime;
      if (r <= 0) return 0;
      return ((t - teRaw.minTime) / r) * innerW;
    };
    const defs: Array<{ id: string; startX: number; startY: number; endX: number; endY: number; gradientStart: string; gradientEnd: string }> = [];
    for (let i = 0; i < composedProjectionLines.length; i++) {
      const p = composedProjectionLines[i] as Record<string, unknown> | undefined;
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
      const gid = `${projectionGradientBaseIdComposed}-proj-${i}`;
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
        strokeVisible: true,
        translateX: margin.left,
        translateY: margin.top,
      });
      if (gd) defs.push(gd);
    }
    return defs;
  }, [projectionConfigs, composedProjectionLines, width, heightPxComp, margin, yDomainFinal, timeExtentComp, timeExtentCompRaw, projectionGradientBaseIdComposed]);

  const definition = React.useMemo(() => {
    if (width <= 0) return null;
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
    // bklit layer order: bars UNDER area UNDER line.
    // Custom seriesBarMark: uses bklit's exact `computeSeriesBarWidth`
    // (`slot × 0.88`) and `computeSeriesBarLayout` group positioning, NOT
    // stock barY's `inferBandwidth` (`minSpacing × 0.8`) — the ~9%
    // narrower bars from the stock formula cause a ~4.5% pixel diff on
    // continuous time scales (bar width mismatch at n=4 per Fable ME-16).
    // Bars consume RAW `data` (bklit quirk: not decimated).
    resolvedBars.forEach((bar, barIndex) => {
      marks.push(
        seriesBarMark(data, {
          id: bar.dataKey,
          xAccessor: (d: ChartDatum) => toDate(d[xDataKey]) as Date,
          yAccessor: (d: ChartDatum) => d[bar.dataKey] as number,
          fill: bar.fill,
          radius: bar.radius || undefined,
          groupDataKeys: resolvedBars.map((b) => b.dataKey),
          seriesIndex: barIndex,
          barGap,
          barSize,
          maxBarSize,
        }),
      );
    });
    for (const area of resolvedAreas) {
      const gradientId = gradientIdBySeries.get(area.dataKey);
      const curve = d3Curve(area.curve);
      // Fill FIRST, lineY SECOND ("Layering area and line" — same pattern as
      // area-chart.tsx). fillOpacity always 1 — opacity lives in the
      // gradient stops.
      marks.push(
        areaFill(renderData, {
          id: `${area.dataKey}__fill`,
          x: (d: ChartDatum) => toDate(d[xDataKey]) as Date,
          y: (d: ChartDatum) => d[area.dataKey] as number,
          curve,
          fill: gradientId ? `url(#${gradientId})` : area.fill,
        }),
      );
      // Same id as <Line> would use for this dataKey — shared hover-chrome
      // series-by-markId lookups work unchanged.
      marks.push(
        lineY(renderData, {
          id: area.dataKey,
          x: (d: ChartDatum) => toDate(d[xDataKey]) as Date,
          y: (d: ChartDatum) => d[area.dataKey] as number,
          curve,
          stroke: area.stroke,
          strokeWidth: area.strokeWidth,
        }),
      );
    }
    for (const line of resolvedLines) {
      marks.push(
        lineY(renderData, {
          id: line.dataKey,
          x: (d: ChartDatum) => toDate(d[xDataKey]) as Date,
          y: (d: ChartDatum) => d[line.dataKey] as number,
          curve: d3Curve(line.curve),
          stroke: line.stroke,
          strokeWidth: line.strokeWidth,
        }),
      );
    }
    if (projectionConfigs.length > 0) {
      const innerW = Math.max(0, width - margin.left - margin.right);
      const innerH = Math.max(0, heightPxComp - margin.top - margin.bottom);
      const te = timeExtentComp;
      const teRaw = timeExtentCompRaw;
      if (innerW > 0 && innerH > 0 && te && teRaw) {
        const yScale = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
        const xScaleWithProjection = (value: Date) => {
          const t = value.getTime();
          const r = te.maxTime - teRaw.minTime;
          if (r <= 0) return 0;
          return ((t - teRaw.minTime) / r) * innerW;
        };
        for (let i = 0; i < projectionConfigs.length; i++) {
          const cfg = projectionConfigs[i]!;
          const p = composedProjectionLines[i] as Record<string, unknown> | undefined;
          if (!p || !cfg || cfg.data.length < 2) continue;
          const stroke = (p["stroke"] as string | undefined) ?? "var(--chart-3)";
          const gid = `${projectionGradientBaseIdComposed}-proj-${i}`;
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
            strokeVisible: true,
            translateX: margin.left,
            translateY: margin.top,
          });
          if (mark) marks.push(mark);
        }
      }
    }

    // Custom x scale: full RAW-data range, no inset (unlike Scatter's
    // xRangePadding — Composed has no marker-radius concept to pad for).
    // D110 escape hatch: stash the ranged d3 scale in ChartScale.resolve for
    // the pointermove bisector; a pre-stashed plain instance would not pick
    // up TanStack's resolved range.
    const xScale: ChartScale = {
      id: "x",
      resolve(context) {
        const [r0, r1] = context.range;
        // Single linear-scan min/max over RAW `data` instead of two
        // `.map()` allocations + two `Math.min/max(...spread)` calls (each
        // spread re-walks a full n-length array as call arguments) — same
        // result, ~half the allocations and one pass instead of effectively
        // four. Measured via CDP trace during the M3a investigation: this
        // wasn't the dominant per-tick cost (~1ms out of ~140ms at
        // n=10000), but it's real, free-standing waste with zero behavior
        // change, so it's worth cutting regardless.
        let minTime = Infinity;
        let maxTime = -Infinity;
        for (const d of data) {
          const parsed = toDate(d[xDataKey]);
          if (!parsed) continue;
          const t = parsed.getTime();
          if (t < minTime) minTime = t;
          if (t > maxTime) maxTime = t;
        }
        if (!Number.isFinite(minTime)) {
          minTime = 0;
          maxTime = 0;
        }
        if (projectionConfigs.length > 0 && Number.isFinite(maxTime)) {
          maxTime = mergeProjectionXDomainMax(maxTime, projectionConfigs);
        }
        const scale = scaleUtc().domain([minTime, maxTime]).range([r0, r1]);
        xScaleD3Ref.current = scale;
        const ticks = scale.ticks(context.tickCount ?? 5);
        return {
          id: context.id,
          type: "time",
          domain: scale.domain(),
          map: (value: unknown) => {
            const parsed = toDate(value);
            if (!parsed) return Number.NaN;
            const mapped = scale(parsed);
            return mapped === undefined ? Number.NaN : mapped;
          },
          ticks: ticks.map((value) => ({
            value,
            position: scale(value) ?? Number.NaN,
            label: value.toISOString(),
          })),
          bandwidth: 0,
        };
      },
    };

    const yScale: ChartScale = {
      id: "y",
      resolve(context) {
        // yDomainFinal is the niced base with the projection merge already
        // applied (no re-nice); with no projections it IS the niced domain,
        // so this is value-identical to the former createNicedYScale path.
        const scale = scaleLinear().domain(yDomainFinal).range(context.range as [number, number]);
        yScaleD3Ref.current = scale;
        const tickValues = scale.ticks(context.tickCount ?? resolveGridGuide(grid).ticks);
        return {
          id: context.id,
          type: "linear",
          domain: scale.domain(),
          map: (value: unknown) => {
            const mapped = scale(value as number);
            return mapped === undefined ? Number.NaN : mapped;
          },
          ticks: tickValues.map((value) => ({
            value,
            position: scale(value) ?? Number.NaN,
            label: String(value),
          })),
          bandwidth: 0,
        };
      },
    };

    return defineChart({
      marks,
      x: { scale: xScale, guide: false },
      y: {
        scale: yScale,
        grid: resolveGridGuide(grid).horizontal,
        ticks: resolveGridGuide(grid).ticks,
      },
      margin,
      focus: "group-x",
      focusRing: false,
      maxFocusDistance: Number.POSITIVE_INFINITY,
      // Ref reads, not deps — see the comment on phaseRef/isLoadedRef above.
      svgAnimation:
        isChartInteractionPhase(phaseRef.current) && isLoadedRef.current && yDomainChanged
          ? { duration: DATA_TWEEN_MS, easing: bezierEasing }
          : false,
    });
    // chartPhase/isLoaded intentionally excluded (pixel mandate, see comment
    // on phaseRef/isLoadedRef above) — read via refs instead so this
    // definition doesn't recompute on phase transitions alone. (eslint's
    // exhaustive-deps rule does not flag this — no disable comment needed.)
  }, [
    data,
    renderData,
    xDataKey,
    resolvedBars,
    resolvedAreas,
    resolvedLines,
    barGap,
    barSize,
    maxBarSize,
    gradientIdBySeries,
    grid,
    width,
    heightPxComp,
    yDomainFinal,
    yDomainChanged,
    margin,
    projectionConfigs,
    composedProjectionLines,
    projectionGradientBaseIdComposed,
    timeExtentComp,
    timeExtentCompRaw,
  ]);

  // Hover chrome (shared with Line/Area) — imperative overlays driven by OUR
  // OWN native pointermove bisector (below), not TanStack's focus system.
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chartConfig = useChartConfig();
  const chromeRef = React.useRef<HoverChrome | null>(null);
  // bklit parity (use-chart-interaction.ts): drag selection suppresses the
  // hover chrome — cleared on mousedown, never rescheduled while dragging.
  const dragSelectionActiveRef = React.useRef(false);
  const chromeStateRef = React.useRef<HoverChromeState | null>(null);
  // Scene x of RENDERED (decimated) point `index` — feeds the highlight
  // band's bandStart/bandEnd, which must reference actually-rendered
  // line/area point positions (same contract as Line/Area's xForIndex).
  const xForIndex = (index: number) => {
    const xScaleInstance = xScaleD3Ref.current;
    const row = renderData[index];
    const parsed = toDate(row?.[xDataKey]);
    if (!xScaleInstance || !parsed) return margin.left;
    return xScaleInstance(parsed) ?? margin.left;
  };
  const dateLabelsForPill = React.useMemo(() => renderData.map((d) => {
    const v = d[xDataKey];
    if (v instanceof Date) return v.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return String(v ?? "");
  }), [renderData, xDataKey]);
  chromeStateRef.current = {
    margin,
    series: composedSeries.map((s) => ({
      dataKey: s.dataKey,
      color: s.stroke,
      strokeWidth: s.strokeWidth,
      showHighlight: s.showHighlight,
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
    bars: resolvedBars.map((b) => ({ dataKey: b.dataKey, fadedOpacity: b.fadedOpacity })),
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  React.useEffect(() => {
    chromeRef.current?.syncDim();
  }, [legendHoveredIndex]);

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachHoverChrome(el, () => chromeStateRef.current!, {
      tooltipSpring: chartConfig.tooltipSpring,
      tooltipBoxSpring: chartConfig.tooltipBoxSpring,
      highlightSpring: chartConfig.highlightSpring,
    });
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig]);

  // `focus:"group-x"` stays configured above for internal consistency with
  // every other migrated chart, but the callback is inert — real hover is
  // driven entirely by our own pointermove listener below (same documented
  // pattern as scatter-chart.tsx).
  const handleFocusGroupChange = React.useCallback(
    (_points: readonly ChartPoint<ChartDatum, Date, number>[]) => {},
    [],
  );

  // Native hover targeting: bklit's exact `resolveTooltipFromX` bisector,
  // run TWICE per move — once over RAW `data` (tooltip values, bar per-row
  // fade) and once over DECIMATED `renderData` (the highlight band's
  // `datumIndex`, since that must reference actually-rendered line/area
  // points, not raw rows that may have been dropped by LTTB). Listener-attach
  // effect intentionally does not depend on data/renderData/composedSeries —
  // read through a ref, same reasoning as scatter-chart.tsx (avoids
  // re-attaching on every data-update tick).
  const hoverInputsRef = React.useRef({ data, renderData, xDataKey, composedSeries });
  hoverInputsRef.current = { data, renderData, xDataKey, composedSeries };

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !tooltipEnabled) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (dragSelectionActiveRef.current) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const {
        data: rawRows,
        renderData: decimatedRows,
        xDataKey: key,
        composedSeries: series,
      } = hoverInputsRef.current;
      if (!isChartInteractionPhase(chartPhase) || !isLoaded) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const xScaleInstance = xScaleD3Ref.current;
      const yScaleInstance = yScaleD3Ref.current;
      if (!xScaleInstance || !yScaleInstance || rawRows.length === 0) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const svg = container.querySelector("svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const pixelX = event.clientX - rect.left;
      const x0 = xScaleInstance.invert(pixelX);
      const x0Ms = x0.getTime();
      const dateAccessor = (d: ChartDatum) => {
        const parsed = toDate(d[key]);
        return parsed ? parsed.getTime() : Number.NaN;
      };
      const rawIndex = resolveNearestIndex(rawRows, dateAccessor, x0Ms);
      if (rawIndex < 0) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const decimatedIndex =
        decimatedRows.length > 0 ? resolveNearestIndex(decimatedRows, dateAccessor, x0Ms) : -1;
      const datum = rawRows[rawIndex]!;
      const parsedDatumX = toDate(datum[key]);
      if (!parsedDatumX) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const resolvedXRaw = xScaleInstance(parsedDatumX);
      if (!Number.isFinite(resolvedXRaw)) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const resolvedX = resolvedXRaw as number;
      const points: FocusPoint[] = series.map((s) => {
        const value = datum[s.dataKey];
        return {
          markId: s.dataKey,
          datum,
          datumIndex: decimatedIndex >= 0 ? decimatedIndex : rawIndex,
          x: resolvedX,
          y: typeof value === "number" ? (yScaleInstance(value) ?? 0) : 0,
          color: s.stroke,
        };
      });
      chromeRef.current?.onFocusGroupChange(points, rawIndex);
    };

    const handlePointerLeave = () => {
      chromeRef.current?.onFocusGroupChange([]);
    };

    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [tooltipEnabled, chartPhase, isLoaded]);

  const handleRender = React.useCallback(() => {
    const marks = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marks) return;
    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Gate on chartPhase === "revealing" (same contract as line-chart.tsx /
    // area-chart.tsx): onRender fires on EVERY <Chart> re-render (TanStack's
    // RendererChartImplementation calls adapter.update() off an unmemoized
    // hostOptions object every commit, react-charts/src/RendererChart.tsx),
    // not just when the marks group's content actually changes. Without this
    // gate, the FIRST onRender call to see an un-revealed marks group wins —
    // which is not reliably the call that lands while the orchestrator's
    // phase is genuinely "revealing", and a later onRender call (e.g. once
    // the phase flips back to "ready" and `definition` recomputes) can find
    // the marks group's `bkmRevealed` flag unset again (TanStack rebuilding
    // that node) and RESTART the clip-path wipe from scratch right as the
    // orchestrator's own settle timer (`useChartPhaseOrchestrator`'s
    // "revealing" timeout, wired to `armBklitSettle` via `onPhaseChange` in
    // the bench/QA harness) reports "ready" — the harness then screenshots
    // the "settled" state mid-restart, catching the chart frozen at the very
    // start of the reveal (D-composed-settle-regression). Matching line/
    // area's explicit phase gate makes the WAAPI clip animation start
    // exactly once, exactly when the phase state machine says "revealing",
    // so both finish together.
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

    if (resolvedBars.length === 0) return;

    const staggerSpreadMs = data.length > 1 ? animationDuration * 0.4 : 0;
    const staggerDelaySec = data.length > 1 ? staggerSpreadMs / 1000 / data.length : 0;
    const barsDeadlineMs = animationDuration + staggerSpreadMs;

    pendingBarsRevealRef.current = true;

    revealPostPaintCancelRef.current = onPostPaint(() => {
      if (!mountedRef.current || !marks.isConnected) return;
      for (const bar of resolvedBars) {
        const escaped = bar.dataKey.replace(/"/g, '\\"');
        const group = marks.querySelector<SVGGElement>(
          `.ts-chart__bar-y[data-ts-key="${escaped}"]`,
        );
        if (!group || !group.isConnected) continue;
        const rects = group.querySelectorAll<SVGRectElement>("rect");
        rects.forEach((rectEl, i) => {
          if (!rectEl.isConnected) return;
          const targetY = Number.parseFloat(rectEl.getAttribute("y") ?? "0");
          const targetHeight = Number.parseFloat(rectEl.getAttribute("height") ?? "0");
          const baselineY = targetY + targetHeight;
          const delaySec = i * staggerDelaySec;
          const anim = rectEl.animate(
            [
              { height: "0px", y: String(baselineY) },
              { height: `${targetHeight}px`, y: String(targetY) },
            ],
            {
              duration: animationDuration,
              delay: delaySec * 1000,
              easing: REVEAL_EASING,
              fill: "backwards",
            },
          );
          revealAnimationsRef.current.push(anim);
        });
      }
    });

    if (revealDeadlineRef.current !== null) clearTimeout(revealDeadlineRef.current);
    revealDeadlineRef.current = setRevealDeadline(barsDeadlineMs, {
      animationsRef: revealAnimationsRef,
      onDeadline: () => {
        revealDeadlineRef.current = null;
        if (pendingBarsRevealRef.current) {
          pendingBarsRevealRef.current = false;
          if (mountedRef.current && phaseRef.current === "ready") {
            onPhaseChangeRef.current?.("ready");
          }
        }
      },
    });
  }, [animationDuration, chartPhase, resolvedBars, data.length]);

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

  // ReferenceAreaLayers keeps the frozen D220 raw-domain contract when no
  // projections are present; with projections it must track the merged
  // final domain the plotted y scale actually uses.
  const yDomainComp = (projectionConfigs.length === 0 ? yDomain : yDomainFinal) as [number, number];
  const innerWidthComp = Math.max(0, width - margin.left - margin.right);
  const xScaleCompSel = React.useMemo(() => {
    if (!timeExtentComp) return null;
    return scaleUtc().domain([timeExtentComp.minTime, timeExtentComp.maxTime]).range([0, innerWidthComp]);
  }, [timeExtentComp, innerWidthComp]);
  const { selection: compSelection } = useChartSelection({
    enabled: true,
    innerWidth: innerWidthComp,
    marginLeft: margin.left,
    data: data as unknown as Array<Record<string, unknown>>,
    xDataKey,
    xScale: xScaleCompSel as unknown as { invert: (px: number) => Date } | null,
    containerRef,
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      chromeRef.current?.onFocusGroupChange([]);
    },
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
  });
  const refAreaChildrenComp = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  const segChildrenComp = React.useMemo(() => extractSegmentComponents(children), [children]);

  const overlayRenderedComposed = (composedTerminalAnchors.length > 0 || composedEndAnchors.length > 0) && width > 0 && heightPxComp > 0;
  React.useLayoutEffect(() => {
    if (!overlayRenderedComposed) return;
    projectionPhasePortRef.current?.setPhase(phaseRef.current);
  }, [overlayRenderedComposed]);

  return (
    <ChartSelectionContext.Provider value={compSelection}>
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio, isolation: "isolate" } as React.CSSProperties}
      data-bkm-chart="composed"
    >
      {definition ? (
        <>
          <Chart
            ariaLabel="Composed chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
          />
          {(gradientDefs.length > 0 || projectionGradientDefsComposed.length > 0) ? (
            // Rendered AFTER <Chart> deliberately — the QA/bench harness
            // locates the chart via the first <svg> in the container (same
            // reasoning as scatter-chart.tsx/area-chart.tsx).
            <svg
              width={0}
              height={0}
              style={{ position: "absolute" }}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                {gradientDefs.map((g) => (
                  <linearGradient key={g.id} id={g.id} x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor={g.fill} stopOpacity={g.fillOpacity} />
                    <stop offset="100%" stopColor={g.fill} stopOpacity={0} />
                  </linearGradient>
                ))}
                {projectionGradientDefsComposed.map((g) => (
                  <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse" x1={g.startX} y1={g.startY} x2={g.endX} y2={g.endY}>
                    <stop offset="0%" stopColor={g.gradientStart} />
                    <stop offset="100%" stopColor={g.gradientEnd} />
                  </linearGradient>
                ))}
              </defs>
            </svg>
          ) : null}
          {xAxis ? (
            <XAxisOverlay
              data={renderData}
              xDataKey={xDataKey}
              rangeStart={margin.left}
              rangeEnd={width - margin.right}
              numTicks={xAxis.numTicks ?? 5}
              formatValue={xAxis.formatValue}
              domainMaxTime={timeExtentComp?.maxTime}
            />
          ) : null}
          {heightPxComp > 0 && (
            <ReferenceAreaLayers
              configs={refAreaChildrenComp}
              geom={{
                width,
                height: heightPxComp,
                margin,
                yDomain: yDomainComp,
                xDomain: timeExtentComp ? ([new Date(timeExtentComp.minTime), new Date(timeExtentComp.maxTime)] as unknown as [Date, Date]) : undefined,
                isTimeScale: true,
                phase: chartPhase,
                isLoaded,
              }}
            />
          )}
          <SegmentOverlay
            selection={compSelection}
            innerWidth={innerWidthComp}
            innerHeight={heightPxComp - margin.top - margin.bottom}
            marginLeft={margin.left}
            marginTop={margin.top}
            components={segChildrenComp}
          />
          {overlayRenderedComposed ? (
            <ProjectionMarkerOverlay
              width={width}
              height={heightPxComp}
              margin={margin}
              terminalMarkers={composedTerminalAnchors}
              projectionEndMarkers={composedEndAnchors}
              phasePort={projectionPhasePortRef}
            />
          ) : null}
          {tooltipEnabled ? (
            <div
              ref={overlayHostRef}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            />
          ) : null}
        </>
      ) : null}
    </div>
    </ChartSelectionContext.Provider>
  );
}
