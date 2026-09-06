// Area y-domain hook: contiguous y-domain group from area-chart.tsx.
// Hook call order is unchanged; logic moved verbatim.
import { useMemo, useState } from "react";
import { filterDataByXDomain, createXAccessor } from "./brush-selection";
import { buildLoadingSkeletonRows } from "./loading-chrome";
import {
  createAxisValueProjector,
  createNicedYScale,
  domainForAxis,
  resolveTimeSeriesYDomain,
  resolveYDomainsByAxis,
  useNicedYDomainChanged,
} from "./y-domain";
import { DEFAULT_Y_AXIS_ID } from "./y-axis-id";
import { mergeProjectionYDomain } from "./projection-config";
import type { ProjectionLineConfig } from "./projection-config";
import type { ChartDatum, ChartStatus } from "./types";
import type { ReadonlyResolvedArea } from "./area-chart-model";

interface AreaYDomainParams {
  readonly data: ChartDatum[];
  readonly projectionConfigs: ProjectionLineConfig[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly status: ChartStatus;
  readonly xDataKey: string;
  readonly xDomain: [Date, Date] | undefined;
}

interface AreaYDomain {
  readonly nicedDomainsByAxis: Record<string, [number, number]>;
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly visibleData: ChartDatum[];
  readonly xAccessorForBrush: (datum: Readonly<ChartDatum>) => Date;
  readonly yDomainChanged: boolean;
  readonly yDomainFinal: [number, number];
}

const useAreaYDomain = (params: Readonly<AreaYDomainParams>): AreaYDomain => {
  // YDomain scans visibleData when brushing; marks stay on full data (domain-clamp).
  const xAccessorForBrush = useMemo(() => createXAccessor(params.xDataKey), [params.xDataKey]);
  const visibleData = useMemo(() => {
    if (!params.xDomain) {return params.data;}
    return filterDataByXDomain(params.data, params.xDomain, xAccessorForBrush);
  }, [params.data, params.xDomain, xAccessorForBrush]);

  // Bklit parity: all>=0 -> [0, max*1.1]; mixed-sign -> [min,max] +/-5%; empty -> [0,100].
  // Loading gridlines derive from skeleton rows, not caller data (bklit shells its own).
  const skeletonRows = useMemo(
    () => buildLoadingSkeletonRows(params.data.length, params.resolvedAreas[0]?.dataKey ?? "value"),
    [params.data.length, params.resolvedAreas],
  );
  const yDomainSource = params.status === "loading" ? skeletonRows : visibleData;
  const yDomainsByAxis = useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: (axisAreas: readonly ReadonlyResolvedArea[]) => resolveTimeSeriesYDomain(yDomainSource, axisAreas),
        series: params.resolvedAreas,
      }),
    [yDomainSource, params.resolvedAreas],
  );
  const yDomain = useMemo(
    () => domainForAxis(yDomainsByAxis, DEFAULT_Y_AXIS_ID),
    [yDomainsByAxis],
  );

  // Bklit parity: new data paints immediately; only a y-domain change tweens.
  const { niced: nicedYDomain, changed: nicedYDomainChanged } =
    useNicedYDomainChanged(yDomain);

  // Projection merge is not re-niced (bklit builds scaleLinear({domain}) with no nice).
  const yDomainFinal = useMemo<[number, number]>(() => {
    if (params.projectionConfigs.length === 0) {return nicedYDomain;}
    return mergeProjectionYDomain(nicedYDomain, params.projectionConfigs, DEFAULT_Y_AXIS_ID);
  }, [nicedYDomain, params.projectionConfigs]);

  // One y scale in the spec; secondary axes reproject values into the primary domain.
  const nicedDomainsByAxis = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      const nicedDomain = createNicedYScale(domain).domain();
      out[axisId] = [nicedDomain[0], nicedDomain[1]];
    }
    return out;
  }, [yDomainsByAxis]);
  const projectorFor = useMemo(
    () => createAxisValueProjector(nicedDomainsByAxis, yDomainFinal),
    [nicedDomainsByAxis, yDomainFinal],
  );

  const [prevYDomainFinal, setPrevYDomainFinal] = useState(yDomainFinal);
  if (prevYDomainFinal[0] !== yDomainFinal[0] || prevYDomainFinal[1] !== yDomainFinal[1]) {
    setPrevYDomainFinal(yDomainFinal);
  }
  const yDomainChanged =
    params.projectionConfigs.length === 0
      ? nicedYDomainChanged
      : prevYDomainFinal[0] !== yDomainFinal[0] || prevYDomainFinal[1] !== yDomainFinal[1];

  return {
    nicedDomainsByAxis,
    projectorFor,
    visibleData,
    xAccessorForBrush,
    yDomainChanged,
    yDomainFinal,
  };
};

export { useAreaYDomain };
export type { AreaYDomain, AreaYDomainParams };
