import { useMemo } from "react";
import type { ChartMarkState, ChartMotionContext, ChartScene, StaticChartDefinition } from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { polar } from "@tanstack/charts/polar";
import { sunburst } from "@tanstack/charts/hierarchy/sunburst";
import type { SunburstNode as TSSunburstNode } from "@tanstack/charts/hierarchy/sunburst";
import { withStates } from "./with-states";
import { createSunburstFocus } from "./sunburst-focus";
import type { ArcDatum, Focus } from "./sunburst-types";
import type { SunburstFlatRow } from "./sunburst-rows";
import { defaultSunburstColors, opacityForRelativeDepth } from "./sunburst-colors";
import { buildRevealTiming } from "./sunburst-reveal";
import { CHART_CATEGORY_PALETTE } from "./design-tokens";
import { motionEasingFromCss } from "./hover-motion";

// Full opacity: the undimmed alpha for the hovered arc and its relatives.
const FULL_OPACITY = 1;
// Hover-dim alpha for arcs unrelated to the hovered arc (bklit 0.25, styles.css:424-427).
const HOVER_DIM_ALPHA = 0.25;
// Percentage scale for color-mix alpha weights: unit alpha (0-1) formats as 0-100%.
const ALPHA_TO_PERCENT = 100;

type SunburstScene = ChartScene<TSSunburstNode<SunburstFlatRow>, number, number>;

const applyAlphaToColor = (color: string, alpha: number): string => {
  if (alpha >= FULL_OPACITY) {return color;}
  return `color-mix(in srgb, ${color} ${Math.round(alpha * ALPHA_TO_PERCENT)}%, transparent)`;
};

// Hover/dim small helper, hoisted so render-path callbacks stay thin.

interface SunburstSegmentConfigView {
  readonly color?: string;
  readonly fill?: string;
  readonly fillOpacity?: number;
}

// Base sector paint: segment, then node, then branch palette.
interface SectorPaint {
  readonly color: string;
  readonly opacity: number;
}

interface SunburstFillSelectors {
  readonly baseFill: SunburstFillResolver;
  readonly dimFill: SunburstFillResolver;
}

interface CreateSunburstFillSelectorsOptions {
  readonly sectorById: ReadonlyMap<string, ArcDatum>;
  readonly segmentConfigById: ReadonlyMap<string, SunburstSegmentConfigView>;
  readonly focusDepth: number;
}

const paletteColor = (categoryIndex: number): string =>
  defaultSunburstColors[categoryIndex % defaultSunburstColors.length];

const createSunburstFillSelectors = (
  options: Readonly<CreateSunburstFillSelectorsOptions>,
): SunburstFillSelectors => {
  const { sectorById, segmentConfigById, focusDepth } = options;
  const rawFill = (node: TSSunburstNode<SunburstFlatRow>): SectorPaint => {
    const sector = sectorById.get(node.id);
    const config = segmentConfigById.get(node.id);
    const opacity = config?.fillOpacity ?? opacityForRelativeDepth(node.depth - focusDepth);
    if (config) {
      if (config.fill !== undefined && config.fill !== "") {
        return { color: config.fill, opacity };
      }
      if (config.color !== undefined) {
        return { color: config.color, opacity };
      }
    }
    if (sector) {
      const own = sector.fill ?? sector.color;
      if (own !== undefined) {
        return { color: own, opacity };
      }
      return { color: paletteColor(sector.categoryIndex), opacity };
    }
    return { color: paletteColor(0), opacity };
  };
  return {
    baseFill: (node) => {
      const { color, opacity } = rawFill(node);
      return applyAlphaToColor(color, opacity);
    },
    dimFill: (node) => {
      const { color, opacity } = rawFill(node);
      return applyAlphaToColor(color, opacity * HOVER_DIM_ALPHA);
    },
  };
};

interface SunburstFocusDimDeps {
  readonly dimFill: SunburstFillResolver;
}

// Arc focus dim (I1 wrapper) from the undimmed base; styles.css sunburst term.
// Polar flattens child nodes, so the wrapper below sits on the container.
const sunburstFocusStates = (
  deps: Readonly<SunburstFocusDimDeps>,
): ChartMarkState<TSSunburstNode<SunburstFlatRow>>[] => [
  {
    style: {
      fill: (context): string => deps.dimFill(context.datum),
    },
    transition: { duration: 160, easing: "ease-out", type: "tween" },
    when: { focus: "unmatched" },
  },
];

type SunburstFillResolver = (node: TSSunburstNode<SunburstFlatRow>) => string;

interface UseSunburstDefinitionOptions {
  readonly flatRows: readonly SunburstFlatRow[];
  readonly sectors: readonly ArcDatum[];
  readonly sectorById: ReadonlyMap<string, ArcDatum>;
  readonly focus: Readonly<Focus>;
  readonly visibleDepth: number;
  readonly holeR: number;
  readonly radius: number;
  readonly playKey: number;
  readonly enterStaggerScale: number;
  readonly segmentConfigMap: ReadonlyMap<number, SunburstSegmentConfigView>;
  readonly sweepDurationMs: number;
  readonly sweepEasingCss: string;
  readonly zoomMs: number;
  readonly zoomEasingCss: string;
  /** Click/keyboard activation zooms; wired through the definition selection controller. */
  readonly onActivateId: (id: string) => void;
  /** Latest rendered scene; the focus strategy tests its painted polygons. */
  readonly getScene: () => SunburstScene | null;
}

interface UseSunburstDefinitionState {
  readonly sunburstMarkId: string;
  readonly definition: StaticChartDefinition<TSSunburstNode<SunburstFlatRow>, number, number, "dom">;
}

interface BuildSunburstDefinitionOptions {
  readonly flatRows: readonly SunburstFlatRow[];
  readonly baseFill: SunburstFillResolver;
  readonly dimFill: SunburstFillResolver;
  readonly sunburstMarkId: string;
  readonly focusId: string;
  readonly visibleDepthValue: number;
  readonly holeRValue: number;
  readonly radius: number;
  readonly revealDelayById: ReadonlyMap<string, number>;
  readonly sweepDurationMs: number;
  readonly sweepEasingCss: string;
  readonly zoomMs: number;
  readonly zoomEasingCss: string;
  /** Click/keyboard activation zooms; wired through the definition selection controller. */
  readonly onActivateId: (id: string) => void;
  /** Latest rendered scene; the focus strategy tests its painted polygons. */
  readonly getScene: () => SunburstScene | null;
}

// Hover-invariant: no option derives from hovered state.
// Zoom stays on definition selection; module-level for headless proof.
const buildSunburstDefinition = (options: Readonly<BuildSunburstDefinitionOptions>): StaticChartDefinition<TSSunburstNode<SunburstFlatRow>, number, number, "dom"> => {
  const { flatRows, baseFill, dimFill, sunburstMarkId, focusId, visibleDepthValue, holeRValue, radius, revealDelayById, sweepDurationMs, sweepEasingCss, zoomMs, zoomEasingCss, onActivateId, getScene } = options;
  const arcsMark = sunburst(flatRows, {
      fill: (node: TSSunburstNode<SunburstFlatRow>) => baseFill(node),
      id: sunburstMarkId,
      /*
       * Same growPadding-shrunk radius as the overlays, so native rings land exactly on hit layer, labels, and center.
       */
      innerRadius: holeRValue,
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
      rootId: focusId,
      stroke: "var(--chart-background)",
      strokeWidth: 1,
      /*
       * Leaf-only values: native `sum` adds an internal node's own value, diverging angles by up to ~3 rad if passed through.
       */
      value: (row: SunburstFlatRow) => (row.hasChildren ? 0 : (row.rawValue ?? 0)),
      // Shares the focus-remap note on rootId above.
      visibleDepth: visibleDepthValue,
    });
    const containerMark = polar({
      endAngle: -Math.PI / 2 + 2 * Math.PI,
      marks: [arcsMark],
      radiusRatio: 1,
      scales: { angle: null, radius: null },
      /*
       * Native sweeps from 3 o'clock by default; bklit geometry assumes a 12-o'clock origin, so set it explicitly.
       */
      startAngle: -Math.PI / 2,
    });
    return defineChart({
      // Package owns pointer focus through the polygon strategy below.
      // Unrelated-arc dim rides the states below; zoom stays on selection.
      focus: createSunburstFocus({ getScene }),
      /*
       * Keyboard focus only; `focusRing: false` because dim geometry is already the authored focus treatment.
       */
      focusRing: false,
      guides: false,
      marks: [withStates(containerMark, flatRows, sunburstFocusStates({ dimFill }))],
      scales: { x: null, y: null },
      selection: {
        change: (point, _source): void => {
          if (point === null) {return;}
          if (point.datum.height > 0) {onActivateId(point.datum.id);}
        },
        type: "keyed",
      },
      svgAnimation: false as const,
      /*
       * Explicit 5-entry palette override; every row already carries per-datum `fill`, so no pixel effect today.
       */
      theme: { palette: CHART_CATEGORY_PALETTE },
      tooltip: false,
    });
};

const useSunburstDefinition = (options: Readonly<UseSunburstDefinitionOptions>): UseSunburstDefinitionState => {
  const {
    flatRows,
    sectors,
    sectorById,
    focus,
    visibleDepth,
    holeR,
    radius,
    playKey,
    enterStaggerScale,
    segmentConfigMap,
    sweepDurationMs,
    sweepEasingCss,
    zoomMs,
    zoomEasingCss,
    onActivateId,
    getScene,
  } = options;

  const segmentConfigById = useMemo(() => {
    const byId = new Map<string, SunburstSegmentConfigView>();
    for (const sector of sectors) {
      const config = segmentConfigMap.get(sector.arcIndex);
      if (config) {
        byId.set(sector.id, config);
      }
    }
    return byId;
  }, [sectors, segmentConfigMap]);

  const fillSelectors = useMemo(
    () => createSunburstFillSelectors({ focusDepth: focus.depth, sectorById, segmentConfigById }),
    [focus.depth, sectorById, segmentConfigById],
  );

  const revealDelayById = useMemo(() => {
    const timingList = buildRevealTiming(sectors, enterStaggerScale);
    return new Map(timingList.map((timing) => [timing.arcId, timing.delayMs]));
  }, [sectors, enterStaggerScale]);

  /*
   * `playKey` is folded into the mark id so a bump re-keys every child at once; `getSunburstPathMap` must receive the same string.
   */
  const sunburstMarkId = `sunburst-arcs-${playKey}`;

  // --- TanStack definition: native `sunburst()` (C5d, D540) ---
  // --- header for the full design writeup and the hover-grow deviation) ---
  const definition = useMemo(() => buildSunburstDefinition({
    baseFill: fillSelectors.baseFill,
    dimFill: fillSelectors.dimFill,
    flatRows,
    focusId: focus.id,
    getScene,
    holeRValue: holeR,
    onActivateId,
    radius,
    revealDelayById,
    sunburstMarkId,
    sweepDurationMs,
    sweepEasingCss,
    visibleDepthValue: visibleDepth,
    zoomEasingCss,
    zoomMs,
  }), [
    flatRows,
    focus.id,
    getScene,
    holeR,
    onActivateId,
    radius,
    fillSelectors,
    revealDelayById,
    sunburstMarkId,
    sweepDurationMs,
    sweepEasingCss,
    visibleDepth,
    zoomMs,
    zoomEasingCss,
  ]);

  return { definition, sunburstMarkId };
};


export { buildSunburstDefinition, useSunburstDefinition };
export type { BuildSunburstDefinitionOptions, UseSunburstDefinitionOptions, UseSunburstDefinitionState };
