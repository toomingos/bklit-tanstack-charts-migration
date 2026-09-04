// Line-chart y-domain pipeline: loading skeleton source, per-axis domains, and tween gate.
import { useMemo, useState } from "react";
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
import { buildLoadingSkeletonRows } from "./loading-chrome";
import type { ChartDatum, ChartStatus, LineConfig } from "./types";

interface LineYDomainsParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly lines: readonly Readonly<LineConfig>[];
  readonly projectionConfigs: readonly ProjectionLineConfig[];
  readonly status: ChartStatus;
  readonly visibleData: readonly Readonly<ChartDatum>[];
}

interface LineYDomains {
  readonly nicedDomainsByAxis: Record<string, [number, number]>;
  readonly nicedYDomain: [number, number];
  readonly nicedYDomainChanged: boolean;
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly yDomain: [number, number];
  readonly yDomainChangedForTween: boolean;
  readonly yDomainFinal: [number, number];
  readonly yDomainsByAxis: Record<string, [number, number]>;
}

const useLineYDomains = (params: Readonly<LineYDomainsParams>): LineYDomains => {
  const { data, lines, projectionConfigs, status, visibleData } = params;
  // Bklit parity: all>=0 -> [0, max*1.1]; mixed-sign -> [min,max] +/-5%; empty -> [0,100].
  const skeletonRows = useMemo(
    () => buildLoadingSkeletonRows(data.length, lines[0]?.dataKey ?? "value"),
    [data.length, lines],
  );
  // Cheap ternary over two memoized sources; a useMemo here costs more than it saves.
  const yDomainSource = status === "loading" ? skeletonRows : visibleData;
  const yDomainsByAxis = useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: (axisLines: readonly Readonly<LineConfig>[]) => resolveTimeSeriesYDomain(yDomainSource, axisLines),
        series: lines,
      }),
    [yDomainSource, lines],
  );
  const yDomain = useMemo(
    () => domainForAxis(yDomainsByAxis, DEFAULT_Y_AXIS_ID),
    [yDomainsByAxis],
  );

  const { niced: nicedYDomain, changed: nicedYDomainChanged } =
    useNicedYDomainChanged(yDomain);

  const yDomainFinal = useMemo<[number, number]>(() => {
    if (projectionConfigs.length === 0) {return nicedYDomain;}
    return mergeProjectionYDomain(nicedYDomain, projectionConfigs, DEFAULT_Y_AXIS_ID);
  }, [nicedYDomain, projectionConfigs]);

  const nicedDomainsByAxis = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      const nicedPair = createNicedYScale(domain).domain();
      out[axisId] = [nicedPair[0] ?? domain[0], nicedPair[1] ?? domain[1]];
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
  const yDomainChangedForTween =
    projectionConfigs.length === 0
      ? nicedYDomainChanged
      : prevYDomainFinal[0] !== yDomainFinal[0] ||
        prevYDomainFinal[1] !== yDomainFinal[1];
  return { nicedDomainsByAxis, nicedYDomain, nicedYDomainChanged, projectorFor, yDomain, yDomainChangedForTween, yDomainFinal, yDomainsByAxis };
};

export { useLineYDomains };
export type { LineYDomains, LineYDomainsParams };
