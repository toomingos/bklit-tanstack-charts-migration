// Minimal area-fill mark (replaces `areaY` for the fill layer only).
//
// Why not `areaY`: it allocates one ChartPoint per datum (focus plumbing the
// chrome never reads — the boundary `lineY` mark already provides the focus
// points for the series) plus a `points: [...top, ...lower]` polygon array
// per segment that the renderer ignores whenever `path` is present. At
// n=1000 that duplication put migrated Area's post-GC heap 19% above bklit
// (4.45MB vs 3.74MB), failing G4's +10% ceiling. This mark emits exactly one
// `kind:'area'` scene node per contiguous segment with a precomputed `path`
// and an empty points array, and NO ChartPoints — same pixels, same
// `.ts-chart__area[data-ts-key="<id>"]` DOM contract the hover chrome's
// fill-dim lookup relies on, none of the retained geometry.
import { createMark } from "@tanstack/charts";
import type { ChartCurve, ChartMark, SceneNode } from "@tanstack/charts";
import type { ChartDatum } from "./types";

export interface AreaFillOptions {
  /** Mark id — by convention `${dataKey}__fill`. */
  id: string;
  x: (d: ChartDatum) => Date;
  y: (d: ChartDatum) => number;
  /** Paint — typically `url(#gradientId)`. */
  fill: string;
  curve: ChartCurve;
}

export function areaFill(
  data: ChartDatum[],
  options: AreaFillOptions,
): ChartMark<ChartDatum, Date, number> {
  return createMark(() => {
    const xValues = data.map(options.x);
    const yValues = data.map(options.y);
    return {
      id: options.id,
      channels: {
        x: { scale: "x", values: xValues },
        // `includeZero` mirrors areaY's default y1=0 baseline hint so scale
        // inference stays identical to the areaY version this replaces.
        y: {
          scale: "y",
          values: yValues.filter(Number.isFinite),
          includeZero: true,
        },
      },
      render: ({ scales }) => {
        const xScale = scales.x;
        const yScale = scales.y;
        const children: SceneNode[] = [];
        if (xScale && yScale) {
          const baselineY = yScale.map(0);
          let top: Array<readonly [number, number]> = [];
          let segmentIndex = 0;
          const flush = () => {
            if (top.length === 0) return;
            // Same top/bottom contract as areaY: bottom is the baseline run
            // in reverse x order (curve.area handles orientation).
            const bottom = top.map(
              ([px]) => [px, baselineY] as readonly [number, number],
            );
            children.push({
              kind: "area",
              key: `${options.id}:segment:${segmentIndex}`,
              points: [],
              path: options.curve.area(top, bottom),
              style: { fill: options.fill, fillOpacity: 1 },
            });
            top = [];
            segmentIndex += 1;
          };
          for (let i = 0; i < data.length; i++) {
            const yValue = yValues[i];
            if (!Number.isFinite(yValue)) {
              flush();
              continue;
            }
            top.push([xScale.map(xValues[i]), yScale.map(yValue)]);
          }
          flush();
        }
        return {
          nodes: [
            {
              kind: "group",
              key: options.id,
              className: "ts-chart__area",
              ariaHidden: true,
              children,
            },
          ],
        };
      },
    };
  });
}
