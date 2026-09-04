import { useMemo } from "react";
import type { ChartMotionContext, StaticChartDefinition } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { polar } from "@tanstack/charts/polar";
import { sunburst } from "@tanstack/charts/hierarchy/sunburst";
import type { SunburstNode as TSSunburstNode } from "@tanstack/charts/hierarchy/sunburst";
import { buildSunburstFlatRows, ringOptions } from "./sunburst-geometry";
import type { ArcDatum, Focus, SunburstFlatRow } from "./sunburst-geometry";
import { defaultSunburstColors, opacityForRelativeDepth } from "./sunburst-colors";
import type { SunburstNode } from "./sunburst-types";
import { buildRevealTiming } from "./sunburst-reveal";
import { CHART_CATEGORY_PALETTE } from "./design-tokens";
import { motionEasingFromCss } from "./pie-hover-chrome";

// Full opacity: the undimmed alpha for the hovered arc and its relatives.
const FULL_OPACITY = 1;
// Hover-dim alpha for arcs unrelated to the hovered arc (bklit 0.25, styles.css:424-427).
const HOVER_DIM_ALPHA = 0.25;
// Minimum visible ring depth: resolveVisibleDepth never drops below the focused ring itself.
const MIN_VISIBLE_DEPTH = 1;
// Percentage scale for color-mix alpha weights: unit alpha (0-1) formats as 0-100%.
const ALPHA_TO_PERCENT = 100;

const applyAlphaToColor = (color: string, alpha: number): string => {
  if (alpha >= FULL_OPACITY) {return color;}
  return `color-mix(in srgb, ${color} ${Math.round(alpha * ALPHA_TO_PERCENT)}%, transparent)`;
};

// Hover/dim small helpers, hoisted so render-path callbacks stay thin.
const hoverDimFactor = (arcId: string, hoveredId: string | undefined): number => {
  if (hoveredId === undefined) {
    return FULL_OPACITY;
  }
  if (arcId === hoveredId || arcId.startsWith(`${hoveredId} / `) || hoveredId.startsWith(`${arcId} / `)) {
    return FULL_OPACITY;
  }
  return HOVER_DIM_ALPHA;
};

const resolveVisibleDepth = (maxDepth: number, focusDepth: number): number => Math.max(MIN_VISIBLE_DEPTH, maxDepth - focusDepth);
const resolveCenterR = (focusDepth: number, maxDepth: number, radius: number): number =>
  ringOptions(focusDepth, maxDepth, radius).centerR;

interface SunburstSegmentConfigView {
  readonly color?: string;
  readonly fill?: string;
  readonly fillOpacity?: number;
}

interface SunburstHoveredArcView {
  readonly id: string;
}

type SunburstFillResolver = (arcIndex: number, fillOverride?: string, colorOverride?: string) => string;

interface UseSunburstDefinitionOptions {
  readonly data: SunburstNode;
  readonly arcs: readonly ArcDatum[];
  readonly focus: Readonly<Focus>;
  readonly maxDepth: number;
  readonly radius: number;
  readonly playKey: number;
  readonly enterStaggerScale: number;
  readonly segmentConfigMap: ReadonlyMap<number, SunburstSegmentConfigView>;
  readonly getFill: SunburstFillResolver;
  readonly hoveredArc: Readonly<SunburstHoveredArcView> | null;
  readonly sweepDurationMs: number;
  readonly sweepEasingCss: string;
  readonly zoomMs: number;
  readonly zoomEasingCss: string;
}

interface UseSunburstDefinitionState {
  readonly arcsById: ReadonlyMap<string, ArcDatum>;
  readonly sunburstMarkId: string;
  readonly definition: StaticChartDefinition<TSSunburstNode<SunburstFlatRow>, number, number, "dom">;
}

const useSunburstDefinition = (options: Readonly<UseSunburstDefinitionOptions>): UseSunburstDefinitionState => {
  const {
    data,
    arcs,
    focus,
    maxDepth,
    radius,
    playKey,
    enterStaggerScale,
    segmentConfigMap,
    getFill,
    hoveredArc,
    sweepDurationMs,
    sweepEasingCss,
    zoomMs,
    zoomEasingCss,
  } = options;

  /*
   * Native stratifies flat rows, not the nested tree; `arcsById` bridges native callbacks back to `buildArcs` state.
   */
  const flatRows = useMemo(() => buildSunburstFlatRows(data), [data]);
  const arcsById = useMemo(() => new Map(arcs.map((arc) => [arc.id, arc])), [arcs]);

  const revealDelayById = useMemo(() => {
    const timingList = buildRevealTiming(arcs, enterStaggerScale);
    return new Map(timingList.map((timing) => [timing.arcId, timing.delayMs]));
  }, [arcs, enterStaggerScale]);

  /*
   * `playKey` is folded into the mark id so a bump re-keys every child at once; `getSunburstPathMap` must receive the same string.
   */
  const sunburstMarkId = `sunburst-arcs-${playKey}`;
  // C5d: focus-derived mark options, hoisted so the definition below stays shallow.
  const visibleDepthValue = resolveVisibleDepth(maxDepth, focus.depth);
  const centerRValue = resolveCenterR(focus.depth, maxDepth, radius);

  // --- TanStack definition: native `sunburst()` (C5d, D-TBD — see file ---
  // --- header for the full design writeup and the hover-grow deviation) ---
  const definition = useMemo(() => defineChart({
      /*
       * Keyboard focus only; `focusRing: false` because dim geometry is already the authored focus treatment.
       */
      focusRing: false,
      guides: false,
      marks: [
        polar({
          endAngle: -Math.PI / 2 + 2 * Math.PI,
          marks: [
            sunburst(flatRows, {
              fill: (node: TSSunburstNode<SunburstFlatRow>) => {
                const arc = arcsById.get(node.id);
      if (!arc) {return defaultSunburstColors[0];}
                const config = segmentConfigMap.get(arc.arcIndex);
                const resolvedFill = getFill(arc.arcIndex, config?.fill, config?.color);
                const relativeDepth = arc.depth - focus.depth;
                const baseOpacity = config?.fillOpacity ?? opacityForRelativeDepth(relativeDepth);
                /*
                 * Native has no per-datum opacity channel, so hover dimming is folded into the per-datum `fill` alpha.
                 */
                const dimFactor = hoverDimFactor(arc.id, hoveredArc?.id);
                return applyAlphaToColor(resolvedFill, baseOpacity * dimFactor);
              },
              id: sunburstMarkId,
              /*
               * Same growPadding-shrunk radius as the overlays, so native rings land exactly on hit layer, labels, and center.
               */
              innerRadius: centerRValue,
              /*
               * `ctx.datum` is the wrapped `SunburstNode`, not the raw flat row; `ctx.datum.id` needs no key-decoding.
               */
              motion: (ctx: ChartMotionContext<TSSunburstNode<SunburstFlatRow>>) => {
                if (ctx.phase === "exit") {
                  // No legacy exit animation existed; degenerate arcs vanish instantly.
                  return { transition: { duration: 0, type: "tween" } };
                }
                if (ctx.phase === "update") {
                  return {
                    transition: {
                      duration: zoomMs,
                      easing: motionEasingFromCss(zoomEasingCss),
                      type: "tween",
                    },
                  };
                }
                const delayMs = ctx.datum ? (revealDelayById.get(ctx.datum.id) ?? 0) : 0;
                return {
                  delay: delayMs,
                  transition: {
                    duration: sweepDurationMs,
                    easing: motionEasingFromCss(sweepEasingCss),
                    type: "tween",
                  },
                };
              },
              nodeId: (row: SunburstFlatRow) => row.id,
              // Shares the overlay-alignment note on innerRadius above.
              outerRadius: radius,
              parentId: (row: SunburstFlatRow) => row.parentId,
              /*
               * Re-rooting resets subtree depth to 0 so partition refills the sweep; explicit `visibleDepth` keeps irregular trees aligned with overlays.
               */
              rootId: focus.id,
              stroke: "var(--chart-background)",
              strokeWidth: 1,
              /*
               * Leaf-only values: native `sum` adds an internal node's own value, diverging angles by up to ~3 rad if passed through.
               */
              value: (row: SunburstFlatRow) => (row.hasChildren ? 0 : (row.rawValue ?? 0)),
              // Shares the focus-remap note on rootId above.
              visibleDepth: visibleDepthValue,
            }),
          ],
          radiusRatio: 1,
          /*
           * Native sweeps from 3 o'clock by default; bklit geometry assumes a 12-o'clock origin, so set it explicitly.
           */
          startAngle: -Math.PI / 2,
        }),
      ],
      scales: { x: null, y: null },
      /*
       * Explicit 5-entry palette override; every row already carries per-datum `fill`, so no pixel effect today.
       */
      theme: { palette: CHART_CATEGORY_PALETTE },
      tooltip: false,
    }),
  [
    flatRows,
    arcsById,
    sunburstMarkId,
    focus,
    radius,
    visibleDepthValue,
    centerRValue,
    segmentConfigMap,
    getFill,
    hoveredArc,
    revealDelayById,
    sweepDurationMs,
    sweepEasingCss,
    zoomMs,
    zoomEasingCss,
  ]);

  return { arcsById, definition, sunburstMarkId };
};

export { useSunburstDefinition };
export type { UseSunburstDefinitionOptions, UseSunburstDefinitionState };
