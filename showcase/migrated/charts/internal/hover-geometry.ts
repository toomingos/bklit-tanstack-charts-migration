"use client";
// C3: shared native-mark hover geometry for line-chart.tsx / area-chart.tsx
// (composed-chart.tsx wires the pieces it needs directly, since it drives
// focus off its own raw/decimated bisector rather than native `focus:"group-x"`).
// Replaces internal/hover-chrome.ts + internal/use-hover-chrome.ts (both
// deleted in this commit): the crosshair indicator, the hover dots, the
// series pointer-hover dim, and the highlight band are now native marks /
// declarative mark `states` driven by the chart's own focus mechanism — zero
// per-frame imperative DOM writes. The one remaining imperative surface is
// the date-pill overlay, which is APP-OWNED HTML (never `.ts-chart__*`
// renderer DOM) per the sanctioned extension in ./date-pill.
//
// ZERO renderer DOM reach-ins: nothing in this file ever queries
// `.ts-chart__*`. (C4: the axis-label proximity fade that used to live on
// `useDatePillOverlay` moved to the charts' native per-tick
// `tickLabels.opacity` callbacks — see internal/axis-ticks.ts
// `tickLabelFadeOpacity`; the controller is now show/hide/position only.)
import * as React from "react";
import { crosshair } from "@tanstack/charts/crosshair";
import { dot } from "@tanstack/charts/dot";
import { lineY } from "@tanstack/charts/line";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type {
  ChartCurve,
  ChartMark,
  ChartMarkState,
  ChartMarkStateSelector,
} from "@tanstack/charts";
import { resolveIndicatorPixelWidth } from "./tooltip-mappers";
import { crosshairFadeStops } from "./fade-mask";
import { buildPill, type PillBuild } from "./date-pill";
import { HIGHLIGHT_SPRING, TOOLTIP_SPRING } from "./design-tokens";
import { whenSeriesDimmed } from "./focus-injection";
import type { SpringConfig } from "./chart-config-context";
import type { ChartDatum, IndicatorWidth } from "./types";

// ── Crosshair (native indicator, replaces buildIndicator/positionIndicator) ─

export interface CrosshairGradientDef {
  id: string;
  color: string;
  stops: { offset: string; opacity: number }[];
}

/** bklit TooltipIndicator default vertical fade ("both", fadeLength=10) as an
 *  app-owned `<linearGradient>` def, rendered near the chart's other
 *  gradient defs (projection/marker) — the crosshair mark below references
 *  it by `url(#id)`, same mechanism as those existing defs. */
export function buildCrosshairGradientDef(id: string, color: string): CrosshairGradientDef {
  return { id, color, stops: crosshairFadeStops() };
}

export interface IndicatorMarkOptions {
  gradientId: string;
  width?: IndicatorWidth;
  span?: number;
  columnWidth?: number;
  dasharray?: string;
  /** Solid color, used only when the gradient is not (see `useGradient`) —
   *  bklit disables the vertical fade for dashed indicators, so a dashed
   *  rule has no reason to reference the fade gradient at all. */
  color?: string;
  /** Discrete/dense data (bklit's `pointCount > DISCRETE_INTERACTION_THRESHOLD`)
   *  snaps instead of springing, matching the existing native-tooltip gate
   *  already used elsewhere in these files. */
  discrete?: boolean;
  /** Overrides the default gradient-vs-solid gate. Defaults to `!dasharray`
   *  (line/area/composed/live-line: any non-dashed indicator uses the fade
   *  gradient). bar/scatter/candlestick additionally gate on `fadeEdges`
   *  (`!isDashed && resolveVerticalFadeSides(...).any`, since a dashed
   *  indicator already forces `fadeSides.any` false there too) — pass that
   *  precomputed boolean here rather than duplicating fade-mask logic in
   *  this file. */
  useGradient?: boolean;
  /** Native `crosshair()` defaults `x.strokeOpacity` to 0.35
   *  (dist/crosshair.js `resolveRuleStyle`); line/area/composed/live-line
   *  rely on that default (omit this option). bar/scatter/candlestick
   *  override to 1 to avoid a silent visual regression from that default. */
  strokeOpacity?: number;
  /** Spring config for the indicator's motion transition. Defaults to
   *  TOOLTIP_SPRING (line/area/composed/live-line's existing behavior).
   *  bar/scatter/candlestick pass `indicatorCfg.springConfig ??
   *  chartConfig.tooltipSpring`. */
  spring?: SpringConfig;
}

/** Native `crosshair()` x-only rule, replacing hover-chrome's imperative
 *  indicator: `y:false`/`marker:false`/label off — bklit's indicator is a
 *  single vertical rule with no native focus ring (`focusRing:false` on the
 *  chart spec already matches this). */
export function buildIndicatorMark(options: IndicatorMarkOptions): ChartMark<never, never, never> {
  const strokeWidth = resolveIndicatorPixelWidth({
    width: options.width,
    span: options.span,
    columnWidth: options.columnWidth,
  });
  const useGradient = options.useGradient ?? !options.dasharray;
  const spring = options.spring ?? TOOLTIP_SPRING;
  return crosshair({
    x: {
      stroke: useGradient ? `url(#${options.gradientId})` : (options.color ?? "var(--chart-crosshair)"),
      strokeOpacity: options.strokeOpacity,
      strokeWidth,
      strokeDasharray: options.dasharray,
      label: false,
    },
    y: false,
    marker: false,
    motion: options.discrete
      ? false
      : { transition: { type: "spring", stiffness: spring.stiffness, damping: spring.damping } },
  });
}

// ── Hover dots (native dot() + whenFocused, replaces ensureDot/updateDotPosition) ─

export interface HoverDotSeries {
  dataKey: string;
  color: string;
}

export interface HoverDotOptions {
  /** bklit TooltipDot default size. */
  size?: number;
  /** bklit: isRing ? 1.5 : 2 — plain 'dot' variant (not 'ring') defaults to 2. */
  strokeWidth?: number;
  stroke?: string;
  discrete?: boolean;
}

/**
 * Native `dot()` mark filtered to the currently-focused x via
 * `whenFocused(mark, {match:"x", retarget:true})`.
 *
 * `retarget:true`: keeps the ONE matching scene node's structural key stable
 * across focus changes (instead of unmount-the-old/mount-the-new), so the
 * mark's own `motion` spring below can slide the SAME dot element between x
 * positions — the native equivalent of hover-chrome's
 * TOOLTIP_SPRING-driven `updateDotPosition`. Without `retarget`, each focus
 * change would crossfade a fresh node in place, losing the "one dot glides
 * along the line" feel bklit has.
 *
 * `match:"x"`: each series already gets its OWN `dot()` mark (one call per
 * series, no `z`/`color` channel), so its candidate points already belong to
 * exactly one series — matching by x is sufficient to pick the single point
 * at the focused index and is simpler/more robust than `"series"` or
 * `"group"` (whose semantics are about disambiguating BETWEEN series within
 * one mark, not applicable here).
 */
export function buildHoverDotMark(
  renderData: ChartDatum[],
  xDataKey: string,
  series: HoverDotSeries,
  fill: string,
  options: HoverDotOptions = {},
): ChartMark<ChartDatum, Date, number> {
  const size = options.size ?? 5;
  const strokeWidth = options.strokeWidth ?? 2;
  const mark = dot(renderData, {
    id: `${series.dataKey}__hoverdot`,
    x: (d: ChartDatum) => d[xDataKey] as Date,
    y: (d: ChartDatum) => d[series.dataKey] as number,
    r: size,
    fill,
    stroke: options.stroke ?? "var(--chart-background)",
    strokeWidth,
    motion: options.discrete
      ? false
      : { transition: { type: "spring", stiffness: TOOLTIP_SPRING.stiffness, damping: TOOLTIP_SPRING.damping } },
  });
  return whenFocused(mark, { match: "x", retarget: true }) as unknown as ChartMark<ChartDatum, Date, number>;
}

/** bklit `resolveDotColor` minus its two PER-POINT-dynamic branches
 *  (`tooltip.rows[i].color`, `tooltip.dotColor` as a function of the hovered
 *  point) — native `dot()`'s `fill` is a static string, not a per-datum
 *  channel, so a color that changes with which point is hovered has no
 *  native route without a channel/reach-in. Static `tooltip.dotColor` and
 *  the series color both still work; see the C3 report for the dropped
 *  dynamic-color cases. */
export function resolveHoverDotFill(
  seriesColor: string,
  dotColor: string | ((point: Record<string, unknown>, line: { dataKey: string; stroke?: string }) => string) | undefined,
): string {
  if (typeof dotColor === "string") return dotColor;
  return seriesColor;
}

// ── Pointer-hover dim (series dim on hover — distinct from legend dim) ────
// D425: the 0.4s (line/area) / 0.12s (composed bar) transition lives in
// styles.css as a `.ts-chart__*` CSS rule, NOT in `states[].transition` —
// none of the states below carry a `transition` field.

/**
 * Declarative selector: "this mark is pointer-hover-dimmed whenever ANY
 * point anywhere is pointer-focused." A `lineY`/`areaFill` mark's single
 * scene node "owns" every one of its data points as a focus candidate
 * (confirmed via dist/mark-state.js `matchingContext` + dist/focus-layer.js
 * `matchesFocusAnchor` — a line mark has no way to render a PARTIAL dim), so
 * `match:"group"` — true when any owned point is part of the focused x's
 * point group, i.e. true for every series simultaneously — reproduces
 * bklit's SeriesHoverDim exactly: it dims every series uniformly on hover;
 * the separate highlight-band mark below then restores full brightness for
 * the near slice.
 */
export const POINTER_HOVER_DIM_SELECTOR: ChartMarkStateSelector = {
  focus: "group",
  source: "pointer",
};

export function pointerHoverDimState<TDatum = unknown>(opacity: number): ChartMarkState<TDatum, any> {
  return { when: POINTER_HOVER_DIM_SELECTOR, style: { opacity } };
}

/**
 * The two-entry `states` array repeated verbatim at line-chart.tsx (line
 * dim), area-chart.tsx (area-boundary dim), and composed-chart.tsx (area +
 * line dim, two call sites): a legend-driven (programmatic-source-only)
 * series dim via `whenSeriesDimmed()` with a 400ms ease-in-out tween (bklit
 * SeriesHoverDim's legend term), plus the pointer-hover dim term with no
 * `transition` field (D425 — that 0.4s rides `.ts-chart__line path` in
 * styles.css instead). All four sites differ only in the `opacity` value
 * passed to both states.
 */
export function seriesAndPointerDimStates<TDatum = unknown>(opacity: number): ChartMarkState<TDatum>[] {
  return [
    {
      when: whenSeriesDimmed(),
      style: { opacity },
      transition: { type: "tween", duration: 400, easing: "ease-in-out" },
    },
    pointerHoverDimState<TDatum>(opacity),
  ];
}

/**
 * Composed bars: dim every row EXCEPT the one at the focused x. There is no
 * declarative selector for "not x" (`ChartMarkStateSelector.focus` only
 * accepts one positive match or the whole-group `'unmatched'` special case),
 * so this is a predicate function. `resolveMarkStateScene` (dist/mark-state.js)
 * early-returns unchanged when `context.focus` is absent, so no extra "is
 * anything focused" guard is needed here — the predicate simply never
 * matches while nothing is hovered.
 */
export function pointerRowDimState<TDatum = unknown>(opacity: number): ChartMarkState<TDatum, any> {
  return {
    when: (ctx) => ctx.focus.source === "pointer" && !ctx.matches("x"),
    style: { opacity },
  };
}

// ── Highlight band (near-hover full-brightness overlay) ───────────────────

export interface HighlightBandSeries {
  dataKey: string;
  color: string;
  strokeWidth: number;
  showHighlight: boolean;
  /** Area-only (A4): bklit gates the highlight band on `showHighlight &&
   *  showLine` while SeriesHoverDim keys off `showHighlight` alone — the dim
   *  state above stays on, only the band itself is suppressed here. */
  showLine?: boolean;
  curve?: ChartCurve;
}

/**
 * A second `lineY` mark per series, its data sliced to
 * `[hoveredIndex-1, hoveredIndex+1]` (clamped to the render-data bounds),
 * drawn at full brightness — the reactive React-state replacement for
 * hover-chrome's imperative clip-rect sweep + `path.getAttribute("d")` clone
 * onto a shadow `<path>`.
 *
 * Motion choice: `path:"morph"` + a HIGHLIGHT_SPRING transition is the
 * closest native approximation of the old `highlightSpring`-driven
 * clip-x/width sweep. It is NOT equivalent: the old mechanism kept the full
 * series path always painted and animated a *clip window* sliding over it
 * (the geometry itself never changed), whereas this re-renders a short,
 * index-clamped 2-3-point path on every hoveredIndex change and asks the
 * renderer's path-morph motion to tween between successive `d` strings. For
 * adjacent-index moves (the overwhelmingly common case) the visual result is
 * close; for a hoveredIndex jump of more than one step (e.g. a fast pointer
 * skip) the morph interpolates between two disjoint short paths rather than
 * sweeping across the ground between them. Shipped as the best available
 * native equivalent; reported as an approximation gap, not silently dropped.
 */
export function buildHighlightBandMarks(
  renderData: ChartDatum[],
  xDataKey: string,
  hoveredIndex: number | null,
  series: readonly HighlightBandSeries[],
  options: { discrete?: boolean } = {},
): ChartMark<ChartDatum, Date, number>[] {
  if (hoveredIndex == null || renderData.length === 0) return [];
  const lo = Math.max(0, hoveredIndex - 1);
  const hi = Math.min(renderData.length - 1, hoveredIndex + 1);
  if (hi < lo) return [];
  const slice = renderData.slice(lo, hi + 1);
  if (slice.length === 0) return [];
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const s of series) {
    if (!s.showHighlight || s.showLine === false) continue;
    marks.push(
      lineY(slice, {
        id: `${s.dataKey}__highlight`,
        x: (d: ChartDatum) => d[xDataKey] as Date,
        y: (d: ChartDatum) => d[s.dataKey] as number,
        curve: s.curve,
        stroke: s.color,
        strokeWidth: s.strokeWidth,
        motion: options.discrete
          ? false
          : {
              transition: { type: "spring", stiffness: HIGHLIGHT_SPRING.stiffness, damping: HIGHLIGHT_SPRING.damping },
              path: "morph",
            },
      }),
    );
  }
  return marks;
}

// ── Guards (ported semantics from use-hover-chrome.ts) ─────────────────────

/** bklit shell comment — interaction bisects only visiblePlotData; with
 *  domain-clamp the focus stack is over full data, so an edge pointer can
 *  resolve an off-viewport point. True when `datum`'s x value falls outside
 *  the inclusive `xDomain`. */
export function isFocusOutsideXDomain(
  datum: unknown,
  xDataKey: string,
  xDomain: readonly [Date, Date] | undefined,
): boolean {
  if (!xDomain) return false;
  const v = (datum as Record<string, unknown> | null | undefined)?.[xDataKey];
  const d = v instanceof Date ? v : v != null ? new Date(v as string | number) : null;
  if (!d || Number.isNaN(d.getTime())) return false;
  const t = d.getTime();
  const a = xDomain[0]!.getTime();
  const b = xDomain[1]!.getTime();
  return t < Math.min(a, b) || t > Math.max(a, b);
}

// ── Date pill overlay (app-owned HTML; sanctioned per date-pill.ts) ───────

export interface DatePillController {
  overlayHostRef: React.RefObject<HTMLDivElement | null>;
  /** Shows/positions the pill. `jump` snaps instead of springing (first-show
   *  / discrete data, mirroring hover-chrome's `showing || discrete`
   *  branch). */
  show(x: number, opts: { index: number; label: string | null; discrete: boolean; jump: boolean }): void;
  hide(): void;
}

export function useDatePillOverlay(options: {
  enabled: boolean;
  dateLabels: readonly string[];
  tooltipSpring: SpringConfig;
}): DatePillController {
  const { enabled, tooltipSpring } = options;
  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const pillRef = React.useRef<PillBuild | null>(null);
  const dateLabelsRef = React.useRef(options.dateLabels);
  dateLabelsRef.current = options.dateLabels;

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !enabled) return;
    const pill = buildPill(el.ownerDocument, tooltipSpring, () => dateLabelsRef.current as string[]);
    el.appendChild(pill.layer);
    pillRef.current = pill;
    return () => {
      pillRef.current = null;
      pill.layer.remove();
      pill.spring.stop();
      pill.ticker?.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tooltipSpring.stiffness, tooltipSpring.damping]);

  const show = React.useCallback(
    (x: number, opts: { index: number; label: string | null; discrete: boolean; jump: boolean }) => {
      const pill = pillRef.current;
      if (!pill) return;
      pill.layer.style.display = "";
      if (pill.ticker && dateLabelsRef.current.length > 0) {
        pill.ticker.update(opts.index, opts.discrete);
      } else if (opts.label != null) {
        pill.label.textContent = opts.label;
      }
      if (opts.jump || opts.discrete) pill.spring.jump(x);
      else pill.spring.set(x);
    },
    [],
  );

  const hide = React.useCallback(() => {
    const pill = pillRef.current;
    if (!pill) return;
    pill.layer.style.display = "none";
  }, []);

  return { overlayHostRef, show, hide };
}
