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
// configured-scale.ts); C5/B5 (D432): the mount reveal is now the NATIVE
// motion renderer's own per-element enter fade (`<RendererChart renderer=
// {chartMotionRenderer()}>`, `@tanstack/charts/dist/motion.js`'s
// `addEnterMotionTrack` opacity-0->target fallback) driven by a per-datum
// `delay` callback reproducing bklit's per-marker framer entrance's stagger
// formula — see `createScatterEnterMotion` below for what's kept/dropped
// (opacity only; the legacy blur channel has no native attribute to ride).
// hover-dim (opacity 0.5 inactive / r×1.35 active) is native `dot()` mark
// `states` (C1). C3: the indicator/crosshair and per-series tooltip-dot
// geometry (formerly scatter-hover-chrome.ts's imperative DOM chrome, now
// deleted) are a native `crosshair()` mark + a `whenFocused`-wrapped custom
// hover-dot mark (see `createHoverDotMark` below); only the date-pill + axis
// -label fade remain app-owned HTML (`attachScatterPillChrome`).
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { RendererChart, type ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { defineChart } from "@tanstack/charts/scene";
import { dot } from "@tanstack/charts/dot";
import { whenFocused } from "@tanstack/charts/focus/mark";
import type {
  ChartDotStateStyle,
  ChartMark,
  ChartMarkState,
  ChartMotionContext,
  ChartMotionDefinition,
  ChartPoint,
  ChartRendererRenderContext,
  ChartScale,
  ChartValue,
  SceneNode,
  StaticChartDefinition,
} from "@tanstack/charts";
import { extractChildren } from "./children";
import { ChartSelectionContext, useChartSelection } from "./internal/chart-selection";
import { buildPill } from "./internal/date-pill";
import { buildXAxisTickValues, buildFadeXAxisOptions, hiddenAxisOptions } from "./internal/axis-ticks";
import { resolveVerticalFadeSides, indicatorFadeGradientStops } from "./internal/fade-mask";
import {
  toDotConfig,
  toIndicatorConfig,
  type DotVariant,
} from "./internal/tooltip-mappers";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { useChartConfig, type SpringConfig } from "./internal/chart-config-context";
import { TooltipContent } from "./internal/tooltip-components";
import type { ChartDatum, ChartPhase, ChartTooltipConfig, ChartTooltipPoint, TooltipRow } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { resolveGridGuide } from "./internal/grid";
import { createScatterFocusStrategy } from "./internal/scatter-focus-strategy";
import "./styles.css";
import { isRevealed, markRevealed, setRevealDeadline } from "./internal/deferred-reveal";
import { useChartMargin, DEFAULT_CHART_MARGIN, useContainerWidth, type ChartMargin } from "./internal";
import {
  BOX_OFFSET,
  CHART_CATEGORY_PALETTE,
  DISCRETE_INTERACTION_THRESHOLD,
} from "./internal/design-tokens";
import { useFocusInjection } from "./internal/focus-injection";
import { buildIndicatorMark } from "./internal/hover-geometry";
import { buildNativeTooltipExtension } from "./internal/native-tooltip";
import { shortDateFmt, weekdayDateFmt } from "./internal/formatters";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { resolveMotionEasing, type MotionEasing } from "./internal/reveal-easing";
import {
  DEFAULT_ANIMATION_DURATION_MS,
  DEFAULT_ANIMATION_EASING,
} from "./internal/animation-defaults";
import { clipRevealTiming, type EnterTransition } from "./internal/enter-transition";
import {
  createAxisValueProjector,
  createNicedYScale,
  resolveYDomainsByAxis,
} from "./internal/y-domain";
import { DEFAULT_Y_AXIS_ID } from "./internal/y-axis-id";

// P5.5 S1 RETIRES this file's local `REVEAL_EASING`. D327's ground for keeping
// it was verbatim "ScatterChart has no `animationEasing` prop, so this is the
// INTERNAL reveal ease, not the prop default" — S1 adds that prop, inverting
// the ground, so the value now comes from `./internal/animation-defaults`
// (legacy `animation.ts:4` provenance). Still NOT `design-tokens.ts`'s
// `REVEAL_EASE_CSS` (upstream `motion.ts:209` mirror) — see
// animation-defaults.ts's header. (Closes the last third of P6.2's scope.)
// bklit series-point-marker.tsx SeriesPointMarker: fixed 0.5s enter tween.
const ENTER_TWEEN_MS = 500;
// bklit chart-context.tsx defaultScatterColors (--chart-1 .. --chart-5).
// T-D15 (P3.1): sourced from the shared 5-entry categorical palette rather
// than a local literal set — see internal/design-tokens.ts.
// Exported as `defaultScatterColors` from the barrel (bklit chart-context.tsx:55).
export const DEFAULT_SCATTER_COLORS: readonly string[] = CHART_CATEGORY_PALETTE;

// bklit scatter.tsx DEFAULT_Y_GRADIENT_FROM/TO (S8).
const DEFAULT_Y_GRADIENT_FROM = "var(--color-red-500)";
const DEFAULT_Y_GRADIENT_TO = "var(--color-emerald-500)";

// P6/C1 (bklit scatter-hover-chrome.ts, deleted DOM version): the hovered
// group's markers pop to 1.35x radius; everything else dims to
// `series.inactiveOpacity` (default 0.5). Both now ride native `dot()` mark
// `states` instead of DOM clone/mutation. `{focus:'group'}` matches bklit's
// "every point sharing the hovered x-value, one per series" semantics (see
// scatter-focus-strategy.ts's `group()` / `collectFocusGroup`) —
// intentionally broader than the single-nearest-point `'primary'` selector.
// `{focus:'unmatched'}` is group-scoped and resolves to "every point NOT in
// the focused group," matching bklit's uniform per-row dim.
const ACTIVE_HIGHLIGHT_SCALE = 1.35;
const HOVER_STATE_TRANSITION = {
  type: "tween",
  duration: 150,
  easing: "ease-in-out",
} as const;

// C3 (exact port of the deleted scatter-hover-chrome.ts's module-scope
// helper of the same name — tooltip.rows color override > tooltip.dotColor
// (string or per-point function) > series fill > the focused point's own
// color). NOTE the quirk this preserves byte-for-byte: `tooltip.dotColor`'s
// function form is genuinely invoked here (unlike `indicatorColor`, see
// below) — legacy never had the "function branch never evaluated" bug for
// dots, only for the indicator.
function resolveDotColor(
  tooltip: ChartTooltipConfig | null | undefined,
  seriesFill: string,
  pointColor: string,
  point: Record<string, unknown>,
  line: { dataKey: string; stroke?: string },
  tooltipRows: { color: string }[] | null,
  index: number,
): string {
  if (tooltip?.rows && tooltipRows?.[index]?.color) return tooltipRows[index]!.color;
  if (tooltip?.dotColor != null) {
    if (typeof tooltip.dotColor === "function") return tooltip.dotColor(point, line);
    return tooltip.dotColor;
  }
  return seriesFill || pointColor;
}

// C3 (exact port from scatter-hover-chrome.ts).
function ringCornerRadius(halfExtent: number, cornerRadiusFraction: number): number {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(0.5, cornerRadiusFraction));
}

// B5 (D432): per-datum enter delay + opacity-only fade for the base marker
// marks (native `dot()` series + the S8 yGradient custom mark below) — NOT
// the C3 hover-dot/crosshair marks above, which have their own unconditional
// spring motion.
//
// The native engine's own enter-track fallback (`dist/motion.js`'s
// `addEnterMotionTrack`, the branch reached by everything that isn't a bar
// rect or a rolling line/area point) ALREADY fades every freshly-mounted
// element's `opacity` 0 -> its resolved target automatically — this factory
// only needs to supply the per-datum `delay` and the fade's own
// `transition`; the opacity keyframes themselves are the library's default,
// not something we author.
//
// `delay` reproduces the pre-B5 `handleRender`'s exact formula byte-for-byte
// (this file's own prior imperative block, now deleted): `leadingEdge =
// max(0, cx - visualExtent)`, `delaySec = innerWidth>0 ? (leadingEdge/
// innerWidth)*durationSec : 0` — `cx` here is `ctx.point.x`, the SAME
// pixel-space x the mark's own `x` channel resolves to (both trace through
// the identical `scales.x.map(...)` call), so this is numerically identical
// to reading the rendered `<circle cx>` attribute the old code queried.
//
// DROPPED: legacy's OTHER enter channel, `filter: blur(...)` (bklit
// `series-point-marker.tsx`'s `SeriesPointMarker` — `hidden.filter:
// blur(${enterBlur}px)` -> `visible.filter: "blur(0px)"`, series-point-
// marker.tsx:153/158) — "filter" is not in `dist/motion.js`'s
// `motionAttributes` allowlist (only `cx,cy,d,fill-opacity,font-size,font-
// weight,height,opacity,r,rx,stroke-opacity,stroke-width,transform,width,x,
// x1,x2,y,y1,y2` are ever diffed/animated), so it has no native channel to
// ride — this is the "opacity only" ask. NOTE on the task brief's "scale/r
// pop": `SeriesPointMarker`'s own `variants.hidden.scale`/`visible.scale`
// are BOTH pinned to `1` (series-point-marker.tsx:154, 159) — there is no
// actual scale/r animation in bklit's marker enter to begin with, so nothing
// was dropped there; the only real "pop" in this codebase is the SEPARATE,
// enter-independent hover-state `r × 1.35` highlight (ACTIVE_HIGHLIGHT_SCALE
// above), which was already native before B5 (mark `states`) and is
// unaffected by this change.
function createScatterEnterMotion(
  visualExtent: number,
  innerWidth: number,
  staggerDurationSec: number,
  fadeDurationMs: number,
  easing: MotionEasing,
): ChartMotionDefinition<ChartDatum> {
  return (ctx: ChartMotionContext<ChartDatum>) => {
    if (ctx.phase !== "enter") return false;
    const cx = ctx.point?.x ?? 0;
    const leadingEdge = Math.max(0, cx - visualExtent);
    const delayMs =
      innerWidth > 0 ? (leadingEdge / innerWidth) * staggerDurationSec * 1000 : 0;
    return {
      delay: delayMs,
      transition: { type: "tween", duration: fadeDurationMs, easing },
    };
  };
}

// C3: replaces scatter-hover-chrome.ts's DOM `ensureDot`/`updateDotPosition`
// per-series tooltip-dot layer with a hand-built ChartMark, wrapped by the
// caller in `whenFocused(mark, {match:'group', retarget:true})` so exactly
// the currently-focused group's points render (see the `definition` useMemo
// below for the match/retarget rationale). One SceneDot ("dot" variant) or
// SceneRect with rounded corners ("ring" variant, `radius` = the exact
// `ringCornerRadius` legacy used for its `rx`/`ry`) per datum, each carrying
// a `pointOwner` built from the SAME `source[datumIndex]` object reference
// the base marks use, so `sameFocusedPoint`'s `Object.is(datum)` check
// (dist/focus-layer.js) matches this mark's points to the focused group.
// `tooltip.rows`-based per-point color override is evaluated eagerly here,
// once per data/series/tooltip-config change (render time) rather than
// legacy's once-per-hover-frame cost — a deliberate, zero-cost-by-default
// tradeoff (documented in the C3 report).
function createHoverDotMark(
  source: readonly ChartDatum[],
  series: ResolvedSeries,
  xDataKey: string,
  projectY: (value: number) => number,
  seriesIndex: number,
  tooltipCfg: ChartTooltipConfig | null,
  tooltipSpring: SpringConfig,
): ChartMark<ChartDatum, Date, number> {
  const dotCfg = toDotConfig(tooltipCfg);
  const variant: DotVariant = dotCfg.variant ?? "dot";
  const isRing = variant === "ring";
  const rawSize = dotCfg.size ?? 5;
  const size = rawSize * (dotCfg.scale ?? 1);
  const strokeWidth = dotCfg.strokeWidth ?? (isRing ? 1.5 : 2);
  const radiusFraction = dotCfg.radiusFraction ?? 0.25;
  const cornerRadius = ringCornerRadius(size, radiusFraction);
  const side = size * 2;
  // Legacy's dot spring is NEVER gated on `discrete` (only the crosshair and
  // date pill are — `updateDotPosition`'s comment: "Dot always springs...
  // only a fresh mount snaps in place"). `retarget:true` on the caller's
  // `whenFocused` supplies that "fresh mount snaps" behavior for free (no
  // prior DOM node to interpolate from), so this motion is unconditional.
  const motion: ChartMotionDefinition<ChartDatum> = {
    transition: { type: "spring", stiffness: tooltipSpring.stiffness, damping: tooltipSpring.damping },
  };
  const lineRef = { dataKey: series.dataKey, stroke: series.fill };

  return {
    initialize: () => {
      const xValues: (ChartValue | undefined)[] = [];
      const yValues: (ChartValue | undefined)[] = [];
      const colors: string[] = [];
      for (const d of source) {
        const xv = d[xDataKey];
        xValues.push(xv instanceof Date && Number.isFinite(xv.getTime()) ? xv : undefined);
        const yv = d[series.dataKey];
        yValues.push(typeof yv === "number" && Number.isFinite(yv) ? projectY(yv) : undefined);
        const row = d as Record<string, unknown>;
        const tooltipRows = tooltipCfg?.rows ? (tooltipCfg.rows(row) as { color: string }[]) : null;
        colors.push(resolveDotColor(tooltipCfg, series.fill, series.fill, row, lineRef, tooltipRows, seriesIndex));
      }
      return {
        id: `${series.dataKey}--hover-dot`,
        motion,
        channels: {
          x: { scale: "x", values: xValues },
          y: { scale: "y", values: yValues },
        },
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, Date, number>[] = [];
          source.forEach((datum, datumIndex) => {
            const xv = xValues[datumIndex];
            const yv = yValues[datumIndex];
            if (xv === undefined || yv === undefined) return;
            const x = scales.x.map(xv);
            const y = scales.y.map(yv);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const color = colors[datumIndex]!;
            const point: ChartPoint<ChartDatum, Date, number> = {
              key: `${series.dataKey}:${datumIndex}`,
              markId: series.dataKey,
              group: null,
              groupLabel: series.dataKey,
              datum,
              datumIndex,
              xValue: xv as Date,
              yValue: yv as number,
              x,
              y,
              color,
            };
            if (isRing) {
              nodes.push({
                kind: "rect",
                key: `${series.dataKey}:hover-dot:${datumIndex}`,
                x: x - size,
                y: y - size,
                width: side,
                height: side,
                radius: cornerRadius,
                style: { fill: "transparent", stroke: color, strokeWidth },
                pointOwner: point,
              });
            } else {
              nodes.push({
                kind: "dot",
                key: `${series.dataKey}:hover-dot:${datumIndex}`,
                x,
                y,
                radius: size,
                style: { fill: color, stroke: "var(--chart-background)", strokeWidth },
                pointOwner: point,
              });
            }
            points.push(point);
          });
          return {
            nodes: [
              {
                kind: "group",
                key: `${series.dataKey}--hover-dot`,
                className: "bkm-chart__hover-dot",
                ariaHidden: true,
                children: nodes,
              },
            ],
            points,
          };
        },
      };
    },
  };
}

// S8 (bklit scatter.tsx yGradient): custom ChartMark emitting the EXACT DOM
// shape stock `dot()` produces — one `.ts-chart__dot[data-ts-key]` group per
// series, one `<circle>` per datum — so focus strategy and hover chrome work
// unchanged. The disc AND ring circles paint a per-series userSpaceOnUse
// linear gradient spanning the plot height (from at y=innerHeight, to at
// y=0), which is how bklit gets per-point vertical coloring with ordinary
// fills. One ChartPoint per datum (markId = dataKey) keeps TanStack's focus
// grouping identical to stock dot(). B5: `motion` (built by
// `createScatterEnterMotion` at the call site) drives BOTH circles per datum
// off the one shared `point` they carry as `pointOwner` — same delay, same
// fade, matching legacy's concentric fill+ring circles animating in lockstep.
function createYGradientScatterMark(
  source: readonly ChartDatum[],
  series: ResolvedSeries,
  xDataKey: string,
  /** P6.1 (S6): identity for the primary axis; see `createAxisValueProjector`. */
  projectY: (value: number) => number,
  motion: ChartMotionDefinition<ChartDatum>,
): ChartMark<ChartDatum, Date, number> {
  const hasRing = series.strokeWidth > 0;
  const discRadius = series.radius;
  const ringRadius = hasRing
    ? series.radius + series.ringGap + series.strokeWidth / 2
    : 0;
  const fillUrl = `url(#${series.yGradId})`;
  return {
    initialize: () => {
      const xValues: (ChartValue | undefined)[] = [];
      const yValues: (ChartValue | undefined)[] = [];
      for (const d of source) {
        const xv = d[xDataKey];
        xValues.push(xv instanceof Date && Number.isFinite(xv.getTime()) ? xv : undefined);
        const yv = d[series.dataKey];
        yValues.push(typeof yv === "number" && Number.isFinite(yv) ? projectY(yv) : undefined);
      }
      return {
        id: series.dataKey,
        motion,
        channels: {
          x: { scale: "x", values: xValues },
          y: { scale: "y", values: yValues },
        },
        // P6/C1: opacity-dim only. A single `states` definition's `r` value
        // fully REPLACES a dot SceneNode's radius per-node (dist/mark-state.js
        // `applyStateStyle`, case "dot") — it isn't computed from the node's
        // own prior value, and the fill-disc/ring-circle siblings below share
        // one ChartPoint/context with no node-kind discriminator to tell them
        // apart. There is no way to independently pop discRadius vs
        // ringRadius from one state definition, so the active r×1.35 highlight
        // is intentionally NOT reproduced for the yGradient path (only the
        // plain dot() series below get it). D421: inactiveBlur also has no
        // native channel and is omitted the same way as the plain path.
        // `markStates()` (dist/mark.js) isn't publicly exported — this
        // reproduces its `definitions?.length ? {data, definitions} :
        // undefined` shape by hand for `InitializedMarkBase.states`.
        states: series.fadeOnHover ?? true
          ? {
              data: source,
              definitions: [
                {
                  when: { focus: "unmatched" },
                  style: { opacity: series.inactiveOpacity },
                  transition: HOVER_STATE_TRANSITION,
                },
              ],
            }
          : undefined,
        render: ({ scales }) => {
          const nodes: SceneNode[] = [];
          const points: ChartPoint<ChartDatum, Date, number>[] = [];
          source.forEach((datum, datumIndex) => {
            const xv = xValues[datumIndex];
            const yv = yValues[datumIndex];
            if (xv === undefined || yv === undefined) return;
            const x = scales.x.map(xv);
            const y = scales.y.map(yv);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const point: ChartPoint<ChartDatum, Date, number> = {
              key: `${series.dataKey}:${datumIndex}`,
              markId: series.dataKey,
              group: null,
              groupLabel: series.dataKey,
              datum,
              datumIndex,
              xValue: xv as Date,
              yValue: yv as number,
              x,
              y,
              color: fillUrl,
            };
            // bklit MarkerCircles draw order: fill disc → ring (stroked
            // circle). Both paint the same gradient url. `pointOwner` is set
            // explicitly (object identity) so state-resolution's ownership
            // lookup (dist/scene-point-ownership-internal.js) doesn't fall
            // through to its "ALL points" fallback for these custom nodes.
            nodes.push({
              kind: "dot",
              key: `${series.dataKey}:null:${datumIndex}`,
              x,
              y,
              radius: discRadius,
              style: { fill: fillUrl, stroke: "none" },
              pointOwner: point,
            });
            if (hasRing) {
              nodes.push({
                kind: "dot",
                key: `${series.dataKey}:ring:${datumIndex}`,
                x,
                y,
                radius: ringRadius,
                style: {
                  fill: "none",
                  stroke: fillUrl,
                  strokeWidth: series.strokeWidth,
                },
                pointOwner: point,
              });
            }
            points.push(point);
          });
          return {
            nodes: [
              {
                kind: "group",
                key: series.dataKey,
                className: "ts-chart__dot",
                ariaHidden: true,
                children: nodes,
              },
            ],
            points,
          };
        },
      };
    },
  };
}

// C3: what's left of scatter-hover-chrome.ts's `ScatterHoverChromeState`
// after the crosshair/dot geometry moved to native marks — only the fields
// the date-pill + axis-label fade actually read.
interface ScatterPillChromeState {
  xDataKey: string;
  pointCount: number;
  showDatePill: boolean;
  /** CH5/B12 (bklit XAxis.tickerHalfWidth): date-pill fade radius; defaults
      to the TICKER_HALF_WIDTH token when unset. */
  tickerHalfWidth?: number;
  dateLabels: string[];
}

interface ScatterPillChrome {
  update(points: readonly ChartPoint<ChartDatum, Date, number>[]): void;
  detach(): void;
}

// C3: the date-pill + axis-label-fade half of the deleted
// `attachScatterHoverChrome` (scatter-hover-chrome.ts), ported verbatim —
// same `visible`/`showing` jump-vs-set gating, same `discrete` threshold
// read. Only the indicator/dot branches are gone (now native marks); the
// pill primitive itself comes from the read-only, already-extracted
// `./internal/date-pill` module (its own header notes it holds the
// byte-identical twin of what used to live in the now-deleted
// tooltip-chrome.ts). C4: the label-fade DOM-span query that used to live
// here (`container.querySelectorAll('[data-bkm-xlabel]')`) is gone — fade
// state is reported to the caller via `onLabelFadeChange` and consumed by a
// native `tickLabels.opacity` callback in the `definition` memo instead.
function attachScatterPillChrome(
  host: HTMLElement,
  getState: () => ScatterPillChromeState,
  tooltipSpring: SpringConfig,
  // C4: axis-label proximity fade moved from `date-pill.ts`'s imperative
  // `applyLabelFade`/`resetLabelFade` DOM-span mutators to React state read
  // by a native `tickLabels.opacity` callback in the `definition` memo — this
  // imperative attach function has no React state of its own, so it reports
  // fade changes upward through this callback instead.
  onLabelFadeChange: (fade: { primaryX: number; hoveredLabel: string | null } | null) => void,
): ScatterPillChrome {
  const doc = host.ownerDocument;
  const pillBuild = buildPill(doc, tooltipSpring, () => getState().dateLabels ?? []);
  host.append(pillBuild.layer);

  let visible = false;

  const hide = () => {
    if (!visible) return;
    visible = false;
    pillBuild.layer.style.display = "none";
    pillBuild.spring.stop();
    pillBuild.label.textContent = "";
    onLabelFadeChange(null);
  };

  const update = (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
    if (points.length === 0) {
      hide();
      return;
    }
    const state = getState();
    const primary = points[0]!;
    const date = (primary.datum as Record<string, unknown>)[state.xDataKey];
    const isDate = date instanceof Date;
    const discrete = state.pointCount > DISCRETE_INTERACTION_THRESHOLD;
    const showing = !visible;
    visible = true;

    if (state.showDatePill && isDate) {
      pillBuild.layer.style.display = "";
      if (pillBuild.ticker && state.dateLabels && state.dateLabels.length > 0) {
        pillBuild.ticker.update(primary.datumIndex, discrete);
      } else {
        pillBuild.label.textContent = shortDateFmt.format(date as Date);
      }
      if (showing || discrete) pillBuild.spring.jump(primary.x);
      else pillBuild.spring.set(primary.x);
    } else {
      pillBuild.layer.style.display = "none";
    }

    const hoveredLabel = isDate ? shortDateFmt.format(date as Date) : null;
    onLabelFadeChange({ primaryX: primary.x, hoveredLabel });
  };

  return {
    update,
    detach() {
      hide();
      pillBuild.layer.remove();
      pillBuild.ticker?.detach();
    },
  };
}

export interface ScatterChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  animationDuration?: number;
  margin?: Partial<ChartMargin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  /** P5.5 S1 — bklit `scatter-chart-shell.tsx:58`. Easing for the per-point
      enter fade. Default: legacy's `cubic-bezier(0.85, 0, 0.15, 1)`. */
  animationEasing?: string;
  /** P5.5 S2 — bklit `scatter-chart.tsx:34` (defaulted to
      `DEFAULT_CHART_ENTER_TRANSITION` at `:145`). Overrides the reveal SPAN
      the per-point stagger is spread across — bklit `series-markers.tsx:102`:
      `clipRevealTransition(enterTransition).duration ?? animationDuration/1000`.
      It deliberately does NOT change each point's own fade, which bklit pins
      at a fixed `enterDuration = 0.5` (`series-markers.tsx:103`). */
  enterTransition?: EnterTransition;
  /** P5.5 S3 — bklit `scatter-chart.tsx:35`. Replay epoch input; bklit bumps
      its epoch from `[animationDuration, revealSignature]`
      (`scatter-chart-shell.tsx:146-154`). */
  revealSignature?: string;
  children?: React.ReactNode;
}

interface ResolvedSeries {
  dataKey: string;
  /** P6.1 / S6. Undefined means the default ("left") axis. */
  yAxisId?: string | number;
  /** S7 — bklit series-markers.tsx:104 `animate && !isLoaded`. */
  animate: boolean;
  /** RAW series fill (tooltip dot-color path) — never a gradient url. */
  fill: string;
  /** RAW ring stroke (chrome fallbacks). */
  stroke: string;
  strokeWidth: number;
  ringGap: number;
  radius: number;
  fadeOnHover: boolean;
  inactiveOpacity: number;
  inactiveBlur: number;
  enterBlur: number;
  showActiveHighlight: boolean;
  /** P6/C1: bklit's hovered-marker outline ring has no native mark-`states`
      equivalent (`ChartDotStateStyle` has no outline/box-shadow channel) and
      the DOM highlight-clone that used to paint it was deleted along with
      the rest of scatter-hover-chrome.ts's dim/clone machinery. These fields
      are kept for prop-resolution compatibility but are now visually inert. */
  outlineWidth: number;
  outlineColor?: string;
  useYGradient: boolean;
  yGradFrom: string;
  yGradTo: string;
  /** S8 gradient id when yGradient is active, else null. */
  yGradId: string | null;
}

export function ScatterChart({
  data,
  xDataKey = "date",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  children,
}: ScatterChartProps) {
  const margin = useChartMargin(marginProp, DEFAULT_CHART_MARGIN);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);
  // bklit ScatterChartInner starts `isLoaded=false` unconditionally (no
  // `status` prop — D14) — the initial phase is always "revealing".
  const phaseRef = React.useRef<ChartPhase>("revealing");
  const dragSelectionActiveRef = React.useRef(false);
  // C6: own capture — feeds useChartSelection's clientToScene +
  // scene.scales.x.invert path (replaces the plot-local xScaleForSelection
  // duplicate scale below).
  const { captureRenderContext, sceneRef, clientToScene } = useFocusInjection<ChartDatum, Date, number>();
  const revealDeadlineTimerRef = React.useRef<number | null>(null);
  // P4.6 (M3a): the reveal runs once per component lifetime. The scene (and
  // with it the .ts-chart__marks group) is rebuilt on every data swap, so the
  // DOM-side `dataset.bkmRevealed` guard dies with the old node and the mount
  // reveal used to replay on every update (~n·series animate()
  // instantiations + blur rasterization inside the update->paint window).
  // Three states in handleRender, keyed on seenRevealKeyRef + the pending
  // deadline: first call -> reveal + arm deadline; revealed while the
  // deadline is still pending -> the group was replaced mid-window, restart
  // the reveal (the pre-P4.6 self-heal, now bounded to the mount window);
  // revealed after the deadline fired (timer ref nulled) -> snap, because
  // bklit snaps on data updates (StaticSeriesPointMarker, D14).
  //
  // S3 (D311): P4.6's guard was a plain BOOLEAN, which was correct only while
  // migrated scatter had no `revealSignature` prop — after the deadline fires
  // a boolean snaps FOREVER, so a caller bumping the signature would get
  // nothing and S3 would land inert while typechecking clean. It now carries
  // sankey's replay-KEY shape (`sankey-chart.tsx:515-534`): the key decides
  // whether a NEW reveal window opens; the deadline still bounds the current
  // one. `null` = never revealed.
  const seenRevealKeyRef = React.useRef<{ signature: string; duration: number } | null>(null);
  // S2 — reveal SPAN + easing (bklit `animation.ts:18` coercion; a spring is
  // flattened to a tween of the same nominal duration). Primitive deps:
  // callers pass `enterTransition` as an inline object literal.
  const enterType = enterTransition?.type;
  const enterDuration = enterTransition?.duration;
  const enterEaseKey = enterTransition?.ease?.join(",");
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = React.useMemo(
    () => clipRevealTiming(enterTransition, animationDuration, animationEasing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterType, enterDuration, enterEaseKey, animationDuration, animationEasing],
  );
  const revealKeyRef = React.useRef({ signature: revealSignature, duration: animationDuration });
  revealKeyRef.current = { signature: revealSignature, duration: animationDuration };
  const onPhaseChangeRef = React.useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
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

  // Teardown: cancel the pending reveal deadline on unmount (D205 canonical
  // wording). B5 (C5/D432): the per-circle WAAPI animation list + post-paint
  // cancel chain this used to also tear down are gone — the native motion
  // renderer owns its own per-element transition lifecycle; there is nothing
  // left here to `.cancel()` imperatively.
  React.useEffect(() => {
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
  }, []);

  const { scatters, grid, xAxis, background, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );

  // bklit scatter-chart-shell.tsx: no decimation (D14) — the benchmark
  // comparison must render every raw point, same as bklit.
  const renderData = data;

  // useId-derived base for ALL per-series gradient defs (radial disc+gap+ring
  // AND the S8 yGradient vertical fills) — declared before resolvedSeries so
  // the yGradient url can be baked into the resolved rows.
  const gradientBaseId = useSanitizedId();
  // C3: id for the crosshair's optional vertical fade-mask gradient (ported
  // from the deleted scatter-hover-chrome.ts's per-instance
  // `bkm-crosshair-gradient-${chromeId}`, now a stable per-mount id sharing
  // the same base as the marker gradients above).
  const crosshairGradientId = `${gradientBaseId}-crosshair-fade`;

  const resolvedSeries = React.useMemo<ResolvedSeries[]>(
    () =>
      scatters.map((s, index) => {
        const seriesColor =
          DEFAULT_SCATTER_COLORS[index % DEFAULT_SCATTER_COLORS.length]!;
        // bklit series-markers.tsx: resolvedFill = fill ?? seriesConfig.stroke
        // ?? seriesColor, where seriesConfig.stroke = fill || stroke || color
        // (extractScatterConfigs) — net effect: fill ?? stroke ?? color.
        const rawFill = s.fill ?? s.stroke ?? seriesColor;
        // S8 (bklit scatter.tsx): yGradient replaces the marker fill AND the
        // ring stroke (unless an explicit `stroke` prop was set). `fill`/
        // `stroke` below stay RAW — they feed the tooltip dot-color path —
        // while `highlight*` carry the gradient url the MARK and the enlarged
        // hover copy actually paint (bklit's resolvedFill/resolvedStroke).
        const useYGradient = s.yGradient !== undefined && s.yGradient !== false;
        const yGradId = useYGradient ? `${gradientBaseId}-ygrad-${index}` : null;
        return {
          dataKey: s.dataKey,
          yAxisId: s.yAxisId,
          animate: s.animate ?? true,
          fill: rawFill,
          stroke: s.stroke ?? rawFill,
          strokeWidth: s.strokeWidth ?? 2,
          ringGap: s.ringGap ?? 2,
          radius: s.radius ?? 5,
          fadeOnHover: s.fadeOnHover ?? true,
          inactiveOpacity: s.inactiveOpacity ?? 0.5,
          inactiveBlur: s.inactiveBlur ?? 2,
          enterBlur: s.enterBlur ?? 2,
          showActiveHighlight: s.showActiveHighlight ?? true,
          outlineWidth: s.outlineWidth ?? 0,
          outlineColor: s.outlineColor,
          useYGradient,
          yGradFrom: typeof s.yGradient === "object" ? s.yGradient.from ?? DEFAULT_Y_GRADIENT_FROM : DEFAULT_Y_GRADIENT_FROM,
          yGradTo: typeof s.yGradient === "object" ? s.yGradient.to ?? DEFAULT_Y_GRADIENT_TO : DEFAULT_Y_GRADIENT_TO,
          yGradId,
        };
      }),
    [scatters, gradientBaseId],
  );

  // bklit scatter-chart-shell.tsx xRangePadding: max(radius) + 10, or a flat
  // 12px when there are no series yet.
  const xRangePadding = React.useMemo(() => {
    if (resolvedSeries.length === 0) return 12;
    return Math.max(...resolvedSeries.map((s) => s.radius)) + 10;
  }, [resolvedSeries]);

  // bklit y-domain (scatter-specific, D14): max floored at 0 across all
  // series' raw values (negatives silently ignored, ported verbatim), then
  // *1.1, falling back to 100 when nothing is positive; `.nice()` applied by
  // the plain scaleLinear passed to `defineChart` below (y-axis-scales.ts
  // buildYScalesForLines always nices).
  //
  // P6.1 / T-F1 (S6) — this closure is now called once per `yAxisId` group
  // instead of once for the chart. It is deliberately still SCATTER'S OWN rule,
  // passed in as `resolveDomain`, not replaced by the time-series one: D14's
  // floor-at-0 / ignore-negatives / no-padding behaviour is exactly what
  // `resolveYDomainsByAxis` was given a callback seam for.
  const resolveScatterAxisDomain = React.useCallback(
    (axisSeries: { dataKey: string }[]): [number, number] => {
      let max = 0;
      for (const row of data) {
        for (const series of axisSeries) {
          const v = row[series.dataKey];
          if (typeof v === "number" && Number.isFinite(v) && v > max) max = v;
        }
      }
      return [0, max <= 0 ? 100 : max * 1.1];
    },
    [data],
  );

  const yDomainsByAxis = React.useMemo(
    () =>
      resolveYDomainsByAxis({
        series: resolvedSeries,
        resolveDomain: resolveScatterAxisDomain,
      }),
    [resolvedSeries, resolveScatterAxisDomain],
  );

  // Not `domainForAxis`: its last-resort `[0, 100]` happens to match scatter's
  // own empty-input answer, but only by coincidence — running the same closure
  // keeps the two tied together if either ever changes.
  const yDomain = React.useMemo<[number, number]>(
    () => yDomainsByAxis[DEFAULT_Y_AXIS_ID] ?? resolveScatterAxisDomain([]),
    [yDomainsByAxis, resolveScatterAxisDomain],
  );

  // A secondary axis is a value reprojection into the primary (niced) domain —
  // TanStack's spec carries one `y` scale. `yScale` below nices `yDomain`, so
  // the projector's target must be the NICED tuple, not `yDomain` itself.
  // Hoisted because the reference-area layer needs the same NICED per-axis
  // domains the marks are projected into (RA2).
  const nicedDomainsByAxis = React.useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      out[axisId] = createNicedYScale(domain).domain() as [number, number];
    }
    return out;
  }, [yDomainsByAxis]);
  const nicedYDomainScatter = React.useMemo(
    () => createNicedYScale(yDomain).domain() as [number, number],
    [yDomain],
  );
  const projectorFor = React.useMemo(
    () => createAxisValueProjector(nicedDomainsByAxis, nicedYDomainScatter),
    [nicedDomainsByAxis, nicedYDomainScatter],
  );

  // Shared x-extent over the rendered data (single source for BOTH the chart
  // x-scale and the selection scale / reference-area domain — scatter.md
  // deviation: was computed twice per render).
  const timeExtentScatter = React.useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const d of renderData) {
      const v = d[xDataKey];
      if (v instanceof Date) { const t = v.getTime(); if (t < minTime) minTime = t; if (t > maxTime) maxTime = t; }
    }
    if (!Number.isFinite(minTime)) return null;
    return { minTime, maxTime } as const;
  }, [renderData, xDataKey]);

  // Custom x scale: TanStack's `resolveConfiguredScale` unconditionally
  // overwrites a plain scale instance's `.range()`, so the only way to get
  // an inset range (bklit's `xRangePadding`) is the object-with-`resolve`
  // escape hatch (`ChartScale`).
  const xScale = React.useMemo<ChartScale>(() => {
    const { minTime, maxTime } = timeExtentScatter ?? { minTime: 0, maxTime: 0 };
    return {
      id: "x",
      resolve(context) {
        const [r0, r1] = context.range;
        const lo = Math.min(r0, r1);
        const hi = Math.max(r0, r1);
        const insetLo = lo + xRangePadding;
        const insetHi = Math.max(insetLo, hi - xRangePadding);
        const scale = scaleUtc().domain([minTime, maxTime]).range([insetLo, insetHi]);
        // C4: when `xAxis` is configured, tick CHOICE comes from the same
        // pure algorithm the deleted `XAxisOverlay` used (`buildXAxisTickValues`
        // — data-aligned selection / domain-interpolated / brushed-tail
        // modes); positions are mapped through THIS resolver's own inset
        // scale, which spans the identical range the overlay used to
        // interpolate over (`insetLo`/`insetHi` above === the overlay's own
        // `margin.left + xRangePadding` .. `width - margin.right -
        // xRangePadding`). No `xAxis` (labels off): keep the prior plain
        // `scale.ticks()` emission verbatim.
        const ticks = xAxis
          ? buildXAxisTickValues({
              data: renderData,
              xDataKey,
              rangeStart: insetLo,
              rangeEnd: insetHi,
              numTicks: xAxis.numTicks ?? 5,
              formatValue: xAxis.formatValue,
              tickMode: xAxis.tickMode,
            }).map(({ value, label }) => ({
              value,
              position: scale(value) ?? Number.NaN,
              label,
            }))
          : scale.ticks(context.tickCount ?? 5).map((value) => ({
              value,
              position: scale(value) ?? Number.NaN,
              label: value.toISOString(),
            }));
        return {
          id: context.id,
          type: "time",
          domain: scale.domain(),
          map: (value: unknown) => {
            const mapped = scale(value as Date);
            return mapped === undefined ? Number.NaN : mapped;
          },
          ticks,
          bandwidth: 0,
        };
      },
    };
  }, [timeExtentScatter, xRangePadding, renderData, xDataKey, xAxis]);

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
  const gradientDefs = React.useMemo(
    () =>
      resolvedSeries
        .filter((s) => s.strokeWidth > 0 && !s.useYGradient)
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

  // D110 escape hatch: retain the custom ChartScale resolver because the
  // plain scale input would be copied and ranged by TanStack, losing the
  // chart's explicit domain/nice behavior. No local scale stash is needed;
  // hover chrome consumes TanStack's resolved ChartPoints directly.
  const yScale = React.useMemo<ChartScale>(
    () => ({
      id: "y",
      resolve(context) {
        const scale = scaleLinear()
          .domain(yDomain)
          .nice()
          .range(context.range as [number, number]);
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
    }),
    [yDomain, grid],
  );

  // C1: custom ChartFocusStrategy reproducing bklit bisect semantics over
  // ChartPoints (strict `>` tie-break via `>=` guard in strategy).
  const scatterFocusStrategy = React.useMemo(
    () => createScatterFocusStrategy(phaseRef),
    [],
  );

  // Hoisted above `definition` (was previously declared just below it) so the
  // native `tooltip` extension option — which needs both the app-config box
  // spring and the extracted <ChartTooltip> config — can be assembled inside
  // the same memo that builds marks/scales/focus.
  const chartConfig = useChartConfig();

  // C4: replaces `applyLabelFade`/`resetLabelFade` DOM-span mutation — read
  // inside `definition`'s native `tickLabels.opacity` callback below.
  const [labelFade, setLabelFade] = React.useState<{
    primaryX: number;
    hoveredLabel: string | null;
  } | null>(null);

  const definition = React.useMemo(() => {
    if (width <= 0) return null;
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
    // B5: per-datum enter delay inputs, hoisted out of the per-series loop —
    // `innerW`/`durationSec` reproduce this file's pre-B5 `handleRender`'s
    // own locals byte-for-byte (`innerW = width - margin.left - margin.right`,
    // `durationSec = revealDurationMs / 1000`); `easing` is resolved once
    // (native motion tween easing wants a JS progress function, not the CSS
    // string `revealEasingCss` legacy's WAAPI `.animate()` took directly).
    const innerWScatterEnter = Math.max(0, width - margin.left - margin.right);
    const durationSecScatterEnter = revealDurationMs / 1000;
    const scatterEnterEasing = resolveMotionEasing(revealEasingCss);
    for (const series of resolvedSeries) {
      const projectY = projectorFor(series.yAxisId);
      // bklit series-point-marker.tsx `getSeriesMarkerVisualExtent` (pilot
      // parity note carried over from the pre-B5 `handleRender`:
      // outlineWidth always 0, showActiveHighlight always true here, so
      // those two terms are omitted rather than always-zero/always-added).
      const enterRing = series.strokeWidth > 0 ? series.ringGap + series.strokeWidth : 0;
      const enterHighlightPad = series.radius * 0.35;
      const enterVisualExtent = series.radius + enterRing + enterHighlightPad + 2;
      const enterMotion: ChartMotionDefinition<ChartDatum> = series.animate
        ? createScatterEnterMotion(
            enterVisualExtent,
            innerWScatterEnter,
            durationSecScatterEnter,
            ENTER_TWEEN_MS,
            scatterEnterEasing,
          )
        : false;
      if (series.useYGradient) {
        // S8: per-point vertical coloring via a userSpaceOnUse linearGradient
        // (bklit scatter.tsx) — disc AND ring paint the same url(). Emitted as
        // ONE custom mark producing the exact `ts-chart__dot` group + circle
        // DOM shape stock dot() produces, so focus strategy and hover chrome
        // are untouched. One ChartPoint per datum, markId = dataKey.
        marks.push(createYGradientScatterMark(renderData, series, xDataKey, projectY, enterMotion));
        continue;
      }
      const hasRing = series.strokeWidth > 0;
      const gradientId = hasRing
        ? gradientIdBySeries.get(series.dataKey)
        : undefined;
      const baseR = hasRing
        ? series.radius + series.ringGap + series.strokeWidth
        : series.radius;
      // P6/C1: `series.outlineWidth`/`outlineColor` (bklit's hovered-marker
      // outline ring) and `series.inactiveBlur` (2px inactive blur) have no
      // native mark-state channel to express through — `ChartDotStateStyle`
      // covers only {fill,fillOpacity,stroke,strokeOpacity,strokeWidth,
      // opacity,r} (dist/types.d.ts:90), with no filter/blur/outline
      // property. Left as an honest omission rather than a DOM/CSS
      // workaround. D421: blur pending upstream filter state channel.
      const states: ChartMarkState<ChartDatum, ChartDotStateStyle<ChartDatum>>[] = [];
      if (series.showActiveHighlight ?? true) {
        states.push({
          when: { focus: "group" },
          style: { r: baseR * ACTIVE_HIGHLIGHT_SCALE },
          transition: HOVER_STATE_TRANSITION,
        });
      }
      if (series.fadeOnHover ?? true) {
        states.push({
          when: { focus: "unmatched" },
          style: { opacity: series.inactiveOpacity },
          transition: HOVER_STATE_TRANSITION,
        });
      }
      marks.push(
        dot(renderData, {
          id: series.dataKey,
          x: (d: ChartDatum) => d[xDataKey] as Date,
          // P6.1 (S6): identity unless this series names a non-primary axis.
          y: (d: ChartDatum) => projectY(d[series.dataKey] as number),
          r: baseR,
          fill: gradientId ? `url(#${gradientId})` : series.fill,
          stroke: "none",
          states,
          motion: enterMotion,
        }),
      );
    }

    // S11/C3: large datasets snap crosshair/dot/tooltip motion instead of
    // springing (bklit DISCRETE_INTERACTION_THRESHOLD) — hoisted above the
    // tooltip-enabled gate below since the crosshair mark's own motion also
    // needs it, not just the native tooltip extension's.
    const discrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;

    // C3: crosshair + per-series hover-dot marks — native replacement for
    // the deleted scatter-hover-chrome.ts's imperative indicator/dot SVG
    // layers. Both are gated on `tooltip?.enabled` exactly like the native
    // tooltip extension below (no tooltip config -> no hover chrome at all,
    // matching legacy's `attachScatterHoverChrome` only being mounted when
    // `tooltipEnabled`).
    if (tooltip?.enabled ?? false) {
      if (tooltip?.showCrosshair ?? true) {
        // Config resolution mirrors legacy's `buildIndicator` exactly
        // (tooltip-mappers.ts's `toIndicatorConfig` is the byte-identical
        // extraction of the same mapping scatter-hover-chrome.ts used to do
        // inline). PRESERVED QUIRK: `indicatorColor` as a function is never
        // actually invoked — legacy's ternary only special-cased the STRING
        // form, falling through to the CSS var for anything else (including
        // functions); reproduced here verbatim, not "fixed".
        const indicatorCfg = toIndicatorConfig(tooltip);
        const isDashed = Boolean(indicatorCfg.dasharray);
        const fadeSides = resolveVerticalFadeSides(isDashed ? "none" : (indicatorCfg.fadeEdges ?? "both"));
        const indicatorColorValue = typeof indicatorCfg.color === "string" ? indicatorCfg.color : "var(--chart-crosshair)";
        const indicatorSpringCfg = indicatorCfg.springConfig ?? chartConfig.tooltipSpring;
        // Choice (see C3 report): native `crosshair()`'s vertical rule
        // reproduces legacy's indicator geometry directly — width/color/
        // dasharray/fade-gradient all map onto its `x` rule options one for
        // one, and its `strokeOpacity` default of 0.35 (dist/crosshair.js
        // `resolveRuleStyle`) is explicitly overridden to 1 to avoid a
        // silent visual regression. `y` stays off (legacy never drew a
        // horizontal guide).
        marks.push(
          buildIndicatorMark({
            gradientId: crosshairGradientId,
            width: indicatorCfg.width,
            span: indicatorCfg.span,
            columnWidth: indicatorCfg.columnWidth,
            dasharray: indicatorCfg.dasharray,
            color: indicatorColorValue,
            useGradient: !isDashed && fadeSides.any,
            strokeOpacity: 1,
            spring: indicatorSpringCfg,
            discrete,
          }) as ChartMark<ChartDatum, Date, number>,
        );
      }
      if (tooltip?.showDots ?? true) {
        // Choice (see C3 report): a custom `whenFocused(mark, {match:'group',
        // retarget:true})` hover-dot mark, NOT `crosshair()`'s own `marker`
        // option — that option draws exactly one marker at the primary
        // focused point, but legacy draws one enlarged dot PER SERIES
        // sharing the hovered x (bklit's per-series tooltip-dot layer).
        // `match:'group'` selects every point TanStack's own focus grouping
        // already gathered (scatter-focus-strategy.ts); `retarget:true` gets
        // legacy's "jump on first show, spring while already visible" dot
        // motion for free (a freshly-appearing retargeted node has no prior
        // DOM element to interpolate from, so it jumps) — see
        // `createHoverDotMark` above for why its motion is unconditional.
        resolvedSeries.forEach((series, seriesIndex) => {
          const projectY = projectorFor(series.yAxisId);
          marks.push(
            whenFocused(
              createHoverDotMark(renderData, series, xDataKey, projectY, seriesIndex, tooltip ?? null, chartConfig.tooltipSpring),
              { match: "group", retarget: true },
            ),
          );
        });
      }
    }

    const gridGuide = resolveGridGuide(grid);
    const spec = {
      marks,
      // CH3/CH4: tick counts reach the guides only via `axis.ticks.count`
      // (charts-core resolveTickCount → context.tickCount); a bare `ticks:`
      // key on the spec is never read.
      scales: {
        x: {
          scale: xScale,
          grid: gridGuide.vertical,
          axis: buildFadeXAxisOptions(gridGuide.columnTicks, xAxis ?? undefined, margin.bottom, labelFade),
        },
        y: {
          scale: yScale,
          grid: gridGuide.horizontal,
          // Scatter never had y-axis labels (no `YAxisOverlay` counterpart
          // existed pre-C4) — labels stay off, only the tick-driven grid
          // line count is native-configured.
          axis: hiddenAxisOptions(gridGuide.ticks),
        },
      },
      margin,
      // bklit scatter has no data-update tween (Line-only concept, I8) — new
      // data always snaps, once loaded, exactly like bklit's
      // StaticSeriesPointMarker (D14).
      svgAnimation: false as const,
      // T-D15 (P3.1): explicit 5-entry palette override, NOT the native
      // 6-entry defaultChartTheme.palette — see internal/design-tokens.ts.
      // Every series already carries an explicit `fill` (resolved from
      // DEFAULT_SCATTER_COLORS above), so this has no pixel effect today.
      theme: { palette: CHART_CATEGORY_PALETTE, muted: "var(--color-chart-label, var(--chart-label))" },
    } as const;
    const base = defineChart(spec);
    const withFocus = defineChart(base, {
      focus: scatterFocusStrategy,
      focusRing: false,
      maxFocusDistance: Number.POSITIVE_INFINITY,
    });
    // C2: native tooltip extension replaces the deleted DOM box/panel
    // (tooltip-chrome.ts's buildBox/positionBox/applyBoxContent) — body
    // content comes from `renderTooltipBody` below, reusing bklit's existing
    // `TooltipContent` component verbatim. bklit anchors the box at the
    // hovered point with a left/right flip (positionBox's `flip` calc); the
    // native equivalent is `anchor:'point'` + `placement:['right','left']`.
    // `sticky:false` matches the task-wide C2 ruling (no click-to-pin here).
    // Motion mirrors the legacy TOOLTIP_BOX_SPRING (panel-follow spring, via
    // ChartConfigProvider's `tooltipBoxSpring`, same override surface the
    // deleted `resolveBoxSpring` read) — snapped to `false` past the same
    // DISCRETE_INTERACTION_THRESHOLD the imperative code used to gate
    // `.jump()` vs `.set()`.
    if (!(tooltip?.enabled ?? false)) {
      return withFocus as StaticChartDefinition<ChartDatum, Date, number, "dom">;
    }
    return defineChart(withFocus, {
      tooltip: buildNativeTooltipExtension<ChartDatum, Date, number>({
        enabled: tooltip?.enabled ?? false,
        spring: chartConfig.tooltipBoxSpring,
        discrete,
        className: tooltip?.className,
        offset: BOX_OFFSET,
        anchor: "point",
      }),
    }) as StaticChartDefinition<ChartDatum, Date, number, "dom">;
    // B5: `revealDurationMs`/`revealEasingCss` feed `enterMotion` above (per-
    // series enter delay/transition), so the definition must rebuild when
    // either changes.
  }, [renderData, xDataKey, resolvedSeries, grid, width, yScale, xScale, margin, gradientIdBySeries, scatterFocusStrategy, projectorFor, tooltip, chartConfig.tooltipBoxSpring, chartConfig.tooltipSpring, crosshairGradientId, xAxis, labelFade, revealDurationMs, revealEasingCss]);

  // C3: what remains app-owned after the crosshair/tooltip-dot geometry
  // moved to native marks (in the `definition` useMemo above) — just the
  // date pill + axis-label proximity fade, wired via `attachScatterPillChrome`.
  const tooltipEnabled = tooltip?.enabled ?? false;
  const pillChromeRef = React.useRef<ScatterPillChrome | null>(null);
  const pillChromeStateRef = React.useRef<ScatterPillChromeState | null>(null);
  const dateLabelsForPill = React.useMemo(() => renderData.map((d) => {
    const v = d[xDataKey];
    if (v instanceof Date) return shortDateFmt.format(v);
    return String(v ?? "");
  }), [renderData, xDataKey]);
  pillChromeStateRef.current = {
    xDataKey,
    pointCount: renderData.length,
    showDatePill: tooltip?.showDatePill ?? true,
    // CH5/B12: bklit XAxis.tickerHalfWidth drives the date-pill label-fade radius.
    tickerHalfWidth: xAxis?.tickerHalfWidth,
    dateLabels: dateLabelsForPill,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  // C4: guarded so `attachScatterPillChrome`'s per-pointer-move `update()`
  // doesn't force a `labelFade`-consuming `definition` rebuild on every
  // frame when the fade state hasn't actually changed.
  const handleLabelFadeChange = React.useCallback(
    (fade: { primaryX: number; hoveredLabel: string | null } | null) => {
      setLabelFade((prev) => {
        if (fade === null) return prev === null ? prev : null;
        if (prev && prev.primaryX === fade.primaryX && prev.hoveredLabel === fade.hoveredLabel) return prev;
        return fade;
      });
    },
    [],
  );

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachScatterPillChrome(
      el,
      () => pillChromeStateRef.current!,
      chartConfig.tooltipSpring,
      handleLabelFadeChange,
    );
    pillChromeRef.current = chrome;
    return () => {
      pillChromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig, handleLabelFadeChange]);

  // C1/C3: TanStack-native hover via ChartFocusStrategy drives the pill
  // chrome directly with raw ChartPoints — the crosshair/tooltip-dot chrome
  // used to need a mapped ScatterFocusPoint[] (per-series fill resolution
  // for the DOM dot layer); that layer is gone, so the pill only needs
  // `datum`/`datumIndex`/`x` off the primary (first) point, both already on
  // ChartPoint.
  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      // S11 (bklit use-scatter-chart-interaction.ts): a drag arms on
      // pointerdown and clears the tooltip; hover updates are suppressed for
      // the whole drag (same gate as line/candlestick's dragSelectionActiveRef).
      if (dragSelectionActiveRef.current) {
        pillChromeRef.current?.update([]);
        return;
      }
      pillChromeRef.current?.update(points);
    },
    [],
  );

  // C2: native tooltip body — reuses bklit's existing `TooltipContent`
  // (internal/tooltip-components.tsx) and the same title/rows composition
  // the deleted `applyBoxContent` used (scatter-hover-chrome.ts's former
  // inline block): `tooltip.rows` overrides row-building entirely; otherwise
  // one row per series, colored by series fill falling back to the focused
  // point's own color. `tooltip.content` — when present — REPLACES the
  // default body entirely (bklit's `applyBoxContent` custom-content branch
  // never renders rows/children alongside custom content). `panelStyle`/
  // `backgroundColor` (ChartTooltipConfig fields with no native-option
  // equivalent) are re-applied as a wrapping style override so existing
  // per-chart customizations keep working.
  const renderTooltipBody = React.useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChartDatum, Date, number>): React.ReactNode => {
      const { points } = ctx;
      if (points.length === 0) return null;
      const primary = points[0]!;
      const datum = primary.datum as Record<string, unknown>;
      const dateValue = datum[xDataKey];
      const isDate = dateValue instanceof Date;

      let body: React.ReactNode;
      if (tooltip?.content) {
        body = tooltip.content({
          point: datum as ChartTooltipPoint,
          index: primary.datumIndex,
        });
      } else {
        const title: string | undefined = isDate
          ? weekdayDateFmt.format(dateValue as Date)
          : undefined;
        const rows: TooltipRow[] = tooltip?.rows
          ? tooltip.rows(datum)
          : resolvedSeries.map((series) => {
              const point = points.find((p) => p.markId === series.dataKey);
              const v = datum[series.dataKey];
              return {
                color: series.fill || point?.color || "transparent",
                label: series.dataKey,
                value: typeof v === "number" ? v : String(v ?? 0),
              };
            });
        body = (
          <TooltipContent title={title} rows={rows}>
            {tooltip?.children}
          </TooltipContent>
        );
      }
      if (!tooltip?.panelStyle && !tooltip?.backgroundColor) return body;
      return (
        <div
          style={{
            ...(tooltip?.panelStyle ?? {}),
            ...(tooltip?.backgroundColor ? { backgroundColor: tooltip.backgroundColor } : {}),
          }}
        >
          {body}
        </div>
      );
    },
    [tooltip, resolvedSeries, xDataKey],
  );

  // S11 (bklit useScatterChartInteraction): drag-select + two-finger range
  // selection. Selection lives only while the gesture is active (cleared on
  // pointerup/leave/touchend) and is exposed via ChartSelectionContext for
  // Segment children, exactly like line/area/composed. The selection x-scale
  // mirrors bklit's own: scaleUtc over the time extent with the same inset
  // range as the rendered chart scale.
  const innerWidthSelection = Math.max(0, width - margin.left - margin.right);

  // C5/B5 (D432): mount reveal — was bklit's per-marker framer entrance
  // equivalent (one WAAPI tween per rendered circle, delayed by on-screen x
  // position, fired imperatively from `onRender`, zero React in the
  // animation path per D10); now the NATIVE motion renderer's own per-
  // element enter fade, driven by the `enterMotion` callback built per
  // series inside the `definition` useMemo above (`createScatterEnterMotion`
  // — same delay formula, opacity only, see that function's header for what
  // changed/dropped). `handleRender` no longer instantiates or drives any
  // animation itself — the entire deferred-setup/backwards-fill/DOM-
  // querySelector apparatus this used to need to avoid blocking first paint
  // (see prior revisions of this comment) is gone along with it, since the
  // native renderer's own commit path already defers its motion setup off
  // the synchronous mount path. What's left is exactly what bar-chart.tsx's
  // `handleRender` also reduced to: (1) track `phaseRef` ("revealing" ->
  // "ready") for `onPhaseChange`, gated by the SAME `seenRevealKeyRef`/
  // `revealKeyRef` replay-key shape this file already used (S3/D311,
  // untouched by B5); (2) arm a deadline timer approximating "the reveal
  // finished," since native motion exposes no per-mark completion callback
  // (confirmed against dist/motion.js/dist/types.d.ts — same absence bar-
  // chart's B2 report cites). The deadline is `revealDurationMs +
  // ENTER_TWEEN_MS` (full stagger span + the fixed fade duration), NOT the
  // legacy `revealDurationMs` alone — the old deadline doubled as a
  // force-`.cancel()` cutoff for any circle still mid-fade (WAAPI
  // `animationsRef` cancellation), truncating its animation early; there is
  // no equivalent way to reach into and interrupt an individual native
  // motion track from outside; the deadline is a wait-for-actual-completion
  // bound instead of a truncation, so "ready" now fires once every point has
  // genuinely finished rather than approximately when most have.
  const handleRender = React.useCallback((context: ChartRendererRenderContext<ChartDatum, Date, number>) => {
    // B1: the renderer context has no `svg` member under RendererChart —
    // `surface.element` is the mounted `<svg class="ts-chart">` root itself.
    const svgRoot = context.surface.element as SVGSVGElement;
    captureRenderContext(context);
    const marksGroup = svgRoot.querySelector<SVGGElement>(".ts-chart__marks");
    // S3: the replay KEY is tested BEFORE the DOM stamp. The stamp latches for
    // the life of the marks node, so a caller bumping `revealSignature` on a
    // surviving node would be swallowed here and S3 would land inert.
    const seen = seenRevealKeyRef.current;
    const revealKey = revealKeyRef.current;
    const revealKeyChanged =
      seen === null ||
      seen.signature !== revealKey.signature ||
      seen.duration !== revealKey.duration;
    if (
      !marksGroup ||
      animationDuration <= 0 ||
      (isRevealed(marksGroup) && !revealKeyChanged)
    ) {
      setPhase("ready");
      return;
    }
    // P4.6 (M3a): the reveal runs once per component lifetime. The scene (and
    // with it the .ts-chart__marks group) is rebuilt on every data swap, so
    // the DOM-side `dataset.bkmRevealed` guard dies with the old node and the
    // mount reveal used to replay on EVERY update. Three states, keyed on
    // seenRevealKeyRef + the pending deadline:
    //   first call            -> run the reveal, arm the deadline
    //   revealed, deadline up -> the group was replaced mid-window; restart
    //                            the reveal (the pre-P4.6 self-heal, now
    //                            bounded to the mount window)
    //   revealed, deadline
    //   fired (ref nulled)    -> snap: bklit snaps on data updates
    //                            (StaticSeriesPointMarker, D14)
    if (seen !== null) {
      if (revealDeadlineTimerRef.current === null) {
        // Mount window closed. Snap — UNLESS the caller opened a new one.
        if (!revealKeyChanged) {
          setPhase("ready");
          return;
        }
      } else {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    }
    seenRevealKeyRef.current = { ...revealKey };
    markRevealed(marksGroup);
    setPhase("revealing");
    const deadlineMs = revealDurationMs + ENTER_TWEEN_MS;
    revealDeadlineTimerRef.current = setRevealDeadline(deadlineMs, {
      onDeadline: () => {
        // P4.6 (M3a): close the mount reveal window — later onRender calls
        // (every data swap) must take the snap path, never re-reveal.
        revealDeadlineTimerRef.current = null;
        setPhase("ready");
      },
    });
  }, [animationDuration, revealDurationMs, setPhase, captureRenderContext]);

  const refAreaChildrenScatter = React.useMemo(() => extractReferenceAreaProps(children), [children]);
  const heightPxScatter = width > 0 ? width / parseAspectRatio(aspectRatio) : 0;

  // S8 defs: one userSpaceOnUse vertical linearGradient per yGradient series,
  // spanning the plot area exactly like bklit's `<Scatter>`-rendered
  // `<defs><linearGradient y1={innerHeight} y2={0}>`. Lives in the same 0×0
  // sibling svg as the radial marker gradients (document-wide url() refs).
  const yGradientDefs = React.useMemo(
    () =>
      resolvedSeries
        .filter((s) => s.useYGradient && s.yGradId)
        .map((s) => ({ id: s.yGradId as string, from: s.yGradFrom, to: s.yGradTo })),
    [resolvedSeries],
  );

  // C3: the crosshair's vertical fade-mask gradient, an app-owned
  // `linearGradient` def referenced by the native `crosshair()` mark's
  // `stroke: url(#id)` (the mark protocol has no built-in fade-mask concept —
  // this is the sanctioned escape hatch the task's mission item 1 calls out).
  // Stops come from the same `indicatorFadeGradientStops` legacy's
  // `buildIndicator` used; gate conditions mirror the `definition` useMemo's
  // crosshair-mark branch exactly (dashed indicators never fade; no-fade
  // configs need no gradient at all).
  const crosshairFadeGradient = React.useMemo(() => {
    if (!(tooltip?.enabled ?? false) || !(tooltip?.showCrosshair ?? true)) return null;
    const indicatorCfg = toIndicatorConfig(tooltip);
    if (indicatorCfg.dasharray) return null;
    const fadeSides = resolveVerticalFadeSides(indicatorCfg.fadeEdges ?? "both");
    if (!fadeSides.any) return null;
    const colorValue = typeof indicatorCfg.color === "string" ? indicatorCfg.color : "var(--chart-crosshair)";
    return {
      id: crosshairGradientId,
      color: colorValue,
      stops: indicatorFadeGradientStops(fadeSides, indicatorCfg.fadeLength ?? 10),
    };
  }, [tooltip, crosshairGradientId]);

  // S11: the drag-select hook. C6: replaces the deleted plot-local
  // `xScaleForSelection` duplicate d3 scale (which approximated marker-radius
  // padding via `xRangePadding`) — resolves through the host's own live
  // interaction/scene refs, which already reflect the chart's real marker
  // geometry exactly.
  const invertSceneXScatter = React.useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX) ?? null,
    [sceneRef],
  );

  const { selection: scatterSelection } = useChartSelection({
    enabled: true,
    innerWidth: innerWidthSelection,
    marginLeft: margin.left,
    data: renderData as unknown as Array<Record<string, unknown>>,
    xDataKey,
    resolveScenePos: clientToScene,
    invertSceneX: invertSceneXScatter,
    containerRef,
    onDragStart: () => {
      dragSelectionActiveRef.current = true;
      pillChromeRef.current?.update([]);
    },
    onDragEnd: () => {
      dragSelectionActiveRef.current = false;
    },
  });

  return (
    <ChartSelectionContext.Provider value={scatterSelection}>
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio, touchAction: "none", isolation: "isolate" } as React.CSSProperties}
      data-bkm-chart="scatter"
    >
      {background ? (
        <BackgroundLayer
          config={background}
          innerWidth={Math.max(0, width - margin.left - margin.right)}
          innerHeight={Math.max(0, heightPxScatter - margin.top - margin.bottom)}
          marginLeft={margin.left}
          marginTop={margin.top}
        />
      ) : null}
      {definition ? (
        <>
          <RendererChart
            ariaLabel="Scatter chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            renderer={chartMotionRenderer<ChartDatum, Date, number>()}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
            renderTooltipBody={renderTooltipBody}
          />
          {gradientDefs.length > 0 || yGradientDefs.length > 0 || crosshairFadeGradient ? (
            // Rendered AFTER <RendererChart> deliberately: QA's screenshot harness
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
                {yGradientDefs.map((g) => (
                  <linearGradient
                    key={g.id}
                    id={g.id}
                    gradientUnits="userSpaceOnUse"
                    x1={0}
                    x2={0}
                    y1={heightPxScatter}
                    y2={0}
                  >
                    <stop offset="0%" stopColor={g.from} />
                    <stop offset="100%" stopColor={g.to} />
                  </linearGradient>
                ))}
                {crosshairFadeGradient ? (
                  <linearGradient
                    key={crosshairFadeGradient.id}
                    id={crosshairFadeGradient.id}
                    gradientUnits="userSpaceOnUse"
                    x1={0}
                    x2={0}
                    y1={margin.top}
                    y2={margin.top + Math.max(0, heightPxScatter - margin.top - margin.bottom)}
                  >
                    {crosshairFadeGradient.stops.map((s, i) => (
                      <stop key={i} offset={s.offset} stopColor={crosshairFadeGradient.color} stopOpacity={s.opacity} />
                    ))}
                  </linearGradient>
                ) : null}
              </defs>
            </svg>
          ) : null}
          {heightPxScatter > 0 && (
            <ReferenceAreaLayers
              configs={refAreaChildrenScatter}
              geom={{
                width,
                height: heightPxScatter,
                margin,
                // RA2 — NICED, matching the scale the dots paint in (the raw
                // `yDomain` was off by the nicing delta).
                yDomain: nicedYDomainScatter,
                yDomainsByAxis: nicedDomainsByAxis,
                xDomain: timeExtentScatter ? ([new Date(timeExtentScatter.minTime), new Date(timeExtentScatter.maxTime)] as unknown as [Date, Date]) : undefined,
                isTimeScale: true,
                xRangePadding,
              }}
            />
          )}
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

// Legacy parity: bklit `scatter-chart.tsx` ships `export default ScatterChart;` (T-E2).
export default ScatterChart;
