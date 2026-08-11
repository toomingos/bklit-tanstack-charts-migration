// Custom "bklit-exact" radial grid PolarGuide for RadarChart.
// This is a from-scratch PolarGuide (NOT a wrapper around
// `@tanstack/charts/polar`'s own `radialGrid`) because reading bklit's
// `radar-grid.tsx` directly turned up two real divergences:
//
// a) bklit's ring vertices sit HALF A STEP off of each spoke angle.
//    `radialGrid({shape:"polygon"})` always places vertices ON the spokes
//    with no phase-offset option. Reproduced via `angle_i = (i + 0.5) * step`.
// b) bklit's ring values are a flat `(i+1)*100/levels` subdivision, NOT
//    d3's "nice ticks" algorithm. Reproduced via `targetRadius = (i+1)*layout.radius/levels`.
//
// Grid VALUE LABELS match `radialGrid`'s defaults, so they're folded in here.

import { curveLinearClosed, lineRadial } from "d3-shape";
import type { SceneNode } from "@tanstack/charts";
import type { PolarGuide, PolarGuideScene } from "@tanstack/charts/polar";
import { estimateSpringSettleMs, sampleSpringProgress } from "./radar-spring";

export interface BklitRadarGridOptions {
  levels: number;
  metricsCount: number;
  stroke: string;
  strokeOpacity: number;
  showLabels: boolean;
  className?: string;
  labelClassName: string;
  labelFill: string;
}

function classes(base: string, custom: string | undefined): string {
  return custom ? `${base} ${custom}` : base;
}

export function bklitRadarGrid(options: BklitRadarGridOptions): PolarGuide {
  return {
    render({ layout, guideIndex, parentId }): PolarGuideScene {
      const {
        levels,
        metricsCount,
        stroke,
        strokeOpacity,
        showLabels,
        className,
        labelClassName,
        labelFill,
      } = options;
      const n = Math.max(1, metricsCount);
      const step = (Math.PI * 2) / n;
      const rings: SceneNode[] = [];
      const labels: SceneNode[] = [];
      for (let i = 0; i < levels; i++) {
        const targetRadius = ((i + 1) * layout.radius) / levels;
        const rows = Array.from({ length: n }, (_unused, m) => ({
          angle: (m + 0.5) * step,
          radius: targetRadius,
        }));
        const path =
          lineRadial<(typeof rows)[number]>()
            .angle((row) => row.angle)
            .radius((row) => row.radius)
            .curve(curveLinearClosed)(rows) ?? "";
        if (path) {
          rings.push({
            kind: "polyline",
            key: `radar-ring:${i}`,
            points: [],
            path,
            style: { fill: "none", stroke, strokeOpacity, strokeWidth: 1 },
          });
        }
        if (showLabels) {
          labels.push({
            kind: "label",
            key: `radar-ring-label:${i}`,
            x: 4,
            y: -targetRadius,
            text: String(((i + 1) * 100) / levels),
            anchor: "start",
            baseline: "middle",
            fontSize: 9,
            style: { fill: labelFill },
          });
        }
      }
      const id = `${parentId}:bklit-radar-grid-${guideIndex}`;
      return {
        background: [
          {
            kind: "group",
            key: id,
            className: classes("ts-chart__radial-grid", className),
            ariaHidden: true,
            children: rings,
          },
        ],
        foreground: labels.length
          ? [
              {
                kind: "group",
                key: `${id}:labels`,
                className: classes("ts-chart__text", labelClassName),
                ariaHidden: true,
                children: labels,
              },
            ]
          : undefined,
      };
    },
  };
}

// --- Reveal timing (per-family duplicate of ring-reveal.ts, D43 precedent) ---

export const RADAR_TWEEN_DURATION_MS = 1100;
export const RADAR_TWEEN_EASE_CSS = "cubic-bezier(0.85, 0, 0.15, 1)";

export interface RadarEnterTransition {
  type?: "spring" | "tween";
  duration?: number;
  ease?: readonly [number, number, number, number];
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export type RadarResolvedTiming =
  | { kind: "tween"; durationMs: number; easingCss: string }
  | { kind: "spring"; stiffness: number; damping: number; mass: number };

export const RADAR_TWEEN_FALLBACK: RadarResolvedTiming = {
  kind: "tween",
  durationMs: RADAR_TWEEN_DURATION_MS,
  easingCss: RADAR_TWEEN_EASE_CSS,
};

function springFromBounce(
  bounce: number,
  base: { stiffness: number; damping: number },
): { stiffness: number; damping: number } {
  return {
    stiffness: Math.min(400, Math.max(80, base.stiffness * (1 + bounce * 0.35))),
    damping: Math.max(8, base.damping * (1 - bounce * 0.25)),
  };
}

export function resolveRadarEnterTransition(
  transition: RadarEnterTransition | undefined,
  fallback: RadarResolvedTiming = RADAR_TWEEN_FALLBACK,
): RadarResolvedTiming {
  if (!transition) return fallback;
  const type = transition.type ?? fallback.kind;
  if (type === "spring") {
    if (
      typeof transition.stiffness === "number" &&
      typeof transition.damping === "number"
    ) {
      return {
        kind: "spring",
        stiffness: transition.stiffness,
        damping: transition.damping,
        mass: transition.mass ?? (fallback.kind === "spring" ? fallback.mass : 1),
      };
    }
    const base =
      fallback.kind === "spring"
        ? { stiffness: fallback.stiffness, damping: fallback.damping }
        : { stiffness: 100, damping: 15 };
    const bounce = transition.bounce ?? 0;
    const { stiffness, damping } = springFromBounce(bounce, base);
    return {
      kind: "spring",
      stiffness,
      damping,
      mass: transition.mass ?? (fallback.kind === "spring" ? fallback.mass : 1),
    };
  }
  const durationMs =
    (transition.duration ??
      (fallback.kind === "tween" ? fallback.durationMs / 1000 : 1.1)) * 1000;
  const easingCss = transition.ease
    ? `cubic-bezier(${transition.ease.join(",")})`
    : fallback.kind === "tween"
      ? fallback.easingCss
      : RADAR_TWEEN_EASE_CSS;
  return { kind: "tween", durationMs, easingCss };
}

export interface RadarRevealTiming {
  durationMs: number;
  easing: string;
  sampledProgress: number[];
}

const TWEEN_SAMPLES = 64;
const UNIFORM_PROGRESS = Array.from(
  { length: TWEEN_SAMPLES },
  (_, i) => i / (TWEEN_SAMPLES - 1),
);

export function radarRevealTiming(resolved: RadarResolvedTiming): RadarRevealTiming {
  if (resolved.kind === "tween") {
    return {
      durationMs: resolved.durationMs,
      easing: resolved.easingCss,
      sampledProgress: UNIFORM_PROGRESS,
    };
  }
  const durationMs = estimateSpringSettleMs(resolved.stiffness, resolved.damping, resolved.mass);
  const sampledProgress = sampleSpringProgress(
    resolved.stiffness,
    resolved.damping,
    resolved.mass,
    durationMs,
    40,
  );
  return { durationMs, easing: "linear", sampledProgress };
}

export function buildRadarProgressKeyframes(
  timing: RadarRevealTiming,
  toKeyframe: (progress: number) => Keyframe,
): Keyframe[] {
  return timing.sampledProgress.map(toKeyframe);
}
