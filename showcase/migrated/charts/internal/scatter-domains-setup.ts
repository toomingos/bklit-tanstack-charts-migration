import { useCallback, useMemo } from "react";
import {
  createAxisValueProjector,
  createNicedYScale,
  resolveYDomainsByAxis,
} from "./y-domain";
import { DEFAULT_Y_AXIS_ID } from "./y-axis-id";
import { isFiniteNumber } from "./scatter-datum-utils";
import type { ResolvedSeries } from "./scatter-marks";
import type { ChartDatum } from "./types";

// Y domain fallback max when no positive value exists; positives get headroom scale.
const SCATTER_DOMAIN_FALLBACK_MAX = 100;
const SCATTER_DOMAIN_HEADROOM_SCALE = 1.1;

// Bklit parity: negatives ignored, max floored at 0, *1.1, fallback 100; nice() from the scale.
// Per-axis grouping keeps scatter's own rule via the resolveDomain seam (not the time-series one).
const findScatterAxisMax = (
  data: readonly Readonly<ChartDatum>[],
  axisSeries: readonly { readonly dataKey: string }[],
): [number, number] => {
  let max = 0;
  for (const row of data) {
    for (const series of axisSeries) {
      const value = row[series.dataKey];
      if (isFiniteNumber(value) && value > max) {max = value;}
    }
  }
  return [0, max <= 0 ? SCATTER_DOMAIN_FALLBACK_MAX : max * SCATTER_DOMAIN_HEADROOM_SCALE];
};

interface UseScatterDomainsParams {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly resolvedSeries: readonly Readonly<ResolvedSeries>[];
}

interface ScatterDomains {
  readonly nicedDomainsByAxis: Record<string, [number, number]>;
  readonly nicedYDomain: [number, number];
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly yDomain: [number, number];
}

// Axis-keyed niced domains, one entry per represented y axis id.
interface NicedDomainsByAxis {
  [axisId: string]: [number, number];
}

const buildNicedDomainsByAxis = (
  yDomainsByAxis: Record<string, [number, number]>,
): NicedDomainsByAxis => {
  const out: Record<string, [number, number]> = {};
  for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
    const niced = createNicedYScale(domain).domain();
    const pair: [number, number] = [niced[0] ?? domain[0], niced[1] ?? domain[1]];
    out[axisId] = pair;
  }
  return out;
};

const useScatterDomains = ({
  data,
  resolvedSeries,
}: Readonly<UseScatterDomainsParams>): ScatterDomains => {
  const resolveScatterAxisDomain = useCallback(
    (axisSeries: readonly { readonly dataKey: string }[]): [number, number] =>
      findScatterAxisMax(data, axisSeries),
    [data],
  );

  const yDomainsByAxis = useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: resolveScatterAxisDomain,
        series: resolvedSeries,
      }),
    [resolvedSeries, resolveScatterAxisDomain],
  );

  // Same closure, not domainForAxis: identical empty answer today, tied together if either changes.
  const yDomain = useMemo<[number, number]>(
    () => yDomainsByAxis[DEFAULT_Y_AXIS_ID] ?? resolveScatterAxisDomain([]),
    [yDomainsByAxis, resolveScatterAxisDomain],
  );

  // Secondary axes reproject into the NICED tuple, not yDomain itself (yScale nices yDomain).
  const nicedDomainsByAxis = useMemo(() => buildNicedDomainsByAxis(yDomainsByAxis), [yDomainsByAxis]);
  const nicedYDomain = useMemo<[number, number]>(() => {
    const niced = createNicedYScale(yDomain).domain();
    return [niced[0] ?? yDomain[0], niced[1] ?? yDomain[1]];
  }, [yDomain]);
  const projectorFor = useMemo(
    () => createAxisValueProjector(nicedDomainsByAxis, nicedYDomain),
    [nicedDomainsByAxis, nicedYDomain],
  );
  return { nicedDomainsByAxis, nicedYDomain, projectorFor, yDomain };
};

export { buildNicedDomainsByAxis, findScatterAxisMax, useScatterDomains };
export type { ScatterDomains, UseScatterDomainsParams };
