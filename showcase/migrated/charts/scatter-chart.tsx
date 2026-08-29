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
import { Chart } from "@tanstack/react-charts";
import { defineChart, dot } from "@tanstack/charts";
import type {
  ChartDotStateStyle,
  ChartMark,
  ChartMarkState,
  ChartPoint,
  ChartScale,
  ChartValue,
  SceneNode,
  StaticChartDefinition,
} from "@tanstack/charts";
import { extractChildren } from "./children";
import { ChartSelectionContext, useChartSelection } from "./internal/chart-selection";
import {
  attachScatterHoverChrome,
  type ScatterFocusPoint,
  type ScatterHoverChrome,
  type ScatterHoverChromeState,
} from "./internal/scatter-hover-chrome";
import { ReferenceAreaLayers } from "./internal/reference-area-layer";
import { BackgroundLayer } from "./internal/background-layer";
import { extractReferenceAreaProps } from "./internal/reference-area-config";
import { useChartConfig } from "./internal/chart-config-context";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import type { ChartDatum, ChartPhase } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { resolveGridGuide } from "./internal/grid";
import { createScatterFocusStrategy } from "./internal/scatter-focus-strategy";
import "./styles.css";
import { isRevealed, markRevealed, onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { useChartMargin, DEFAULT_CHART_MARGIN, useContainerWidth, type ChartMargin } from "./internal";
import { CHART_CATEGORY_PALETTE } from "./internal/design-tokens";
import { shortDateFmt } from "./internal/formatters";
import { useSanitizedId } from "./internal/use-sanitized-id";
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

// S8 (bklit scatter.tsx yGradient): custom ChartMark emitting the EXACT DOM
// shape stock `dot()` produces — one `.ts-chart__dot[data-ts-key]` group per
// series, one `<circle>` per datum — so scatter's reveal (`querySelectorAll
// ("circle")`), focus strategy, and hover chrome all work unchanged. The disc
// AND ring circles paint a per-series userSpaceOnUse linear gradient spanning
// the plot height (from at y=innerHeight, to at y=0), which is how bklit gets
// per-point vertical coloring with ordinary fills. One ChartPoint per datum
// (markId = dataKey) keeps TanStack's focus grouping identical to stock dot().
function createYGradientScatterMark(
  source: readonly ChartDatum[],
  series: ResolvedSeries,
  xDataKey: string,
  /** P6.1 (S6): identity for the primary axis; see `createAxisValueProjector`. */
  projectY: (value: number) => number,
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
  const revealAnimationsRef = React.useRef<Animation[]>([]);
  const revealDeadlineTimerRef = React.useRef<number | null>(null);
  const revealPostPaintCancelRef = React.useRef<(() => void) | null>(null);
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

  // Teardown: cancel the pending reveal deadline + post-paint chain + any
  // in-flight per-circle WAAPI animations on unmount (D205 canonical wording).
  React.useEffect(() => {
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
      revealPostPaintCancelRef.current?.();
      revealPostPaintCancelRef.current = null;
      for (const anim of revealAnimationsRef.current) {
        try {
          anim.cancel();
        } catch { /* teardown race — already cancelled */ }
      }
      revealAnimationsRef.current = [];
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
  }, [timeExtentScatter, xRangePadding]);

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

  const definition = React.useMemo(() => {
    if (width <= 0) return null;
    const marks: ChartMark<ChartDatum, Date, number>[] = [];
    for (const series of resolvedSeries) {
      const projectY = projectorFor(series.yAxisId);
      if (series.useYGradient) {
        // S8: per-point vertical coloring via a userSpaceOnUse linearGradient
        // (bklit scatter.tsx) — disc AND ring paint the same url(). Emitted as
        // ONE custom mark producing the exact `ts-chart__dot` group + circle
        // DOM shape stock dot() produces, so reveal/focus/chrome machinery is
        // untouched. One ChartPoint per datum, markId = dataKey.
        marks.push(createYGradientScatterMark(renderData, series, xDataKey, projectY));
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
        }),
      );
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
          axis: { ticks: { count: gridGuide.columnTicks } },
        },
        y: {
          scale: yScale,
          grid: gridGuide.horizontal,
          axis: { ticks: { count: gridGuide.ticks } },
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
      theme: { palette: CHART_CATEGORY_PALETTE },
    } as const;
    const base = defineChart(spec);
    return defineChart(base, {
      focus: scatterFocusStrategy,
      focusRing: false,
      maxFocusDistance: Number.POSITIVE_INFINITY,
    }) as StaticChartDefinition<ChartDatum, Date, number, "dom">;
  }, [renderData, xDataKey, resolvedSeries, grid, width, yScale, xScale, margin, gradientIdBySeries, scatterFocusStrategy, projectorFor]);

  // Hover chrome (bklit ChartTooltip, scatter dim/highlight variant).
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chartConfig = useChartConfig();
  const chromeRef = React.useRef<ScatterHoverChrome | null>(null);
  const chromeStateRef = React.useRef<ScatterHoverChromeState | null>(null);
  const dateLabelsForPill = React.useMemo(() => renderData.map((d) => {
    const v = d[xDataKey];
    if (v instanceof Date) return shortDateFmt.format(v);
    return String(v ?? "");
  }), [renderData, xDataKey]);
  // S12/K-1 (go-to-plan.md): the provider's box spring is the live default at
  // the part→config boundary; a per-<ChartTooltip> boxSpringConfig /
  // matchCrosshair / damping still overrides it inside resolveBoxSpring —
  // same precedence the deleted per-chrome option applied.
  const tooltipWithBoxSpring = React.useMemo(() => {
    if (!tooltip) return null;
    if (tooltip.boxSpringConfig || tooltip.matchCrosshair || tooltip.damping !== undefined) return tooltip;
    return { ...tooltip, boxSpringConfig: chartConfig.tooltipBoxSpring };
  }, [tooltip, chartConfig.tooltipBoxSpring]);
  chromeStateRef.current = {
    margin,
    // P6/C1: the dim/pop fields (fadeOnHover, inactiveOpacity, inactiveBlur,
    // outlineWidth/Color, showActiveHighlight, stroke, strokeWidth, ringGap,
    // radius, highlightFill/Stroke) all drove the now-deleted DOM dim/clone
    // machinery in scatter-hover-chrome.ts — that behavior is native `dot()`
    // mark `states` now (see the `definition` useMemo above). The chrome only
    // needs `fill` left, for tooltip-dot color resolution
    // (`ScatterHoverChromeSeries`, scatter-hover-chrome.ts).
    series: resolvedSeries.map((s) => ({
      dataKey: s.dataKey,
      fill: s.fill,
    })),
    xDataKey,
    pointCount: renderData.length,
    showCrosshair: tooltip?.showCrosshair ?? true,
    showDots: tooltip?.showDots ?? true,
    showDatePill: tooltip?.showDatePill ?? true,
    // CH5/B12: bklit XAxis.tickerHalfWidth drives the date-pill label-fade radius.
    tickerHalfWidth: xAxis?.tickerHalfWidth,
    tooltip: tooltipWithBoxSpring,
    dateLabels: dateLabelsForPill,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachScatterHoverChrome(el, () => chromeStateRef.current!, {
      tooltipSpring: chartConfig.tooltipSpring,
    });
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition, chartConfig]);

  // C1: TanStack-native hover via ChartFocusStrategy — adapter from
  // TanStack ChartPoint -> ScatterFocusPoint for the chrome.
  // Color resolved via series fill (matches prior per-series mapping).
  const fillBySeries = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of resolvedSeries) m.set(s.dataKey, s.fill);
    return m;
  }, [resolvedSeries]);

  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      // S11 (bklit use-scatter-chart-interaction.ts): a drag arms on
      // pointerdown and clears the tooltip; hover updates are suppressed for
      // the whole drag (same gate as line/candlestick's dragSelectionActiveRef).
      if (dragSelectionActiveRef.current) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      if (points.length === 0) {
        chromeRef.current?.onFocusGroupChange([]);
        return;
      }
      const mapped: ScatterFocusPoint[] = points.map((p) => ({
        markId: p.markId,
        datum: p.datum,
        datumIndex: p.datumIndex,
        x: p.x,
        y: p.y,
        color: fillBySeries.get(p.markId) ?? p.color,
      }));
      chromeRef.current?.onFocusGroupChange(mapped);
    },
    [fillBySeries],
  );

  // S11 (bklit useScatterChartInteraction): drag-select + two-finger range
  // selection. Selection lives only while the gesture is active (cleared on
  // pointerup/leave/touchend) and is exposed via ChartSelectionContext for
  // Segment children, exactly like line/area/composed. The selection x-scale
  // mirrors bklit's own: scaleUtc over the time extent with the same inset
  // range as the rendered chart scale.
  const innerWidthSelection = Math.max(0, width - margin.left - margin.right);

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
    // mount reveal used to replay on EVERY update (~n·series animate()
    // instantiations + blur rasterization inside the update->paint window).
    // Three states, keyed on seenRevealKeyRef + the pending deadline:
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
        revealPostPaintCancelRef.current?.();
        revealPostPaintCancelRef.current = null;
      } else {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
        revealPostPaintCancelRef.current?.();
        revealPostPaintCancelRef.current = null;
      }
    }
    seenRevealKeyRef.current = { ...revealKey };
    markRevealed(marksGroup);
    setPhase("revealing");
    // Force-snap at deadline: `.cancel()` drops Animations from the active
    // list entirely — see `setRevealDeadline` in deferred-reveal.ts for the
    // rationale (avoiding M3a regression from lingering finished Animations).
    revealDeadlineTimerRef.current = setRevealDeadline(revealDurationMs, {
      animationsRef: revealAnimationsRef,
      onDeadline: () => {
        // P4.6 (M3a): close the mount reveal window — later onRender calls
        // (every data swap) must take the snap path, never re-reveal.
        revealDeadlineTimerRef.current = null;
        setPhase("ready");
      },
    });

    marksGroup.classList.add("ts-chart__marks--revealing");
    const innerW = Math.max(0, width - margin.left - margin.right);
    // bklit series-markers.tsx:102 — the per-point stagger spans the CLIP
    // reveal's duration, which `enterTransition` may override.
    const durationSec = revealDurationMs / 1000;

    revealPostPaintCancelRef.current = onPostPaint(() => {
      for (const series of resolvedSeries) {
        // S7 — bklit series-markers.tsx:104 gates the whole enter branch on
        // `animate && !isLoaded`; a non-animating series paints at final state.
        if (!series.animate) continue;
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
                { opacity: 0, filter: `blur(${series.enterBlur}px)` },
                { opacity: 1, filter: "blur(0px)" },
              ],
              {
                // bklit series-markers.tsx:103 pins this at 0.5s: the FADE is
                // fixed, only the stagger SPAN follows `enterTransition`.
                duration: ENTER_TWEEN_MS,
                delay: delaySec * 1000,
                easing: revealEasingCss,
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
  }, [animationDuration, revealDurationMs, revealEasingCss, margin.left, margin.right, resolvedSeries, setPhase, width]);

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

  // S11: the drag-select hook (after timeExtentScatter — its x-scale memo
  // consumes that extent). See the comment block at innerWidthSelection.
  const xScaleForSelection = React.useMemo(() => {
    if (!timeExtentScatter) return null;
    return scaleUtc()
      .domain([new Date(timeExtentScatter.minTime), new Date(timeExtentScatter.maxTime)])
      .range([xRangePadding, Math.max(xRangePadding, innerWidthSelection - xRangePadding)]);
  }, [timeExtentScatter, innerWidthSelection, xRangePadding]);

  const { selection: scatterSelection } = useChartSelection({
    enabled: true,
    innerWidth: innerWidthSelection,
    marginLeft: margin.left,
    data: renderData as unknown as Array<Record<string, unknown>>,
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
          <Chart
            ariaLabel="Scatter chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
          />
          {gradientDefs.length > 0 || yGradientDefs.length > 0 ? (
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
              tickMode={xAxis.tickMode}
            />
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
