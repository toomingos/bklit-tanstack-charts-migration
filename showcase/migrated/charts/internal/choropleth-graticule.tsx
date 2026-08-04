// bklit-ui ChoroplethGraticule — renders graticule (longitude/latitude grid
// lines) as SVG <path> elements using d3-geo's geoGraticule + geoPath, driven
// by the SAME projection instance as the chart's geoShape mark so grid lines
// align perfectly with the map.
//
// TanStack Charts has no native graticule primitive, so this is rendered as a
// separate SVG overlay positioned on top of the chart. It sits inside the
// zoomed group (when zoom is enabled) so it zooms/pans with the map.
//
// @visx/geo's Graticule component does the same thing (bklit uses it), but we
// avoid the extra dependency by using d3-geo directly (already a bench/app dep).

import { useMemo } from "react";
import type { GeoGeometryObjects } from "d3-geo";
import { geoGraticule, geoPath, type GeoProjection } from "d3-geo";

export interface ChoroplethGraticuleProps {
  /** Stroke color for graticule lines. Default: rgba(255,255,255,0.1) */
  stroke?: string;
  /** Stroke width for graticule lines. Default: 0.5 */
  strokeWidth?: number;
  /** Step intervals for graticule lines [longitude, latitude] in degrees. Default: [10, 10] */
  step?: [number, number];
}

export interface ChoroplethGraticuleRenderProps {
  projection: GeoProjection;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  step?: [number, number];
}

/**
 * Renders graticule lines as SVG paths. Must be rendered INSIDE an <svg>
 * element. The caller positions the <svg> overlay to match the chart.
 */
export function ChoroplethGraticuleOverlay({
  projection,
  width,
  height,
  stroke = "rgba(255,255,255,0.1)",
  strokeWidth = 0.5,
  step,
}: ChoroplethGraticuleRenderProps) {
  const pathData = useMemo(() => {
    const graticule = step ? geoGraticule().step(step) : geoGraticule();
    const pathGen = geoPath(projection);
    const lines = graticule.lines();
    return lines
      .map((line: GeoGeometryObjects) => {
        const d = pathGen(line);
        return d ?? null;
      })
      .filter((d): d is string => d !== null);
  }, [projection, step]);

  if (pathData.length === 0) return null;

  return (
    <g className="choropleth-graticule">
      {pathData.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ))}
    </g>
  );
}
