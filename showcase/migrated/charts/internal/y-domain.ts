// All>=0 -> [0,max*1.1]; mixed-sign -> 5% pad; empty -> [0,100]. Scatter has own rules.
import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import type { ScaleLinear } from "d3-scale";

import type { ChartDatum } from "./types";
import { Y_DOMAIN_TWEEN_SKIP_THRESHOLD } from './chart-phase';
import type { ChartPhase } from './chart-phase';
import { DEFAULT_Y_AXIS_ID, groupSeriesByYAxisId, normalizeYAxisId } from './y-axis-id';
import type { YAxisSeries } from './y-axis-id';
import { isFiniteNumber } from "./series-bar-scene";

type YDomain = [number, number];

// Headroom multiplier applied above the data max so the topmost point never touches the chart edge.
const Y_DOMAIN_HEADROOM_RATIO = 1.1;
// Fallback upper bound when there is no data (or no positive data) to derive a domain from.
const FALLBACK_Y_DOMAIN_MAX = 100;
// Padding fraction of the data span applied on each side for mixed-sign domains.
const MIXED_SIGN_DOMAIN_PADDING_RATIO = 0.05;

// Indexed Record reads are typed as always-present, but a missing key is undefined at runtime. This read keeps the honest `| undefined` so absence guards stay necessary.
const readRecordEntry = <Value>(entries: Readonly<Record<string, Value>>, key: string): Value | undefined => entries[key];

interface TimeSeriesExtent {
  readonly min: number;
  readonly max: number;
}

interface MutableTimeSeriesExtent {
  min: number;
  max: number;
}

const trackFiniteValue = (acc: MutableTimeSeriesExtent, row: Readonly<ChartDatum>, dataKey: string): void => {
  const value = row[dataKey];
  if (!isFiniteNumber(value)) {
    return;
  }
  if (value < acc.min) {acc.min = value;}
  if (value > acc.max) {acc.max = value;}
}

const accumulateRowExtent = (row: Readonly<ChartDatum>, series: readonly { readonly dataKey: string }[], acc: MutableTimeSeriesExtent): void => {
  for (const seriesEntry of series) {
    trackFiniteValue(acc, row, seriesEntry.dataKey);
  }
}

const findTimeSeriesExtent = (data: readonly Readonly<ChartDatum>[], series: readonly { readonly dataKey: string }[]): TimeSeriesExtent => {
  const acc: MutableTimeSeriesExtent = { max: -Infinity, min: Infinity };
  for (const row of data) {
    accumulateRowExtent(row, series, acc);
  }
  return acc;
}

const finalizeTimeSeriesDomain = (extent: Readonly<TimeSeriesExtent>): YDomain => {
  if (!Number.isFinite(extent.min)) {return [0, FALLBACK_Y_DOMAIN_MAX];}
  if (extent.min >= 0) {return [0, extent.max <= 0 ? FALLBACK_Y_DOMAIN_MAX : extent.max * Y_DOMAIN_HEADROOM_RATIO];}
  const padding = (extent.max - extent.min) * MIXED_SIGN_DOMAIN_PADDING_RATIO || 1;
  return [extent.min - padding, extent.max + padding];
}

const resolveTimeSeriesYDomain = (data: readonly Readonly<ChartDatum>[], series: readonly { readonly dataKey: string }[], yScaleDomainMax?: number): YDomain => {
  if (yScaleDomainMax !== undefined && yScaleDomainMax > 0) {
    return [0, yScaleDomainMax * Y_DOMAIN_HEADROOM_RATIO];
  }
  return finalizeTimeSeriesDomain(findTimeSeriesExtent(data, series));
}

interface NicedYDomainState {
  readonly niced: [number, number];
  readonly changed: boolean;
}

const useNicedYDomainChanged = (yDomain: readonly [number, number]): NicedYDomainState => {
  const niced = useMemo<[number, number]>(
    () => {
      const rawDomain = scaleLinear().domain(yDomain).nice().domain();
      return [rawDomain[0] ?? yDomain[0], rawDomain[1] ?? yDomain[1]];
    },
    [yDomain],
  );
  const [prevNiced, setPrevNiced] = useState(niced);
  const changed = prevNiced[0] !== niced[0] || prevNiced[1] !== niced[1];
  // Render-time adjustment keeps render pure; same prev-state pattern as ring-chart.
  if (changed) {setPrevNiced(niced);}
  return { changed, niced };
}

const createNicedYScale = (yDomain: readonly [number, number]): ScaleLinear<number, number> => scaleLinear().domain(yDomain).nice();


type NicedYScale = ReturnType<typeof createNicedYScale>;

// Axis-keyed y domains, one entry per represented y axis id.
interface YDomainsByAxis {
  readonly [axisId: string]: YDomain;
}

// No .nice() here (tween detector compares this value); default-axis backfill is opt-in.
const resolveYDomainsByAxis = <Series extends YAxisSeries>({
  series,
  resolveDomain,
  ensureDefaultAxis = false,
}: Readonly<{
  series: readonly Series[];
  resolveDomain: (axisSeries: readonly Series[], axisId: string) => YDomain;
  ensureDefaultAxis?: boolean;
}>): YDomainsByAxis => {
  const domains: Record<string, YDomain> = {};
  for (const [axisId, axisSeries] of groupSeriesByYAxisId(series)) {
    domains[axisId] = resolveDomain(axisSeries, axisId);
  }
  if (ensureDefaultAxis && !(DEFAULT_Y_AXIS_ID in domains)) {
    domains[DEFAULT_Y_AXIS_ID] = [0, FALLBACK_Y_DOMAIN_MAX];
  }
  return domains;
}

const getPrimaryYScale = (yScales: Readonly<Record<string, NicedYScale>>, fallback: NicedYScale): NicedYScale => {
  const primary = readRecordEntry(yScales, DEFAULT_Y_AXIS_ID);
  if (primary !== undefined) {return primary;}
  const first = Object.values(yScales).at(0);
  return first ?? fallback;
}

// One shared y-scale: secondary axes reproject into the primary domain.
const identityValue = (value: number): number => value;

interface AxisProjectionParams {
  readonly source: Readonly<YDomain>;
  readonly primaryDomain: Readonly<YDomain>;
}

const projectOntoPrimaryDomain = ({ source, primaryDomain }: Readonly<AxisProjectionParams>): ((value: number) => number) => {
  const [a0, a1] = source;
  const [p0, p1] = primaryDomain;
  if (a0 === p0 && a1 === p1) {return identityValue;}
  const span = a1 - a0;
  if (!Number.isFinite(span) || span === 0) {return () => p0;}
  const scale = (p1 - p0) / span;
  return (value: number) => p0 + (value - a0) * scale;
};

const createAxisValueProjector = (domainsByAxis: Readonly<Record<string, Readonly<YDomain>>>, primaryDomain: Readonly<YDomain>): (axisId?: string | number) => (value: number) => number => (axisId?: string | number) => {
    const id = normalizeYAxisId(axisId);
    if (id === DEFAULT_Y_AXIS_ID) {return identityValue;}
    const source = readRecordEntry(domainsByAxis, id);
    if (source === undefined || source === primaryDomain) {return identityValue;}
    return projectOntoPrimaryDomain({ primaryDomain, source });
  };

const domainForAxis = (domainsByAxis: Record<string, YDomain>, axisId: string): YDomain => {
  const direct = readRecordEntry(domainsByAxis, axisId);
  const fallbackAxis = readRecordEntry(domainsByAxis, DEFAULT_Y_AXIS_ID);
  return direct ?? fallbackAxis ?? [0, FALLBACK_Y_DOMAIN_MAX];
};



// D521c: the host reader `useChartStable` in chart-context.tsx wins; the LOCAL
// Builder was dead (zero callers; the barrel exports the host reader).

const domainsEqual = (left: Readonly<Record<string, Readonly<YDomain>>>, right: Readonly<Record<string, Readonly<YDomain>>>): boolean => {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) {return false;}
  for (const axisId of leftKeys) {
    const from = readRecordEntry(left, axisId);
    const to = readRecordEntry(right, axisId);
    if (from === undefined || to === undefined || from[0] !== to[0] || from[1] !== to[1]) {return false;}
  }
  return true;
}

const shouldTweenYDomain = (from: Readonly<YDomain>, to: Readonly<YDomain>): boolean => {
  const span = Math.max(Math.abs(to[1] - to[0]), Math.abs(from[1] - from[0]), 1);
  const deltaMin = Math.abs(to[0] - from[0]) / span;
  const deltaMax = Math.abs(to[1] - from[1]) / span;
  return (
    deltaMin >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD ||
    deltaMax >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD
  );
}

const isYDomainTweenPhase = (phase: ChartPhase): boolean => phase === "gridTweenLoading" || phase === "gridTweenReady";


const resolveAnimatedYDestinationDomains = (chartPhase: ChartPhase, skeletonByAxis: Record<string, YDomain>, targetByAxis: Record<string, YDomain>): Record<string, YDomain> => {
  switch (chartPhase) {
    case "loading":
    case "exiting":
    case "gridTweenLoading": {
      return skeletonByAxis;
    }
    case "gridTweenReady":
    case "revealing":
    case "revealingLoading":
    case "ready":
    case "exitingReady": {
      return targetByAxis;
    }
    default: {
      return targetByAxis;
    }
  }
}

export {
  resolveTimeSeriesYDomain,
  useNicedYDomainChanged,
  createNicedYScale,
  resolveYDomainsByAxis,
  getPrimaryYScale,
  createAxisValueProjector,
  domainForAxis,
  domainsEqual,
  shouldTweenYDomain,
  isYDomainTweenPhase,
  resolveAnimatedYDestinationDomains,
};
export type { YDomain, NicedYScale };
