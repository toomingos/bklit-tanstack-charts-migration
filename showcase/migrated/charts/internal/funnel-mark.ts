// Funnel stages as package marks: one createMark per orientation.
// Hover re-emits geometry, colours ride states, corners feed the morph.
import { createMarkWithScaleValues } from "@tanstack/charts/mark/scale-values";
import type {
  ChartMark,
  ChartMarkState,
  ChartMotionDefinition,
  ChartPoint,
  SceneArea,
  SceneNode,
} from "@tanstack/charts";
import {
  funnelRingExtraScale,
  funnelTrapCorners,
  hSegmentPath,
  vSegmentPath,
} from "./funnel-geometry";
import type { FunnelStage } from "./funnel-segment";
import { FADE_OPACITY, motionEasingFromCss } from "./hover-motion";
import { resolveEnterTransition } from "./enter-transition";

// Halo stack math moved here with the ring loop (funnel-geometry keeps the path builders).
const FUNNEL_RING_SCALE_SHRINK = 0.35;
const FUNNEL_RING_BASE_OPACITY = 0.18;
const FUNNEL_RING_OPACITY_RANGE = 0.65;
// Dim transition for unmatched stages (matches the pie slice fill term).
const FUNNEL_DIM_TRANSITION_MS = 150;

interface FunnelEnterTransition {
  readonly type?: "spring" | "tween";
  /** Tween duration, seconds. */
  readonly duration?: number;
  /** Tween cubic-bezier control points (framer's `ease` array form). */
  readonly ease?: readonly [number, number, number, number];
  /** Spring bounce shorthand (0..1) — converted via springFromBounce. */
  readonly bounce?: number;
  readonly stiffness?: number;
  readonly damping?: number;
  readonly mass?: number;
}

interface FunnelRingRow {
  readonly key: string;
  readonly path: string;
  readonly corners: readonly (readonly [number, number])[];
  readonly opacity: number;
  readonly fill: string;
}

interface FunnelStageRow {
  readonly stageIndex: number;
  readonly label: string;
  readonly value: number;
  readonly color: string;
  readonly cx: number;
  readonly cy: number;
  readonly rings: readonly FunnelRingRow[];
}

const funnelMarkId = (isHorizontal: boolean): string => isHorizontal ? "funnel-h" : "funnel-v";

const funnelPatternId = (isHorizontal: boolean, index: number): string =>
  `funnel-${isHorizontal ? "h" : "v"}-pattern-${index}`;

const funnelGradientId = (isHorizontal: boolean, index: number): string =>
  `funnel-${isHorizontal ? "h" : "v"}-grad-${index}`;

interface BuildFunnelStageRowsOptions {
  readonly data: readonly FunnelStage[];
  readonly norms: readonly number[];
  readonly baseColor: string;
  readonly chartW: number;
  readonly chartH: number;
  readonly segW: number;
  readonly segH: number;
  readonly gap: number;
  readonly isHorizontal: boolean;
  readonly layers: number;
  readonly straight: boolean;
  readonly hoveredIndex: number | null;
  readonly hasPattern: boolean;
}

// Innermost-ring fill precedence: pattern url, then gradient url, then the stage color.
interface ResolveFunnelRingFillOptions {
  readonly isInnermost: boolean;
  readonly hasPattern: boolean;
  readonly hasGradient: boolean;
  readonly patternId: string;
  readonly gradientId: string;
  readonly fallback: string;
}

const resolveFunnelRingFill = (options: Readonly<ResolveFunnelRingFillOptions>): string => {
  const { isInnermost, hasPattern, hasGradient, patternId, gradientId, fallback } = options;
  if (isInnermost && hasPattern) {return `url(#${patternId})`;}
  if (isInnermost && hasGradient) {return `url(#${gradientId})`;}
  return fallback;
};

interface FunnelStageRingsOptions {
  readonly markId: string;
  readonly normStart: number;
  readonly normEnd: number;
  readonly originX: number;
  readonly originY: number;
  readonly segLen: number;
  readonly crossLen: number;
  readonly isHorizontal: boolean;
  readonly layers: number;
  readonly straight: boolean;
  readonly isHovered: boolean;
  readonly color: string;
  readonly hasPattern: boolean;
  readonly hasGradient: boolean;
  readonly patternId: string;
  readonly gradientId: string;
  readonly stageIndex: number;
}

const buildFunnelStageRings = (options: Readonly<FunnelStageRingsOptions>): FunnelRingRow[] => {
  const { markId, normStart, normEnd, originX, originY, segLen, crossLen, isHorizontal, layers, straight, isHovered, color, hasPattern, hasGradient, patternId, gradientId, stageIndex } = options;
  // Degenerate stage (gap consumes the axis at high n): no rings, like legacy's
  // Negative-width segment which paints nothing while labels and hover persist.
  if (segLen <= 0 || crossLen <= 0) {return [];}
  const rings: FunnelRingRow[] = [];
  for (let layer = 0; layer < layers; layer += 1) {
    const baseScale = 1 - (layer / layers) * FUNNEL_RING_SCALE_SHRINK;
    const layerScale = isHovered ? baseScale * funnelRingExtraScale(layer, layers) : baseScale;
    const path = isHorizontal
      ? hSegmentPath({ dx: originX, dy: 0, height: crossLen, layerScale, normEnd, normStart, segW: segLen, straight })
      : vSegmentPath({ dx: 0, dy: originY, layerScale, normEnd, normStart, segH: segLen, straight, width: crossLen });
    const corners = funnelTrapCorners({ crossLen, dx: originX, dy: originY, isHorizontal, layerScale, normEnd, normStart, segLen });
    const isInnermost = layer === layers - 1;
    rings.push({
      corners,
      fill: resolveFunnelRingFill({ fallback: color, gradientId, hasGradient, hasPattern, isInnermost, patternId }),
      key: `${markId}:stage:${stageIndex}:ring:${layer}`,
      opacity: FUNNEL_RING_BASE_OPACITY + (layer / (layers - 1 || 1)) * FUNNEL_RING_OPACITY_RANGE,
      path,
    });
  }
  return rings;
};

const buildFunnelStageRows = (options: Readonly<BuildFunnelStageRowsOptions>): FunnelStageRow[] => {
  const { data, norms, baseColor, chartW, chartH, segW, segH, gap, isHorizontal, layers, straight, hoveredIndex, hasPattern } = options;
  const markId = funnelMarkId(isHorizontal);
  return data.map((stage, index) => {
    const normStart = norms[index] ?? 0;
    const normEnd = norms[Math.min(index + 1, data.length - 1)] ?? 0;
    const firstStop = stage.gradient?.[0];
    const color = firstStop ? firstStop.color : (stage.color ?? baseColor);
    const originX = isHorizontal ? (segW + gap) * index : 0;
    const originY = isHorizontal ? 0 : (segH + gap) * index;
    return {
      color,
      cx: isHorizontal ? originX + segW / 2 : chartW / 2,
      cy: isHorizontal ? chartH / 2 : originY + segH / 2,
      label: stage.label,
      rings: buildFunnelStageRings({
        color,
        crossLen: isHorizontal ? chartH : chartW,
        gradientId: funnelGradientId(isHorizontal, index),
        hasGradient: stage.gradient !== undefined,
        hasPattern,
        isHorizontal,
        isHovered: hoveredIndex === index,
        layers,
        markId,
        normEnd,
        normStart,
        originX,
        originY,
        patternId: funnelPatternId(isHorizontal, index),
        segLen: isHorizontal ? segW : segH,
        stageIndex: index,
        straight,
      }),
      stageIndex: index,
      value: stage.value,
    };
  });
};

interface CreateFunnelStageMarkOptions {
  readonly isHorizontal: boolean;
  readonly enterTransition: FunnelEnterTransition | undefined;
  readonly staggerDelayMs: number;
}

const funnelEnterMotion = (options: Readonly<CreateFunnelStageMarkOptions>): ChartMotionDefinition<FunnelStageRow> => (context) => {
  if (context.phase !== "enter") {return undefined;}
  const resolved = resolveEnterTransition(options.enterTransition);
  return {
    delay: context.datumIndex * options.staggerDelayMs,
    transition:
      resolved.kind === "spring"
        ? { damping: resolved.damping, mass: resolved.mass, stiffness: resolved.stiffness, type: "spring" }
        : { duration: resolved.durationMs, easing: motionEasingFromCss(resolved.easingCss), type: "tween" },
  };
};

const createFunnelStageMark = (
  rows: readonly FunnelStageRow[],
  options: Readonly<CreateFunnelStageMarkOptions>,
): ChartMark<FunnelStageRow, number, number, never, never> => {
  const markId = funnelMarkId(options.isHorizontal);
  // Scale values are never: pixel geometry is baked in, so both scales stay null.
  return createMarkWithScaleValues<FunnelStageRow, number, number, never, never>(() => ({
    channels: {},
    id: markId,
    render: ({ chart }) => {
      const areas: SceneNode[] = [];
      const points: ChartPoint<FunnelStageRow, number, number>[] = [];
      for (const row of rows) {
        const point: ChartPoint<FunnelStageRow, number, number> = {
          color: row.color,
          datum: row,
          datumIndex: row.stageIndex,
          group: row.stageIndex,
          groupLabel: row.label,
          key: `${markId}:stage:${row.stageIndex}`,
          markId,
          x: chart.x + row.cx,
          xValue: row.stageIndex,
          y: chart.y + row.cy,
          yValue: row.value,
        };
        points.push(point);
        for (const ring of row.rings) {
          const node: SceneArea = {
            interaction: { affinity: "geometry", point },
            key: ring.key,
            kind: "area",
            path: ring.path,
            points: ring.corners,
            style: { fill: ring.fill, opacity: ring.opacity },
          };
          areas.push(node);
        }
      }
      return {
        nodes: [{ children: areas, key: markId, kind: "group", translateX: chart.x, translateY: chart.y }],
        points,
      };
    },
  }), funnelEnterMotion(options));
};

// Stage colours ride the base fill; hover dim rides states (unmatched stages fade).
const funnelDimStates = (): ChartMarkState<FunnelStageRow>[] => [
  {
    style: { opacity: FADE_OPACITY },
    transition: { duration: FUNNEL_DIM_TRANSITION_MS, easing: "ease-in-out", type: "tween" },
    when: { focus: "unmatched" },
  },
];

export {
  buildFunnelStageRows,
  buildFunnelStageRings,
  createFunnelStageMark,
  funnelDimStates,
  funnelGradientId,
  funnelMarkId,
  funnelPatternId,
};
export type {
  BuildFunnelStageRowsOptions,
  CreateFunnelStageMarkOptions,
  FunnelEnterTransition,
  FunnelRingRow,
  FunnelStageRow,
};
