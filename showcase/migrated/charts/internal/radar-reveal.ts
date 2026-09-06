import { curveLinearClosed, lineRadial } from "d3-shape";
// Ring vertices sit half a step off spokes; values are flat subdivisions, not d3 nice ticks.
import type { ChartMotionTransition, SceneNode } from "@tanstack/charts";
import type { PolarGuide, PolarGuideScene } from "@tanstack/charts/polar";
import { TWEEN_FALLBACK } from './parity/animation';
import type { EnterTransition, ResolvedTiming } from './parity/animation';
import { motionEasingFromCss } from "./hover-motion";

interface BklitRadarGridOptions {
  readonly levels: number;
  readonly metricsCount: number;
  readonly stroke: string;
  readonly strokeOpacity: number;
  readonly showLabels: boolean;
  readonly className?: string;
  readonly labelClassName: string;
  readonly labelFill: string;
}

const classes = (base: string, custom: string | undefined): string => (custom?.length ?? 0) > 0 ? `${base} ${custom}` : base;

// Long-form row behind the polar marks; shared with the focus strategy.
interface RadarRow {
  readonly metric: string;
  readonly value: number;
  readonly series: string;
  readonly replayGroup: string;
}

// Ring vertices sit half a step off the spokes (see header note).
const RADAR_VERTEX_HALF_STEP = 0.5;
// Ring-label values are flat subdivisions expressed as percentages.
const RADAR_LABEL_PERCENT_SCALE = 100;


interface RadarRingLevelParams {
  readonly rings: SceneNode[];
  readonly labels: SceneNode[];
  readonly levelIndex: number;
  readonly levels: number;
  readonly metricCount: number;
  readonly step: number;
  readonly radius: number;
  readonly stroke: string;
  readonly strokeOpacity: number;
  readonly showLabels: boolean;
  readonly labelFill: string;
}

const appendRadarRingLevel = (params: Readonly<RadarRingLevelParams>): void => {
  const targetRadius = ((params.levelIndex + 1) * params.radius) / params.levels;
  const rows: readonly { readonly angle: number; readonly radius: number }[] = Array.from({ length: params.metricCount }, (_unused, metricIndex) => ({
    angle: (metricIndex + RADAR_VERTEX_HALF_STEP) * params.step,
    radius: targetRadius,
  }));
  const path =
    lineRadial<(typeof rows)[number]>()
      .angle((row) => row.angle)
      .radius((row) => row.radius)
      .curve(curveLinearClosed)(rows) ?? "";
  if (path) {
    params.rings.push({
      key: `radar-ring:${params.levelIndex}`,
      kind: "polyline",
      path,
      points: [],
      style: {
        fill: "none",
        lineCap: "round",
        stroke: params.stroke,
        strokeOpacity: params.strokeOpacity,
        strokeWidth: 1,
      },
    });
  }
  if (params.showLabels) {
    params.labels.push({
      anchor: "start",
      baseline: "middle",
      fontSize: 9,
      key: `radar-ring-label:${params.levelIndex}`,
      kind: "label",
      style: { fill: params.labelFill },
      text: String(((params.levelIndex + 1) * RADAR_LABEL_PERCENT_SCALE) / params.levels),
      x: 4,
      y: -targetRadius,
    });
  }
};


const bklitRadarGrid = (options: Readonly<BklitRadarGridOptions>): PolarGuide => (
  {
    render({ layout, guideIndex, parentId }): PolarGuideScene {
      const metricCount = Math.max(1, options.metricsCount);
      const step = (Math.PI * 2) / metricCount;
      const rings: SceneNode[] = [];
      const labels: SceneNode[] = [];
      for (let levelIndex = 0; levelIndex < options.levels; levelIndex += 1) {
        appendRadarRingLevel({
          labelFill: options.labelFill,
          labels,
          levelIndex,
          levels: options.levels,
          metricCount,
          radius: layout.radius,
          rings,
          showLabels: options.showLabels,
          step,
          stroke: options.stroke,
          strokeOpacity: options.strokeOpacity,
        });
      }
      const id = `${parentId}:bklit-radar-grid-${guideIndex}`;
      return {
        background: [
          {
            ariaHidden: true,
            children: rings,
            className: classes("ts-chart__radial-grid", options.className),
            key: id,
            kind: "group",
          },
        ],
        foreground: labels.length > 0
          ? [
              {
                ariaHidden: true,
                children: labels,
                className: classes("ts-chart__text", options.labelClassName),
                key: `${id}:labels`,
                kind: "group",
              },
            ]
          : undefined,
      };
    },
  }
);


type RadarEnterTransition = EnterTransition;
type RadarResolvedTiming = ResolvedTiming;

const RADAR_TWEEN_FALLBACK: RadarResolvedTiming = TWEEN_FALLBACK;

const radarMotionTransition = (resolved: RadarResolvedTiming): ChartMotionTransition => resolved.kind === "spring"
    ? { damping: resolved.damping, mass: resolved.mass, stiffness: resolved.stiffness, type: "spring" }
    : { duration: resolved.durationMs, easing: motionEasingFromCss(resolved.easingCss), type: "tween" };

export type { RadarEnterTransition, RadarRow };
export { bklitRadarGrid, RADAR_TWEEN_FALLBACK, radarMotionTransition };
export {
  resolveEnterTransition as resolveRadarEnterTransition,
} from "./parity/animation";

