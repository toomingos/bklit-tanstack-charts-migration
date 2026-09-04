// Graticule lines via d3-geo on the same projection as geoShape; paths only (caller owns the group).

import { useMemo } from "react";
import type { ReactNode } from "react";
import { geoGraticule, geoPath } from 'd3-geo';
import type { GeoGeometryObjects, GeoProjection } from 'd3-geo';
import type { ChoroplethGraticuleProps } from "./choropleth-graticule-props";

export interface ChoroplethGraticuleRenderProps extends ChoroplethGraticuleProps {
  readonly projection: GeoProjection;
}

export const ChoroplethGraticuleOverlay = ({
  projection,
  stroke = "rgba(255,255,255,0.1)",
  strokeWidth = 0.5,
  step,
}: Readonly<ChoroplethGraticuleRenderProps>): ReactNode => {
  const pathData = useMemo(() => {
    const graticule = step ? geoGraticule().step(step) : geoGraticule();
    const pathGen = geoPath(projection);
    const lines = graticule.lines();
    return lines
      .map((line: GeoGeometryObjects) => pathGen(line) ?? undefined)
      .filter((path): path is string => path !== undefined);
  }, [projection, step]);

  if (pathData.length === 0) {return undefined;}

  return (
    <>
      {pathData.map((path) => (
        <path key={path} d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      ))}
    </>
  );
}
