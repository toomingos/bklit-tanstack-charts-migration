import { curveMonotoneX, curveNatural } from "d3-shape";
import { useCallback, useMemo, useState } from "react";
import {
  applyProjectionYDomain,
  computeComposedStackOffsets,
  computeComposedYScaleDomainMax,
} from "./composed-data-math";
import type { ComposedSeriesEntry, ResolvedArea, ResolvedBar, ResolvedLine } from "./composed-model";
import type { ProjectionLineConfig } from "./projection-config";
import type {
  AreaConfig,
  ChartDatum,
  LineConfig,
  SeriesBarConfig,
} from "./types";
import {
  createAxisValueProjector,
  createNicedYScale,
  domainForAxis,
  resolveTimeSeriesYDomain,
  resolveYDomainsByAxis,
  useNicedYDomainChanged,
} from "./y-domain";
import { DEFAULT_Y_AXIS_ID, usesDefaultAxisOnly } from "./y-axis-id";

// Shared stroke/fill fallback color across every role's chain.
const DEFAULT_COLOR = "var(--chart-line-primary)";
const DEFAULT_BAR_FADED_OPACITY = 0.3;
const DEFAULT_AREA_FILL_OPACITY = 0.4;
const DEFAULT_AREA_DIM_OPACITY = 0.6;
const DEFAULT_LINE_DIM_OPACITY = 0.3;
const DEFAULT_LINE_STROKE_WIDTH = 2.5;
// Default area stroke width when the Area child leaves it unset.
const DEFAULT_AREA_STROKE_WIDTH = 2;
// Bklit fabricates a synthetic [0, 100] percent-style range for a non-"left" projection axis.
const PROJECTION_FALLBACK_Y_MAX = 100;
// Shared default circle radius for terminal/end/projection point markers.
const DEFAULT_MARKER_RADIUS = 5;
const DEFAULT_TERMINAL_MARKER_STROKE_WIDTH = 1.5;

// Locally-owned optional values represent "absent" as `undefined`, never `null`.
const { NOTHING }: { NOTHING?: undefined } = {};

/*
 * Module-scope defaults shared by every memo eval, matching bklit unset values.
 */
const TERMINAL_ANCHOR_FALLBACKS = {
  fill: "transparent",
  outlineWidth: 0,
  radius: DEFAULT_MARKER_RADIUS,
  ringGap: 0,
  stroke: "var(--chart-1)",
  strokeWidth: DEFAULT_TERMINAL_MARKER_STROKE_WIDTH,
};
const END_ANCHOR_FALLBACKS = { radius: DEFAULT_MARKER_RADIUS, stroke: "var(--chart-3)" };
const PROJECTION_STROKE_FALLBACKS = {
  gradientEnd: "var(--chart-5)",
  stroke: "var(--chart-3)",
  strokeWidth: 2,
};
const PROJECTION_MARKER_FALLBACKS = { endpointRadius: DEFAULT_MARKER_RADIUS };

interface ComposedGradientDef {
  readonly dataKey: string;
  readonly fill: string;
  readonly fillOpacity: number;
  readonly id: string;
}

const resolveComposedBars = (barConfigs: readonly Readonly<SeriesBarConfig>[]): ResolvedBar[] =>
  barConfigs.map((bar: Readonly<SeriesBarConfig>) => ({
    animate: bar.animate ?? true,
    dataKey: bar.dataKey,
    fadedOpacity: bar.fadedOpacity ?? DEFAULT_BAR_FADED_OPACITY,
    fill: bar.fill ?? DEFAULT_COLOR,
    radius: bar.radius ?? 0,
  }));

const resolveComposedAreas = (areaConfigs: readonly Readonly<AreaConfig>[]): ResolvedArea[] =>
  areaConfigs.map((area: Readonly<AreaConfig>) => {
    const fill = area.fill ?? DEFAULT_COLOR;
    return {
      curve: area.curve ?? curveMonotoneX,
      dataKey: area.dataKey,
      fill,
      fillOpacity: area.fillOpacity ?? DEFAULT_AREA_FILL_OPACITY,
      stroke: area.stroke ?? fill,
      strokeWidth: area.strokeWidth ?? DEFAULT_AREA_STROKE_WIDTH,
    };
  });

const resolveComposedLines = (lineConfigs: readonly Readonly<LineConfig>[]): ResolvedLine[] =>
  lineConfigs.map((lineCfg: Readonly<LineConfig>) => ({
    curve: lineCfg.curve ?? curveNatural,
    dataKey: lineCfg.dataKey,
    stroke: lineCfg.stroke ?? DEFAULT_COLOR,
    strokeWidth: lineCfg.strokeWidth ?? DEFAULT_LINE_STROKE_WIDTH,
  }));

interface UseComposedResolvedParams {
  readonly areaConfigs: readonly Readonly<AreaConfig>[];
  readonly barConfigs: readonly Readonly<SeriesBarConfig>[];
  readonly lineConfigs: readonly Readonly<LineConfig>[];
}

interface UseComposedResolvedResult {
  readonly resolvedAreas: ResolvedArea[];
  readonly resolvedBars: ResolvedBar[];
  readonly resolvedLines: ResolvedLine[];
}

const useComposedResolved = (params: Readonly<UseComposedResolvedParams>): UseComposedResolvedResult => {
  const resolvedBars = useMemo<ResolvedBar[]>(
    () => resolveComposedBars(params.barConfigs),
    [params.barConfigs],
  );
  const resolvedAreas = useMemo<ResolvedArea[]>(
    () => resolveComposedAreas(params.areaConfigs),
    [params.areaConfigs],
  );
  const resolvedLines = useMemo<ResolvedLine[]>(
    () => resolveComposedLines(params.lineConfigs),
    [params.lineConfigs],
  );
  return { resolvedAreas, resolvedBars, resolvedLines };
};

interface UseComposedYDomainsParams {
  readonly barDataKeys: readonly string[];
  readonly composedSeries: readonly Readonly<ComposedSeriesEntry>[];
  readonly data: readonly Readonly<ChartDatum>[];
  readonly projectionConfigs: ProjectionLineConfig[];
  readonly stacked: boolean;
}

interface UseComposedYDomainsResult {
  readonly composedStackOffsets: Map<number, Map<string, number>> | undefined;
  readonly nicedDomainsByAxis: Record<string, [number, number]>;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly yDomainChanged: boolean;
  readonly yDomainFinal: [number, number];
}

const useComposedYDomains = (params: Readonly<UseComposedYDomainsParams>): UseComposedYDomainsResult => {
  const { barDataKeys, composedSeries, data, projectionConfigs, stacked } = params;
  const composedStackOffsets = useMemo(
    () =>
      stacked && barDataKeys.length > 0
        ? computeComposedStackOffsets(data, barDataKeys)
        : NOTHING,
    [stacked, barDataKeys, data],
  );

  // Y-domain scans all merged series over raw data; stacked mode overrides the max first.
  const stackedYScaleDomainMax = useMemo(() => {
    if (
      !stacked ||
      barDataKeys.length === 0 ||
      !usesDefaultAxisOnly(composedSeries)
    ) {
      return NOTHING;
    }
    return computeComposedYScaleDomainMax(data, composedSeries, barDataKeys);
  }, [stacked, barDataKeys, composedSeries, data]);
  const yDomainsByAxis = useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: (axisSeries: readonly Readonly<ComposedSeriesEntry>[]) =>
          resolveTimeSeriesYDomain(data, axisSeries, stackedYScaleDomainMax),
        series: composedSeries,
      }),
    [data, composedSeries, stackedYScaleDomainMax],
  );
  const yDomain = useMemo<[number, number]>(
    () => domainForAxis(yDomainsByAxis, DEFAULT_Y_AXIS_ID),
    [yDomainsByAxis],
  );
  const { niced: nicedYDomainBase, changed: nicedYDomainChanged } =
    useNicedYDomainChanged(yDomain);
  const yDomainFinal = useMemo<[number, number]>(() => {
    if (projectionConfigs.length === 0) {return nicedYDomainBase;}
    return applyProjectionYDomain(nicedYDomainBase, projectionConfigs, PROJECTION_FALLBACK_Y_MAX);
  }, [nicedYDomainBase, projectionConfigs]);

  const nicedDomainsByAxis = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      // D3's domain() always returns the 2-element nice domain here; the fallback keeps the
      // Tuple total by falling back to the input domain if d3 ever returned fewer stops.
      const niced = createNicedYScale(domain).domain();
      out[axisId] = [niced[0] ?? domain[0], niced[1] ?? domain[1]];
    }
    return out;
  }, [yDomainsByAxis]);
  const projectorFor = useMemo(
    () => createAxisValueProjector(nicedDomainsByAxis, yDomainFinal),
    [nicedDomainsByAxis, yDomainFinal],
  );
  const projectByKey = useMemo(() => {
    const byKey = new Map<string, (value: number) => number>();
    for (const entry of composedSeries) {byKey.set(entry.dataKey, projectorFor(entry.yAxisId));}
    return byKey;
  }, [composedSeries, projectorFor]);
  const projectValue = useCallback(
    (dataKey: string, value: number) => {
      const project = projectByKey.get(dataKey);
      return project ? project(value) : value;
    },
    [projectByKey],
  );

  // Bklit parity: new data paints immediately; only a y-domain change tweens.
  const [prevYDomainFinal, setPrevYDomainFinal] = useState(yDomainFinal);
  if (prevYDomainFinal[0] !== yDomainFinal[0] || prevYDomainFinal[1] !== yDomainFinal[1]) {
    setPrevYDomainFinal(yDomainFinal);
  }
  const yDomainChanged =
    projectionConfigs.length === 0
      ? nicedYDomainChanged
      : prevYDomainFinal[0] !== yDomainFinal[0] || prevYDomainFinal[1] !== yDomainFinal[1];

  return { composedStackOffsets, nicedDomainsByAxis, projectValue, yDomainChanged, yDomainFinal };
};

export {
  DEFAULT_AREA_DIM_OPACITY,
  DEFAULT_AREA_STROKE_WIDTH,
  DEFAULT_COLOR,
  DEFAULT_LINE_DIM_OPACITY,
  DEFAULT_LINE_STROKE_WIDTH,
  END_ANCHOR_FALLBACKS,
  NOTHING,
  PROJECTION_MARKER_FALLBACKS,
  PROJECTION_STROKE_FALLBACKS,
  TERMINAL_ANCHOR_FALLBACKS,
  resolveComposedAreas,
  resolveComposedBars,
  resolveComposedLines,
  useComposedResolved,
  useComposedYDomains,
};
export type {
  ComposedGradientDef,
  UseComposedResolvedParams,
  UseComposedResolvedResult,
  UseComposedYDomainsParams,
  UseComposedYDomainsResult,
};
