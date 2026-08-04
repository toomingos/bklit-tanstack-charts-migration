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
import type { ChartMark, ChartPoint } from "@tanstack/charts";
import { areaFill } from "./internal/area-fill-mark";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { extractChildren } from "./children";
import {
  attachHoverChrome,
  type HoverChrome,
  type HoverChromeState,
} from "./internal/hover-chrome";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import type { ChartDatum, ChartPhase, ChartStatus } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
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
  children?: React.ReactNode;
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
  children,
}: AreaChartProps) {
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);
  const phaseRef = React.useRef<ChartPhase>(status === "ready" ? "ready" : "loading");
  const onPhaseChangeRef = React.useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const setPhase = React.useCallback((phase: ChartPhase) => {
    if (phaseRef.current === phase) return;
    phaseRef.current = phase;
    onPhaseChangeRef.current?.(phase);
  }, []);

  // Container measurement (bklit measures via ParentSize before rendering;
  // we do the same with one ResizeObserver — chart mounts on first measure).
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const { areas, grid, xAxis, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );

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
        };
      }),
    [areas],
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const renderData = React.useMemo(() => {
    if (innerWidth <= 0) return data;
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      resolvedAreas.map((a) => a.dataKey),
    );
  }, [data, innerWidth, resolvedAreas]);

  // bklit y-domain parity — exact port of time-series-chart-shell.tsx
  // `resolveTimeSeriesYDomain` + `niceYDomain` (d3 .nice() applied by the
  // configured scale below): all-values>=0 -> [0, max*1.1]; mixed-sign ->
  // [min,max] padded 5% each side; empty -> [0,100]. Identical logic to
  // migrated line-chart.tsx (the shared shell is the same for both charts),
  // scoped to `resolvedAreas` dataKeys.
  const yDomain = React.useMemo<[number, number]>(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of data) {
      for (const area of resolvedAreas) {
        const v = row[area.dataKey];
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
  }, [data, resolvedAreas]);

  // bklit data-update behavior (chart-phase.ts): new data paints IMMEDIATELY;
  // only a y-DOMAIN change tweens (500ms scale tween). bklit's Area has no
  // path-morph equivalent to a hypothetical `useAnimatedSeriesPath` (it
  // never had one — that's Line-specific machinery bklit doesn't ship for
  // Area either), so this is exactly Line's existing conditional: animate
  // the scene only when the nice domain actually moved, otherwise snap.
  const nicedYDomain = React.useMemo<[number, number]>(
    () => scaleLinear().domain(yDomain).nice().domain() as [number, number],
    [yDomain],
  );
  const prevNicedYDomainRef = React.useRef(nicedYDomain);
  const yDomainChanged =
    prevNicedYDomainRef.current[0] !== nicedYDomain[0] ||
    prevNicedYDomainRef.current[1] !== nicedYDomain[1];
  prevNicedYDomainRef.current = nicedYDomain;

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

  const definition = React.useMemo(() => {
    if (width <= 0) return null;
    // Typed accessors (ChartDatum values are `unknown`, so bare key strings
    // don't satisfy TanStack's ChannelAccessor value types); the explicit
    // element type keeps defineChart's D/X/Y inference concrete.
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
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
    // Single-object form: definition options live in the spec (the two-arg
    // overload only accepts an already-built definition, and infers D/X/Y
    // from phantom fields a raw spec object doesn't carry).
    return defineChart({
      marks,
      x: {
        scale: scaleUtc,
        guide: false,
      },
      y: {
        scale: scaleLinear().domain(yDomain).nice(),
        grid: grid?.horizontal ?? false,
        ticks: grid?.numTicks ?? 5,
      },
      margin,
      focus: "group-x",
      // bklit's hover works anywhere over the plot; TanStack defaults to 48px.
      maxFocusDistance: Number.POSITIVE_INFINITY,
      animate:
        phaseRef.current === "ready" && yDomainChanged
          ? { duration: DATA_TWEEN_MS, easing: bezierEasing }
          : false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderData, xDataKey, resolvedAreas, gradientIdBySeries, grid, width, yDomain, margin.top, margin.right, margin.bottom, margin.left]);

  // Hover chrome (bklit ChartTooltip): imperative overlays driven by
  // TanStack's focus callbacks — no React work per pointer move. Reuses
  // Line's exact chrome, dim opacity parameterized to Area's 0.6 (Line
  // keeps its own 0.3 default — see internal/hover-chrome.ts). Focus-point
  // dedup: `onFocusGroupChange` receives one ChartPoint per MARK at the
  // focused x (both the areaY fill mark AND the lineY boundary mark emit a
  // point for the same datum/coordinate), but `chromeStateRef.series` below
  // lists each series by its LINE id (`area.dataKey`, not
  // `${area.dataKey}__fill`) — the chrome's `pointByMark` Map is keyed by
  // markId, so `pointByMark.get(series.dataKey)` only ever resolves the
  // lineY point; the areaY point (stored under the sibling `__fill` key)
  // is simply never looked up. No explicit filtering needed.
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chromeRef = React.useRef<HoverChrome | null>(null);
  const chromeStateRef = React.useRef<HoverChromeState | null>(null);
  // Scene x of rendered point `index` — same linear time→px mapping TanStack's
  // scaleUtc applies over [first, last] → [margin.left, width - margin.right].
  const xForIndex = (index: number) => {
    const first = renderData[0]?.[xDataKey];
    const last = renderData[renderData.length - 1]?.[xDataKey];
    const value = renderData[index]?.[xDataKey];
    if (
      !(first instanceof Date && last instanceof Date && value instanceof Date)
    ) {
      return margin.left;
    }
    const range = last.getTime() - first.getTime();
    if (range <= 0) return margin.left;
    return (
      margin.left +
      ((value.getTime() - first.getTime()) / range) * innerWidth
    );
  };
  chromeStateRef.current = {
    margin,
    series: resolvedAreas.map((area) => ({
      dataKey: area.dataKey,
      color: area.stroke,
      strokeWidth: area.strokeWidth,
      showHighlight: area.showHighlight,
    })),
    xDataKey,
    pointCount: renderData.length,
    xForIndex,
    showCrosshair: tooltip?.showCrosshair ?? true,
    showDots: tooltip?.showDots ?? true,
    showDatePill: tooltip?.showDatePill ?? true,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachHoverChrome(el, () => chromeStateRef.current!, {
      dimOpacity: AREA_DIM_OPACITY,
    });
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition]);

  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      // bklit gates interaction on the ready phase (canInteract).
      chromeRef.current?.onFocusGroupChange(
        phaseRef.current === "ready" ? points : [],
      );
    },
    [],
  );

  // Mount reveal: bklit's ChartRevealClip equivalent — clip the marks group
  // (area fill + boundary line together, exactly like bklit's single
  // chart-level clipPath over all series) left→right once, via WAAPI. Runs
  // outside React; fires phase transitions. Identical to migrated Line's.
  const handleRender = React.useCallback(() => {
    const marks = containerRef.current?.querySelector<SVGGElement>(
      ".ts-chart__marks",
    );
    if (!marks || marks.dataset.bkmRevealed === "1" || animationDuration <= 0) {
      setPhase("ready");
      return;
    }
    marks.dataset.bkmRevealed = "1";
    setPhase("revealing");
    const anim = marks.animate(
      [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: animationDuration, easing: REVEAL_EASING },
    );
    anim.onfinish = () => setPhase("ready");
  }, [animationDuration, setPhase]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio }}
      data-bkm-chart="area"
      // bklit area.tsx fadeEdges default FALSE (differs from Line) — only
      // rendered when every series explicitly opts in, reusing the same
      // marks-group mask technique as Line (styles.css); only boolean
      // `true` is implemented, matching the accepted Line precedent for
      // "left"/"right" (docs/LOG.md D13c) — the demo/bench path never sets
      // this, so it's accept-but-inert there by construction.
      data-bkm-fade-edges={
        resolvedAreas.length > 0 &&
        resolvedAreas.every((a) => a.fadeEdges === true)
          ? ""
          : undefined
      }
    >
      {definition ? (
        <>
          <Chart
            ariaLabel="Area chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
          />
          {gradientDefs.length > 0 ? (
            // Rendered AFTER <Chart> deliberately — same reasoning as
            // scatter-chart.tsx: the QA harness locates the chart via the
            // first `<svg>` in the container, which must stay the real
            // chart surface.
            <svg
              width={0}
              height={0}
              style={{ position: "absolute" }}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                {gradientDefs.map((g) => (
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

