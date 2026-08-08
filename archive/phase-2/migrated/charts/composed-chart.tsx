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
import { XAxisOverlay } from "./internal/x-axis-overlay";
import type {
  AreaConfig,
  ChartDatum,
  ChartPhase,
  ChartTooltipConfig,
  GridConfig,
  LineConfig,
  SeriesBarConfig,
  XAxisConfig,
} from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import { bisectDateLeft, resolveNearestIndex } from "./internal/bisect";
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
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);
  // bklit ComposedChartProps has no `status` prop — the initial phase is
  // always "loading" unconditionally (unlike Line/Area, which default to
  // "ready"; matching bklit's own ChartInner, which never reads a status
  // prop). Since this differs from the first real transition ("revealing",
  // set by handleRender), no ref-guard-bypass effect is needed — same as
  // Line/Area's simpler convention, unlike Scatter/Bar.
  const phaseRef = React.useRef<ChartPhase>("loading");
  const revealAnimationsRef = React.useRef<Animation[]>([]);
  const revealDeadlineRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealSetupRafRef = React.useRef<number | null>(null);
  const revealSetupTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const widthTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWidthRef = React.useRef<number | null>(null);
  const mountedRef = React.useRef(true);
  const onPhaseChangeRef = React.useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  // Raw d3 scale instances backing our own hover bisector (see scatter-
  // chart.tsx for the identical stash-via-ChartScale-resolve-closure
  // rationale) — kept in exact agreement with whatever TanStack is actually
  // rendering, no parallel scale construction.
  const xScaleD3Ref = React.useRef<ScaleTime<number, number> | null>(null);
  const yScaleD3Ref = React.useRef<ScaleLinear<number, number> | null>(null);

  const setPhase = React.useCallback((phase: ChartPhase) => {
    if (phaseRef.current === phase) return;
    phaseRef.current = phase;
    onPhaseChangeRef.current?.(phase);
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (revealSetupRafRef.current !== null) {
        cancelAnimationFrame(revealSetupRafRef.current);
        revealSetupRafRef.current = null;
      }
      if (revealSetupTimerRef.current !== null) {
        clearTimeout(revealSetupTimerRef.current);
        revealSetupTimerRef.current = null;
      }
      if (revealDeadlineRef.current !== null) {
        clearTimeout(revealDeadlineRef.current);
        revealDeadlineRef.current = null;
      }
      if (widthTimerRef.current !== null) {
        clearTimeout(widthTimerRef.current);
        widthTimerRef.current = null;
      }
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

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const commitWidth = (w: number) => {
      if (widthTimerRef.current !== null) {
        clearTimeout(widthTimerRef.current);
        widthTimerRef.current = null;
      }
      pendingWidthRef.current = w;
      widthTimerRef.current = setTimeout(() => {
        const pending = pendingWidthRef.current;
        widthTimerRef.current = null;
        if (pending === null) return;
        setWidth((prev) => (Math.abs(prev - pending!) > 0.5 ? pending! : prev));
      }, 10);
    };
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      commitWidth(w);
    });
    ro.observe(el);
    commitWidth(el.getBoundingClientRect().width);
    return () => {
      ro.disconnect();
      if (widthTimerRef.current !== null) {
        clearTimeout(widthTimerRef.current);
        widthTimerRef.current = null;
      }
    };
  }, []);

  const { barConfigs, areaConfigs, lineConfigs, composedSeries, grid, xAxis, tooltip } =
    React.useMemo(() => extractComposed(children), [children]);

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
  // series (bar shim included) over RAW `data` — same algorithm as Line/Area,
  // scoped to `composedSeries` instead of a single-role list.
  const yDomain = React.useMemo<[number, number]>(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of data) {
      for (const series of composedSeries) {
        const v = row[series.dataKey];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (!Number.isFinite(min)) return [0, 100];
    if (min >= 0) return [0, max <= 0 ? 100 : max * 1.1];
    const padding = (max - min) * 0.05 || 1;
    return [min - padding, max + padding];
  }, [data, composedSeries]);

  // bklit data-update behavior (I8): animate the scene only when the nice
  // y-domain actually moved, otherwise snap — identical to Line/Area.
  const nicedYDomain = React.useMemo<[number, number]>(
    () => scaleLinear().domain(yDomain).nice().domain() as [number, number],
    [yDomain],
  );
  const prevNicedYDomainRef = React.useRef(nicedYDomain);
  const yDomainChanged =
    prevNicedYDomainRef.current[0] !== nicedYDomain[0] ||
    prevNicedYDomainRef.current[1] !== nicedYDomain[1];
  prevNicedYDomainRef.current = nicedYDomain;

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
          xAccessor: (d: ChartDatum) => d[xDataKey] as Date,
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
          x: (d: ChartDatum) => d[xDataKey] as Date,
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
          x: (d: ChartDatum) => d[xDataKey] as Date,
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
          x: (d: ChartDatum) => d[xDataKey] as Date,
          y: (d: ChartDatum) => d[line.dataKey] as number,
          curve: d3Curve(line.curve),
          stroke: line.stroke,
          strokeWidth: line.strokeWidth,
        }),
      );
    }

    // Custom x scale: full RAW-data range, no inset (unlike Scatter's
    // xRangePadding — Composed has no marker-radius concept to pad for).
    // The object-with-`resolve` escape hatch stashes the real d3 scale
    // instance for our own pointermove bisector (resolveConfiguredScale
    // always `.copy()`s a plain scale instance before ranging it, so a
    // pre-stashed plain instance would never pick up the real range).
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
          const v = d[xDataKey];
          if (v instanceof Date) {
            const t = v.getTime();
            if (t < minTime) minTime = t;
            if (t > maxTime) maxTime = t;
          }
        }
        if (!Number.isFinite(minTime)) {
          minTime = 0;
          maxTime = 0;
        }
        const scale = scaleUtc().domain([minTime, maxTime]).range([r0, r1]);
        xScaleD3Ref.current = scale;
        const ticks = scale.ticks(context.tickCount ?? 5);
        return {
          id: context.id,
          type: "time",
          domain: scale.domain(),
          map: (value: unknown) => {
            const mapped = scale(value as Date);
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
        const scale = scaleLinear().domain(yDomain).nice().range(context.range as [number, number]);
        yScaleD3Ref.current = scale;
        const tickValues = scale.ticks(context.tickCount ?? grid?.numTicks ?? 5);
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
        grid: grid?.horizontal ?? false,
        ticks: grid?.numTicks ?? 5,
      },
      margin,
      focus: "group-x",
      maxFocusDistance: Number.POSITIVE_INFINITY,
      animate:
        phaseRef.current === "ready" && yDomainChanged
          ? { duration: DATA_TWEEN_MS, easing: bezierEasing }
          : false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    yDomain,
    margin.top,
    margin.right,
    margin.bottom,
    margin.left,
  ]);

  // Hover chrome (shared with Line/Area) — imperative overlays driven by OUR
  // OWN native pointermove bisector (below), not TanStack's focus system.
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chromeRef = React.useRef<HoverChrome | null>(null);
  const chromeStateRef = React.useRef<HoverChromeState | null>(null);
  // Scene x of RENDERED (decimated) point `index` — feeds the highlight
  // band's bandStart/bandEnd, which must reference actually-rendered
  // line/area point positions (same contract as Line/Area's xForIndex).
  const xForIndex = (index: number) => {
    const xScaleInstance = xScaleD3Ref.current;
    const row = renderData[index];
    const xValue = row?.[xDataKey];
    if (!xScaleInstance || !(xValue instanceof Date)) return margin.left;
    return xScaleInstance(xValue) ?? margin.left;
  };
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
    bars: resolvedBars.map((b) => ({ dataKey: b.dataKey, fadedOpacity: b.fadedOpacity })),
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachHoverChrome(el, () => chromeStateRef.current!);
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition]);

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
      const {
        data: rawRows,
        renderData: decimatedRows,
        xDataKey: key,
        composedSeries: series,
      } = hoverInputsRef.current;
      // bklit gates interaction on the ready phase (canInteract).
      if (phaseRef.current !== "ready") {
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
        const v = d[key];
        return (v instanceof Date ? v : new Date(v as string | number)).getTime();
      };
      const rawIndex = resolveNearestIndex(rawRows, dateAccessor, x0Ms);
      if (rawIndex < 0) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const decimatedIndex =
        decimatedRows.length > 0 ? resolveNearestIndex(decimatedRows, dateAccessor, x0Ms) : -1;
      const datum = rawRows[rawIndex]!;
      const datumX = datum[key] as string | Date;
      const resolvedX = xScaleInstance(datumX) ?? 0;
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
  }, [tooltipEnabled]);

  // Mount reveal — DOUBLE: the shared clip-path wipe (phase state machine,
  // and bar-overhang padding for free — see file header) PLUS an independent
  // per-bar WAAPI stagger (bar-chart.tsx's exact mechanic, decoupled from the
  // state machine, own `.cancel()` cleanup deadline).
  const handleRender = React.useCallback(() => {
    const marks = containerRef.current?.querySelector<SVGGElement>(".ts-chart__marks");
    if (!marks || marks.dataset.bkmRevealed === "1" || animationDuration <= 0) {
      setPhase("ready");
      return;
    }
    marks.dataset.bkmRevealed = "1";
    setPhase("revealing");
    const clipAnim = marks.animate(
      [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: animationDuration, easing: REVEAL_EASING },
    );
    clipAnim.onfinish = () => setPhase("ready");

    if (resolvedBars.length === 0) return;

    // bklit ChartCore: staggerSpread = data.length>1 ? animationDuration*0.4
    // : 0; per-bar delay = staggerSpread/1000/data.length seconds; cleanup
    // deadline = animationDuration + staggerSpread. The clip-path above
    // already conceals every mark (bars included) from the very first commit
    // frame, so — unlike bar-chart.tsx/scatter-chart.tsx, which have no other
    // hiding mechanism — no separate `.ts-chart__marks--revealing` CSS class
    // is needed here; the deferred setup loop below can safely run behind
    // the clip veil.
    const staggerSpreadMs = data.length > 1 ? animationDuration * 0.4 : 0;
    const staggerDelaySec = data.length > 1 ? staggerSpreadMs / 1000 / data.length : 0;
    const barsDeadlineMs = animationDuration + staggerSpreadMs;

    const outerRaf = requestAnimationFrame(() => {
      revealSetupRafRef.current = requestAnimationFrame(() => {
        revealSetupRafRef.current = null;
        revealSetupTimerRef.current = window.setTimeout(() => {
          revealSetupTimerRef.current = null;
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
                  { height: "0", y: String(baselineY) },
                  { height: String(targetHeight), y: String(targetY) },
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
        }, 0);
      });
    });
    revealSetupRafRef.current = outerRaf;

    // `.cancel()`, not `.finish()` — avoids the D16 lingering-Animations
    // trap (see scatter-chart.tsx/bar-chart.tsx for the full rationale).
    if (revealDeadlineRef.current !== null) clearTimeout(revealDeadlineRef.current);
    revealDeadlineRef.current = window.setTimeout(() => {
      revealDeadlineRef.current = null;
      for (const anim of revealAnimationsRef.current) {
        try {
          anim.cancel();
        } catch {
          // detached DOM
        }
      }
      revealAnimationsRef.current = [];
    }, barsDeadlineMs);
  }, [animationDuration, resolvedBars, setPhase, data.length]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio }}
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
          {gradientDefs.length > 0 ? (
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
  );
}

