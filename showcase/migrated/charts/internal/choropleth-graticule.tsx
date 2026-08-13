// bklit-ui ChoroplethGraticule — graticule lines via d3-geo geoGraticule + geoPath,
// driven by the SAME projection as geoShape so grid aligns with the map.
// Single group is owned by the caller (graticuleGRef); this component
// returns only <path> elements to avoid a double <g> transform.

import { useMemo } from "react";
import type { GeoGeometryObjects } from "d3-geo";
import { geoGraticule, geoPath, type GeoProjection } from "d3-geo";
import type { ChoroplethGraticuleProps } from "../choropleth-chart";

export interface ChoroplethGraticuleRenderProps extends ChoroplethGraticuleProps {
  projection: GeoProjection;
}

export function ChoroplethGraticuleOverlay({
  projection,
  stroke = "rgba(255,255,255,0.1)",
  strokeWidth = 0.5,
  step,
}: ChoroplethGraticuleRenderProps) {
  const pathData = useMemo(() => {
    const graticule = step ? geoGraticule().step(step) : geoGraticule();
    const pathGen = geoPath(projection);
    const lines = graticule.lines();
    return lines
      .map((line: GeoGeometryObjects) => pathGen(line) ?? null)
      .filter((d): d is string => d !== null);
  }, [projection, step]);

  if (pathData.length === 0) return null;

  return (
    <>
      {pathData.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      ))}
    </>
  );
}
