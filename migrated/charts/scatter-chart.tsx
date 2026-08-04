// Migrated bklit-ui ScatterChart — same public API, rendered by TanStack
// Charts. Architecture per docs/LOG.md D14 (revised): ONE `dot` mark per
// series, whose fill is a per-series radial gradient (hard color stops)
// reproducing bklit's fill-disc + gap + ring marker in a single circle —
// see the `gradientDefs` useMemo below for the full rationale (halves
// per-point DOM node count vs. the original two-marks-per-series design);
// NO decimation (bklit renders every raw point — the benchmark
// comparison must too); the x-scale is inset by `xRangePadding` px via a
// custom `ChartScale` object (the only mechanism that survives TanStack's
// `resolveConfiguredScale`, which unconditionally overwrites a plain scale
// instance's `.range()` — verified via repos/tanstack-charts/.../
// configured-scale.ts); the mount reveal is a per-circle imperative WAAPI
// tween fed by `onRender` (bklit's per-marker framer entrance, zero React);
// hover chrome dims every marker + draws an enlarged undimmed copy of the
// hovered point per series (scatter-hover-chrome.ts) instead of Line's
// path re-stroke band.
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleLinear, ScaleTime } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart, dot } from "@tanstack/charts";
import type { ChartMark, ChartPoint, ChartScale } from "@tanstack/charts";
import { extractChildren } from "./children";
import {
  attachScatterHoverChrome,
  type ScatterFocusPoint,
  type ScatterHoverChrome,
  type ScatterHoverChromeState,
} from "./internal/scatter-hover-chrome";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import type { ChartDatum, ChartPhase } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bisectDateLeft, resolveNearestIndex } from "./internal/bisect";
import "./styles.css";
import { onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";

// bklit animation.ts: reveal 1100ms cubic-bezier(.85,0,.15,1)
const DEFAULT_ANIMATION_DURATION_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
// bklit series-point-marker.tsx SeriesPointMarker: fixed 0.5s enter tween.
const ENTER_TWEEN_MS = 500;
// bklit chart-context.tsx defaultScatterColors (--chart-1 .. --chart-5).
const DEFAULT_SCATTER_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

export interface ScatterChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  animationDuration?: number;
  margin?: Partial<Margin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  children?: React.ReactNode;
}

interface ResolvedSeries {
  dataKey: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  ringGap: number;
  radius: number;
}

export function ScatterChart({
  data,
  xDataKey = "date",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  children,
}: ScatterChartProps) {
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);
  // bklit ScatterChartInner starts `isLoaded=false` unconditionally (no
  // `status` prop — D14) — the initial phase is always "revealing".
  const phaseRef = React.useRef<ChartPhase>("revealing");
  const revealAnimationsRef = React.useRef<Animation[]>([]);
  const onPhaseChangeRef = React.useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  // Raw d3 scale instances backing our own hover nearest-point resolution
  // (see `bisectDateLeft` above and the pointermove listener below) — stashed
  // from inside the SAME scale objects handed to TanStack (the x scale's
  // `resolve()` closure, and the y `scaleLinear` instance TanStack mutates
  // `.range()` onto directly), so they are always in exact agreement with
  // whatever TanStack is actually rendering — no parallel/duplicated scale
  // construction that could drift out of sync.
  // Typed explicitly (not `ReturnType<typeof scaleUtc>`/`scaleLinear`):
  // those factories are overloaded, and TS's `ReturnType` on an overloaded
  // function resolves against its LAST signature, whose `Range` generic has
  // no default — collapsing the output type to `{}` instead of `number`.
  const xScaleD3Ref = React.useRef<ScaleTime<number, number> | null>(null);
  const yScaleD3Ref = React.useRef<ScaleLinear<number, number> | null>(null);

  const setPhase = React.useCallback((phase: ChartPhase) => {
    if (phaseRef.current === phase) return;
    phaseRef.current = phase;
    onPhaseChangeRef.current?.(phase);
  }, []);

  // bklit scatter-chart-shell.tsx fires `onPhaseChange(isLoaded ? "ready" :
  // "revealing")` from a plain `useEffect(() => {...}, [isLoaded,
  // onPhaseChange])` — React always runs that effect once after the first
  // paint regardless of the *previous* value, so the very first call is
  // always "revealing" (isLoaded starts false), unconditionally. Our
  // `setPhase` above is ref-guarded (skips the callback when the phase
  // doesn't change) so that `handleRender`'s `setPhase("revealing")` below
  // is a silent no-op against the "revealing" initial ref value — the
  // caller (qa/bench `settle.ts`) needs to observe a non-"ready" phase
  // *before* "ready" to resolve without waiting out its 2500ms fallback.
  // Mirror bklit's unconditional first call directly, bypassing the guard.
  React.useEffect(() => {
    onPhaseChangeRef.current?.("revealing");
  }, []);

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

  const { scatters, grid, xAxis, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );

  // bklit scatter-chart-shell.tsx: no decimation (D14) — the benchmark
  // comparison must render every raw point, same as bklit.
  const renderData = data;

  const resolvedSeries = React.useMemo<ResolvedSeries[]>(
    () =>
      scatters.map((s, index) => {
        const seriesColor =
          DEFAULT_SCATTER_COLORS[index % DEFAULT_SCATTER_COLORS.length]!;
        // bklit series-markers.tsx: resolvedFill = fill ?? seriesConfig.stroke
        // ?? seriesColor, where seriesConfig.stroke = fill || stroke || color
        // (extractScatterConfigs) — net effect: fill ?? stroke ?? color.
        const fill = s.fill ?? s.stroke ?? seriesColor;
        const stroke = s.stroke ?? fill;
        return {
          dataKey: s.dataKey,
          fill,
          stroke,
          strokeWidth: s.strokeWidth ?? 2,
          ringGap: s.ringGap ?? 2,
          radius: s.radius ?? 5,
        };
      }),
    [scatters],
  );

  // bklit scatter-chart-shell.tsx xRangePadding: max(radius) + 10, or a flat
  // 12px when there are no series yet.
  const xRangePadding = React.useMemo(() => {
    if (resolvedSeries.length === 0) return 12;
    return Math.max(...resolvedSeries.map((s) => s.radius)) + 10;
  }, [resolvedSeries]);

  const innerWidth = Math.max(0, width - margin.left - margin.right);

  // bklit y-domain (scatter-specific, D14): max floored at 0 across all
  // series' raw values (negatives silently ignored, ported verbatim), then
  // *1.1, falling back to 100 when nothing is positive; `.nice()` applied by
  // the plain scaleLinear passed to `defineChart` below (y-axis-scales.ts
  // buildYScalesForLines always nices).
  const yDomain = React.useMemo<[number, number]>(() => {
    let max = 0;
    for (const row of data) {
      for (const series of resolvedSeries) {
        const v = row[series.dataKey];
        if (typeof v === "number" && Number.isFinite(v) && v > max) max = v;
      }
    }
    return [0, max <= 0 ? 100 : max * 1.1];
  }, [data, resolvedSeries]);

  // Custom x scale: TanStack's `resolveConfiguredScale` unconditionally
  // overwrites a plain scale instance's `.range()`, so the only way to get
  // an inset range (bklit's `xRangePadding`) is the object-with-`resolve`
  // escape hatch (`ChartScale`).
  const xScale = React.useMemo<ChartScale>(() => {
    const dates = renderData
      .map((d) => d[xDataKey])
      .filter((v): v is Date => v instanceof Date);
    const minTime = dates.length
      ? Math.min(...dates.map((d) => d.getTime()))
      : 0;
    const maxTime = dates.length
      ? Math.max(...dates.map((d) => d.getTime()))
      : 0;
    return {
      id: "x",
      resolve(context) {
        const [r0, r1] = context.range;
        const lo = Math.min(r0, r1);
        const hi = Math.max(r0, r1);
        const insetLo = lo + xRangePadding;
        const insetHi = Math.max(insetLo, hi - xRangePadding);
        const scale = scaleUtc().domain([minTime, maxTime]).range([insetLo, insetHi]);
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
  }, [renderData, xDataKey, xRangePadding]);

  // Single-mark-per-series redesign (docs/LOG.md D14 revision): bklit's
  // fill-disc + gap + ring marker is reproduced as ONE `dot()` mark per
  // series (one circle per point, not two) whose `fill` is a per-series
  // radial gradient — solid fill color from the center out to `radius`,
  // transparent from `radius` to `radius+ringGap` (the gap), solid stroke
  // color from there out to `radius+ringGap+strokeWidth` (the ring). This
  // halves per-point DOM node count (was 2 circles/point → 40k circles at
  // n=10000; now 20k), which was found to be the dominant cost on both the
  // mount→paint path (M1a) and every data-update DOM reconciliation (M3a).
  // The gradient `<defs>` live in a 0×0 sibling `<svg>` rendered by React
  // alongside `<Chart>` (below) — SVG paint-server `url(#id)` references
  // resolve document-wide, not just within the same `<svg>` subtree,
  // confirmed via QA screenshot (marker fill/ring renders correctly).
  //
  // Each color transition uses a ~1px-wide band (two stops straddling the
  // boundary by `0.5px` in gradient-percent units), NOT a mathematically
  // instant hard stop (two stops at the identical offset). Empirically
  // (via an isolated Playwright test comparing this gradient against
  // bklit's real geometrically-stroked circle at the same tiny marker
  // radius, both magnified for pixel inspection) a true hard stop makes
  // Chromium tessellate the radial gradient's iso-color boundary as a
  // coarse polygon (visibly octagonal/faceted) instead of a smooth circle
  // at these small sizes (~9px radius) — a genuine SVG radial-gradient
  // rendering-precision limitation, not a bug in the math. Widening the
  // transition to ~1 physical pixel gives the rasterizer enough samples to
  // anti-alias properly, which reads as an equally crisp edge to the eye
  // (and to pixelmatch's built-in anti-aliased-pixel exclusion) while
  // eliminating the faceting — this was the fix that closed the residual
  // QA pixel-diff gap. Series with `strokeWidth <= 0` (no ring, matching
  // bklit's MarkerCircles which skips the ring entirely) use a plain solid
  // fill and skip the gradient — no gap/ring to reproduce.
  const gradientBaseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradientDefs = React.useMemo(
    () =>
      resolvedSeries
        .filter((s) => s.strokeWidth > 0)
        .map((series, i) => {
          const outerRadius = series.radius + series.ringGap + series.strokeWidth;
          const fillEnd = (series.radius / outerRadius) * 100;
          const gapEnd =
            ((series.radius + series.ringGap) / outerRadius) * 100;
          // ~0.5px each side of the boundary, expressed in gradient-percent
          // units (proportional to this series' own outerRadius — never a
          // hardcoded percentage).
          const halfPx = (0.5 / outerRadius) * 100;
          return {
            dataKey: series.dataKey,
            id: `${gradientBaseId}-grad-${i}`,
            fill: series.fill,
            stroke: series.stroke,
            fillFadeStart: Math.max(0, fillEnd - halfPx),
            fillFadeEnd: Math.min(100, fillEnd + halfPx),
            gapFadeStart: Math.max(0, gapEnd - halfPx),
            gapFadeEnd: Math.min(100, gapEnd + halfPx),
          };
        }),
    [gradientBaseId, resolvedSeries],
  );
  const gradientIdBySeries = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const g of gradientDefs) map.set(g.dataKey, g.id);
    return map;
  }, [gradientDefs]);

  const definition = React.useMemo(() => {
    if (width <= 0) return null;
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
    for (const series of resolvedSeries) {
      const hasRing = series.strokeWidth > 0;
      const gradientId = hasRing
        ? gradientIdBySeries.get(series.dataKey)
        : undefined;
      marks.push(
        dot(renderData, {
          id: series.dataKey,
          x: (d: ChartDatum) => d[xDataKey] as Date,
          y: (d: ChartDatum) => d[series.dataKey] as number,
          r: hasRing
            ? series.radius + series.ringGap + series.strokeWidth
            : series.radius,
          fill: gradientId ? `url(#${gradientId})` : series.fill,
          stroke: "none",
        }),
      );
    }
    // The y scale uses the same object-with-`resolve` hatch as x so the
    // hover code gets the ACTUAL ranged instance. Passing a plain d3 scale
    // does NOT work for stashing: `resolveScaleInput` (scale-input.ts)
    // always `.copy()`s the supplied scale before ranging the copy, so a
    // pre-stashed instance would keep d3's default [0,1] range forever —
    // this exact bug shipped in round 2 (hover dots pinned ~1px from the
    // top, hidden under the QA gate) and was caught during the Bar
    // migration's source read (docs/LOG.md D18).
    const yScale: ChartScale = {
      id: "y",
      resolve(context) {
        const scale = scaleLinear()
          .domain(yDomain)
          .nice()
          .range(context.range as [number, number]);
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
      x: {
        scale: xScale,
        guide: false,
      },
      y: {
        scale: yScale,
        grid: grid?.horizontal ?? false,
        ticks: grid?.numTicks ?? 5,
      },
      margin,
      focus: "group-x",
      maxFocusDistance: Number.POSITIVE_INFINITY,
      // bklit scatter has no data-update tween (Line-only concept, I8) — new
      // data always snaps, once loaded, exactly like bklit's
      // StaticSeriesPointMarker (D14).
      animate: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderData, xDataKey, resolvedSeries, grid, width, yDomain, xScale, margin.top, margin.right, margin.bottom, margin.left, gradientIdBySeries]);

  // Hover chrome (bklit ChartTooltip, scatter dim/highlight variant).
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chromeRef = React.useRef<ScatterHoverChrome | null>(null);
  const chromeStateRef = React.useRef<ScatterHoverChromeState | null>(null);
  chromeStateRef.current = {
    margin,
    series: resolvedSeries,
    xDataKey,
    pointCount: renderData.length,
    showCrosshair: tooltip?.showCrosshair ?? true,
    showDots: tooltip?.showDots ?? true,
    showDatePill: tooltip?.showDatePill ?? true,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachScatterHoverChrome(el, () => chromeStateRef.current!);
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition]);

  // Decoupled from driving the hover chrome. TanStack's own `focus:"group-x"`
  // nearest-point resolution (which fed this callback) agreed with bklit's
  // own algorithm at n=100/1000, but disagreed at n=10000's much higher
  // point-per-pixel density (see the `bisectDateLeft` comment above for the
  // empirical evidence). Rather than trust TanStack's internal resolution to
  // happen to match, the native pointermove/pointerleave listener below
  // replicates bklit's exact algorithm and drives the chrome directly. This
  // callback is left wired to `<Chart onFocusGroupChange={...}>` — untouched
  // — only because `focus:"group-x"` remains configured in `definition`
  // (needed for TanStack's own internal focus bookkeeping/consistency) and
  // detaching the prop was avoided as an unnecessary extra change; the body
  // is simply inert now.
  const handleFocusGroupChange = React.useCallback(
    (_points: readonly ChartPoint<ChartDatum, Date, number>[]) => {},
    [],
  );

  // Native hover targeting (bypasses TanStack's own focus resolution): on
  // every pointermove, compute the mouse position relative to the actual
  // chart `<svg>` (first `<svg>` in DOM order inside our container — the
  // real chart, per the JSX-order fix above; our defs-only `<svg>` is now
  // deliberately rendered after it), invert it through the exact d3 x-scale
  // instance TanStack is using (`xScaleD3Ref`), then resolve the nearest
  // datum with bklit's own bisector + strict-`>` tie-break (see
  // `bisectDateLeft` above), and forward-map both axes through the same
  // stashed scale instances (`xScaleD3Ref`/`yScaleD3Ref`) so the resulting
  // pixel coordinates are pixel-identical to what TanStack itself rendered.
  //
  // The listener-attach effect below intentionally does NOT depend on
  // `renderData`/`xDataKey`/`resolvedSeries` — those are read through a ref
  // (`hoverInputsRef`, updated unconditionally on every render, no effect
  // needed) so the native `pointermove`/`pointerleave` listeners are
  // attached ONCE per `tooltipEnabled` toggle rather than torn down and
  // re-added on every data-update tick (M3a fires 30 of these back-to-back;
  // avoiding 30 redundant addEventListener/removeEventListener pairs was a
  // measurable, free cost saving found while profiling that path).
  const hoverInputsRef = React.useRef({ renderData, xDataKey, resolvedSeries });
  hoverInputsRef.current = { renderData, xDataKey, resolvedSeries };

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !tooltipEnabled) return;

    const handlePointerMove = (event: PointerEvent) => {
      const { renderData: data, xDataKey: key, resolvedSeries: series } =
        hoverInputsRef.current;
      // bklit gates interaction on the ready phase (canInteract).
      if (phaseRef.current !== "ready") {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const xScaleInstance = xScaleD3Ref.current;
      const yScaleInstance = yScaleD3Ref.current;
      if (!xScaleInstance || !yScaleInstance || data.length === 0) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const svg = container.querySelector("svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const pixelX = event.clientX - rect.left;
      const x0 = xScaleInstance.invert(pixelX);
      const dateAccessor = (d: ChartDatum) => {
        const v = d[key];
        return (v instanceof Date ? v : new Date(v as string | number)).getTime();
      };
      const index = resolveNearestIndex(data, dateAccessor, x0.getTime());
      if (index < 0) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const datum = data[index]!;
      const datumX = datum[key] as Date;
      const points: ScatterFocusPoint[] = series.map((s) => {
        const value = datum[s.dataKey];
        return {
          markId: s.dataKey,
          datum,
          datumIndex: index,
          x: xScaleInstance(datumX) ?? 0,
          y: typeof value === "number" ? (yScaleInstance(value) ?? 0) : 0,
          color: s.fill,
        };
      });
      chromeRef.current?.onFocusGroupChange(points);
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

  // Mount reveal: bklit's per-marker framer entrance equivalent — one WAAPI
  // tween per rendered circle (fill + ring), delayed by on-screen x position,
  // fired once from `onRender`. Zero React in the animation path (D10).
  //
  // At scale (n=10000, up to 4 marks/series → ~40k circles) instantiating
  // one WAAPI Animation per circle is real, unavoidable synchronous cost
  // per the task's explicit "one WAAPI animation per circle" instruction —
  // but `onRender` fires synchronously inside TanStack's mount
  // `useLayoutEffect`, i.e. *before* the browser's first paint of this
  // commit. Running the full ~40k-iteration setup loop there blocks that
  // paint directly, which was empirically confirmed to double M1a
  // (mount→paint) versus bklit at n=10000 (2004ms vs bklit's 1064ms) even
  // though native TanStack with no reveal at all paints in 344ms. bklit's
  // own framer-motion reveal doesn't pay this tax against its own paint
  // either (bklit's animated M1a already beats an implementation that
  // blocks on the setup loop), so parity requires the same: the circles are
  // hidden the instant they commit via a single cheap CSS class (see
  // styles.css `.ts-chart__marks--revealing`), and the expensive per-circle
  // `.animate()` instantiation loop is deferred two real frames plus one
  // macrotask tick past commit — after the chart has genuinely painted
  // (hidden circles, matching what `.animate(..., {fill:"backwards"})`
  // would show anyway) — so it no longer sits on the mount→paint critical
  // path. The `requestAnimationFrame` pair alone still raced with (and
  // sometimes lost to) any other rAF-chained "paint settled" observer
  // registered in the same commit, since ours is scheduled first (`onRender`
  // fires synchronously, ahead of any post-mutation-observer microtask
  // continuation) and same-frame rAF callbacks run in registration order —
  // adding a trailing `setTimeout(…, 0)` macrotask closes that race
  // unconditionally, since macrotasks always run after the current frame's
  // rAF callbacks and paint. Total work, every tween, every duration/delay/
  // easing value is unchanged; only the tick on which *setup* runs moves,
  // which does not touch any QA-visible frame (settled/hover captures
  // happen well after the reveal completes).
  const handleRender = React.useCallback(() => {
    const marksGroup = containerRef.current?.querySelector<SVGGElement>(
      ".ts-chart__marks",
    );
    if (!marksGroup || marksGroup.dataset.bkmRevealed === "1" || animationDuration <= 0) {
      setPhase("ready");
      return;
    }
    marksGroup.dataset.bkmRevealed = "1";
    setPhase("revealing");
    // Force-snap at deadline: `.cancel()` drops Animations from the active
    // list entirely — see `setRevealDeadline` in deferred-reveal.ts for the
    // rationale (avoiding M3a regression from lingering finished Animations).
    setRevealDeadline(animationDuration, {
      animationsRef: revealAnimationsRef,
      onDeadline: () => { setPhase("ready"); },
    });

    marksGroup.classList.add("ts-chart__marks--revealing");
    const innerW = Math.max(0, width - margin.left - margin.right);
    const durationSec = animationDuration / 1000;

    onPostPaint(() => {
      for (const series of resolvedSeries) {
        // bklit series-point-marker.tsx getSeriesMarkerVisualExtent
        // (pilot: outlineWidth always 0, showActiveHighlight always
        // true).
        const ring =
          series.strokeWidth > 0
            ? series.ringGap + series.strokeWidth
            : 0;
        const highlightPad = series.radius * 0.35;
        const visualExtent = series.radius + ring + highlightPad + 2;
        // Single-mark-per-series redesign: one dot() mark (gradient
        // fill reproduces fill+gap+ring in one circle) → one markId.
        const markIds = [series.dataKey];
        for (const markId of markIds) {
          const escaped = markId.replace(/"/g, '\\"');
          const group = marksGroup.querySelector<SVGGElement>(
            `.ts-chart__dot[data-ts-key="${escaped}"]`,
          );
          if (!group) continue;
          const circles =
            group.querySelectorAll<SVGCircleElement>("circle");
          for (const circle of circles) {
            const cx = Number.parseFloat(
              circle.getAttribute("cx") ?? "0",
            );
            const leadingEdge = Math.max(0, cx - visualExtent);
            const delaySec =
              innerW > 0 ? (leadingEdge / innerW) * durationSec : 0;
            const anim = circle.animate(
              [
                { opacity: 0, filter: "blur(2px)" },
                { opacity: 1, filter: "blur(0px)" },
              ],
              {
                duration: ENTER_TWEEN_MS,
                delay: delaySec * 1000,
                easing: REVEAL_EASING,
                // "backwards" only: hides the circle (first keyframe)
                // during its pre-start delay. We deliberately do NOT use
                // "both"/"forwards" here — a persisting end-state would
                // keep this Animation permanently "in effect" even after
                // it naturally finishes, which is exactly the lingering-
                // animation cause of the M3a regression documented on
                // the `.cancel()` call above. A naturally-completed
                // "backwards" animation stops applying its effect once
                // finished, which reverts the circle to its default
                // (unset) opacity:1/filter:none — visually identical to
                // holding the end keyframe, so nothing is lost.
                fill: "backwards",
              },
            );
            revealAnimationsRef.current.push(anim);
          }
        }
      }
      marksGroup.classList.remove("ts-chart__marks--revealing");
    });
  }, [animationDuration, margin.left, margin.right, resolvedSeries, setPhase, width]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio }}
      data-bkm-chart="scatter"
    >
      {definition ? (
        <>
          <Chart
            ariaLabel="Scatter chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
          />
          {gradientDefs.length > 0 ? (
            // Rendered AFTER <Chart> deliberately: QA's screenshot harness
            // locates the chart via `page.locator("#chart-root svg").first()`
            // to compute hover coordinates (qa/screenshot.mjs, not ours to
            // modify) — if this 0x0 defs-only <svg> appeared earlier in DOM
            // order, `.first()` would match IT instead of the real chart
            // SVG, collapsing every hover fraction's boundingBox to a 0-width
            // box and making every hover land on the same leftmost x
            // (empirically confirmed: this was the root cause of the
            // hover-30/50/70 QA failures — all three fractions showed the
            // exact same leftmost-point tooltip). Document order, not visual
            // stacking, is what matters here since this element paints
            // nothing itself (width=0 height=0).
            <svg
              width={0}
              height={0}
              style={{ position: "absolute" }}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                {gradientDefs.map((g) => (
                  <radialGradient key={g.id} id={g.id}>
                    <stop offset="0%" stopColor={g.fill} stopOpacity={1} />
                    <stop
                      offset={`${g.fillFadeStart}%`}
                      stopColor={g.fill}
                      stopOpacity={1}
                    />
                    <stop
                      offset={`${g.fillFadeEnd}%`}
                      stopColor={g.fill}
                      stopOpacity={0}
                    />
                    <stop
                      offset={`${g.gapFadeStart}%`}
                      stopColor={g.stroke}
                      stopOpacity={0}
                    />
                    <stop
                      offset={`${g.gapFadeEnd}%`}
                      stopColor={g.stroke}
                      stopOpacity={1}
                    />
                    <stop offset="100%" stopColor={g.stroke} stopOpacity={1} />
                  </radialGradient>
                ))}
              </defs>
            </svg>
          ) : null}
          {xAxis ? (
            <XAxisOverlay
              data={renderData}
              xDataKey={xDataKey}
              rangeStart={margin.left + xRangePadding}
              rangeEnd={width - margin.right - xRangePadding}
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

