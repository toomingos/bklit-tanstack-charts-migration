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
