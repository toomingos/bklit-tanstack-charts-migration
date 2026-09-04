// Bar scale and series-resolution hook: categories, domains, band/group scales, focus.
// Split from bar-chart.tsx without behaviour change.
import { useCallback, useMemo } from "react";
import type { RefObject } from "react";
import { scaleBand } from "d3-scale";
import type { ScaleBand } from "d3-scale";
import type { ChartFocusStrategy } from "@tanstack/charts";
import { barCategoryAccessor } from "./bar-chart-hover-dots";
import { BAR_FADED_OPACITY } from "./bar-depth-marks";
import { createBarFocusStrategy } from "./bar-focus-strategy";
import { isFiniteNumber } from "./series-bar-scene";
import type { ResolvedBarColumnTrack, ResolvedBarSquare, ResolvedSeries } from "./bar-chart-series-marks";
import type { BarConfig, BarColumnTrackConfig, BarSquaresConfig, ChartDatum, ChartPhase } from "./types";
import type { ChartMargin } from "./use-chart-margin";
import { DEFAULT_Y_AXIS_ID } from "./y-axis-id";
import { createAxisValueProjector, createNicedYScale, resolveYDomainsByAxis } from "./y-domain";

// Single fixed fill, not a rotating per-series palette (unlike scatter).
const DEFAULT_BAR_FILL = "var(--chart-line-primary)";
// Default gap between squares in squares and column-track marks.
const DEFAULT_SQUARE_GAP = 3;
// Default corner-radius fraction for square marks.
const DEFAULT_SQUARE_RADIUS = 0.25;
// Empty-domain fallback max before headroom; no-series stays [0, 110] via the factor below.
const BAR_DOMAIN_EMPTY_FALLBACK_MAX = 100;
// Y-domain headroom factor over the data max.
const BAR_DOMAIN_HEADROOM_FACTOR = 1.1;
const GROUP_GAP = 4;

interface UseBarScalesOptions {
  readonly barColumnTracksRaw: readonly Readonly<BarColumnTrackConfig>[];
  readonly bars: readonly Readonly<BarConfig>[];
  readonly barGap: number;
  readonly barSquaresRaw: readonly Readonly<BarSquaresConfig>[];
  readonly margin: ChartMargin;
  readonly phaseRef: RefObject<ChartPhase>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly width: number;
  readonly xDataKey: string;
}

interface UseBarScalesResult {
  readonly allSeriesKeys: string[];
  readonly bandWidth: number;
  readonly barFocusStrategy: ChartFocusStrategy<ChartDatum, string, number>;
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly categoryOrder: string[];
  readonly categoryScaleForOverlay: ScaleBand<string>;
  readonly dotSeriesList: { readonly color: string; readonly dataKey: string }[];
  readonly groupBandwidth: number;
  readonly groupScale: ScaleBand<string>;
  readonly groupScaleForOverlay: ScaleBand<string>;
  readonly hasBarColumnTrack: boolean;
  readonly hasBarSquares: boolean;
  readonly innerWidth: number;
  readonly nicedDomainsByAxis: Record<string, [number, number]>;
  readonly nicedPrimaryDomain: [number, number];
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly resolvedBarColumnTracks: readonly ResolvedBarColumnTrack[];
  readonly resolvedBarSquares: readonly ResolvedBarSquare[];
  readonly resolvedSeries: ResolvedSeries[];
  readonly totalSeriesCount: number;
  readonly xScaleFactory: () => ScaleBand<string>;
  readonly yScale: ReturnType<typeof createNicedYScale>;
}

const useBarScales = (options: Readonly<UseBarScalesOptions>): UseBarScalesResult => {
  const { barColumnTracksRaw, bars, barGap, barSquaresRaw, margin, phaseRef, renderData, width, xDataKey } = options;

  const categoryAccessor = useMemo(() => barCategoryAccessor(xDataKey), [xDataKey]);

  const resolvedSeries = useMemo<ResolvedSeries[]>(
    () =>
      bars.map((bar: Readonly<BarConfig>) => {
        const fill = bar.fill ?? DEFAULT_BAR_FILL;
        return {
          dataKey: bar.dataKey,
          dotColor: bar.stroke ?? fill,
          fadedOpacity: bar.fadedOpacity ?? BAR_FADED_OPACITY,
          fill,
          lineCap: bar.lineCap ?? "round",
          yAxisId: bar.yAxisId,
        };
      }),
    [bars],
  );

  const hasBarSquares = barSquaresRaw.length > 0;
  const hasBarColumnTrack = barColumnTracksRaw.length > 0;

  const resolvedBarSquares = useMemo<readonly ResolvedBarSquare[]>(() => {
    if (!hasBarSquares) {return [];}
    return barSquaresRaw.map((square: Readonly<BarSquaresConfig>) => ({
      animate: square.animate ?? true,
      dataKey: square.dataKey,
      fadedOpacity: square.fadedOpacity ?? BAR_FADED_OPACITY,
      fill: square.fill ?? DEFAULT_BAR_FILL,
      gradientStops: square.gradientStops ?? [],
      groupGap: square.groupGap ?? GROUP_GAP,
      patternPreset: square.patternPreset,
      squareFit: square.squareFit ?? false,
      squareGap: square.squareGap ?? DEFAULT_SQUARE_GAP,
      squareRadius: square.squareRadius ?? DEFAULT_SQUARE_RADIUS,
      staggerDelay: square.staggerDelay,
      stroke: square.stroke,
      useGradient: square.useGradient ?? false,
      yAxisId: square.yAxisId,
    }));
  }, [barSquaresRaw, hasBarSquares]);

  const resolvedBarColumnTracks = useMemo<readonly ResolvedBarColumnTrack[]>(() => {
    if (!hasBarColumnTrack) {return [];}
    return barColumnTracksRaw.map((track: Readonly<BarColumnTrackConfig>) => ({
      fill: track.fill ?? "var(--chart-grid)",
      groupGap: track.groupGap ?? GROUP_GAP,
      opacity: track.opacity ?? BAR_FADED_OPACITY,
      squareFit: track.squareFit ?? false,
      squareGap: track.squareGap ?? DEFAULT_SQUARE_GAP,
      squareRadius: track.squareRadius ?? DEFAULT_SQUARE_RADIUS,
      staggerDelay: track.staggerDelay,
    }));
  }, [barColumnTracksRaw, hasBarColumnTrack]);

  const allSeriesForDomain = useMemo(
    () => [
      ...resolvedSeries.map((series) => ({ dataKey: series.dataKey, yAxisId: series.yAxisId })),
      ...resolvedBarSquares.map((square) => ({ dataKey: square.dataKey, yAxisId: square.yAxisId })),
    ],
    [resolvedSeries, resolvedBarSquares],
  );

  const dotSeriesList = useMemo(
    () => [
      ...resolvedSeries.map((series) => ({ color: series.dotColor, dataKey: series.dataKey })),
      ...resolvedBarSquares.map((square) => ({ color: square.stroke ?? square.fill, dataKey: square.dataKey })),
    ],
    [resolvedSeries, resolvedBarSquares],
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);

  const categoryOrder = useMemo(
    () => renderData.map((datum: Readonly<ChartDatum>) => categoryAccessor(datum)),
    [renderData, categoryAccessor],
  );

  // X/y are factories: TanStack infers domains and applies the margin-inclusive range itself.
  const xScaleFactory = useMemo(
    () => (): ScaleBand<string> => scaleBand().domain(categoryOrder).padding(barGap),
    [categoryOrder, barGap],
  );

  // Bklit parity: [0, (max || 100) * 1.1], empty input falls back to 100.
  const resolveBarAxisDomain = useCallback(
    (axisSeries: readonly { readonly dataKey: string }[]): [number, number] => {
      let max = 0;
      for (const series of axisSeries) {
        for (const datum of renderData) {
          const value = datum[series.dataKey];
          if (isFiniteNumber(value) && value > max) {max = value;}
        }
      }
      return [0, (max || BAR_DOMAIN_EMPTY_FALLBACK_MAX) * BAR_DOMAIN_HEADROOM_FACTOR];
    },
    [renderData],
  );

  const yDomainsByAxis = useMemo(
    () =>
      resolveYDomainsByAxis({
        resolveDomain: resolveBarAxisDomain,
        series: allSeriesForDomain,
      }),
    [allSeriesForDomain, resolveBarAxisDomain],
  );

  // No-series fallback stays [0, 110] via the same closure, not domainForAxis's [0, 100].
  const yDomain = useMemo<[number, number]>(
    () => yDomainsByAxis[DEFAULT_Y_AXIS_ID] ?? resolveBarAxisDomain([]),
    [yDomainsByAxis, resolveBarAxisDomain],
  );
  // Pre-domained y instance preserves the *1.1 headroom; a factory would re-infer it away.
  const yScale = useMemo(() => createNicedYScale(yDomain), [yDomain]);
  // D3 domain() returns number[]; destructure with defaults to recover the known pair.
  const nicedPrimaryDomain = useMemo<[number, number]>(() => {
    const [lo = 0, hi = 0] = yScale.domain();
    return [lo, hi];
  }, [yScale]);

  // Secondary axes reproject per dataKey so all four mark families agree on each series.
  const nicedDomainsByAxis = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const [axisId, domain] of Object.entries(yDomainsByAxis)) {
      const [nicedLo = 0, nicedHi = 0] = createNicedYScale(domain).domain();
      const niced: [number, number] = [nicedLo, nicedHi];
      out[axisId] = niced;
    }
    return out;
  }, [yDomainsByAxis]);

  const projectYByKey = useMemo(() => {
    const projectorFor = createAxisValueProjector(
      nicedDomainsByAxis,
      nicedPrimaryDomain,
    );
    const byKey = new Map<string, (value: number) => number>();
    for (const series of allSeriesForDomain) {
      byKey.set(series.dataKey, projectorFor(series.yAxisId));
    }
    return byKey;
  }, [nicedDomainsByAxis, nicedPrimaryDomain, allSeriesForDomain]);

  const projectValue = useCallback(
    (dataKey: string, value: number) => {
      const project = projectYByKey.get(dataKey);
      return project ? project(value) : value;
    },
    [projectYByKey],
  );

  const bandWidth = useMemo(() => {
    if (innerWidth <= 0 || categoryOrder.length === 0) {return 0;}
    const ranged = scaleBand()
      .domain(categoryOrder)
      .range([margin.left, margin.left + innerWidth])
      .padding(barGap);
    return ranged.bandwidth();
  }, [categoryOrder, barGap, innerWidth, margin.left]);

  const seriesCount = resolvedSeries.length;
  const totalSeriesCount = resolvedSeries.length + resolvedBarSquares.length;
  const allSeriesKeys = useMemo(() => [...resolvedSeries.map((series) => series.dataKey), ...resolvedBarSquares.map((square) => square.dataKey)], [resolvedSeries, resolvedBarSquares]);
  // Bklit parity: individualBarWidth = (bandWidth - gap*(n-1))/n; squares join the count.
  const groupBandwidth = useMemo(() => {
    const groupCount = totalSeriesCount > 0 ? totalSeriesCount : seriesCount;
    if (groupCount === 0) {return bandWidth;}
    const effectiveGroupGap = groupCount > 1 ? GROUP_GAP : 0;
    return (bandWidth - effectiveGroupGap * (groupCount - 1)) / groupCount;
  }, [bandWidth, seriesCount, totalSeriesCount]);

  // PaddingInner is derived so bandwidth() equals bklit's individualBarWidth exactly.
  const groupScale = useMemo<ScaleBand<string>>(() => {
    const groupCount = totalSeriesCount > 0 ? totalSeriesCount : seriesCount;
    const paddingInner = groupCount > 1 ? (groupCount * GROUP_GAP) / (bandWidth + GROUP_GAP) : 0;
    const domain = groupCount === totalSeriesCount && totalSeriesCount > 0 ? allSeriesKeys : resolvedSeries.map((series) => series.dataKey);
    return scaleBand()
      .domain(domain)
      .paddingInner(paddingInner)
      .paddingOuter(0);
  }, [resolvedSeries, seriesCount, totalSeriesCount, bandWidth, allSeriesKeys]);

  const categoryScaleForOverlay = useMemo<ScaleBand<string>>(() => 
    scaleBand()
      .domain(categoryOrder)
      .range([margin.left, margin.left + innerWidth])
      .padding(barGap)
  , [categoryOrder, margin.left, innerWidth, barGap]);

  const groupScaleForOverlay = useMemo<ScaleBand<string>>(() => 
    scaleBand()
      .domain(groupScale.domain())
      .paddingInner(groupScale.paddingInner())
      .paddingOuter(groupScale.paddingOuter())
      .range([0, bandWidth])
  , [groupScale, bandWidth]);

  // Bklit-parity band-index focus (floor((x-margin.left)/innerWidth*n)), not nearest-center.
  const getCategoryOrder = useCallback(() => categoryOrder, [categoryOrder]);
  const getInnerWidth = useCallback(() => innerWidth, [innerWidth]);
  const barFocusStrategy = useMemo(
    () =>
      createBarFocusStrategy({
        getCategoryOrder,
        getInnerWidth,
        marginLeft: margin.left,
        phaseRef,
      }),
    [getCategoryOrder, getInnerWidth, margin.left, phaseRef],
  );
  return {
    allSeriesKeys,
    bandWidth,
    barFocusStrategy,
    categoryAccessor,
    categoryOrder,
    categoryScaleForOverlay,
    dotSeriesList,
    groupBandwidth,
    groupScale,
    groupScaleForOverlay,
    hasBarColumnTrack,
    hasBarSquares,
    innerWidth,
    nicedDomainsByAxis,
    nicedPrimaryDomain,
    projectValue,
    resolvedBarColumnTracks,
    resolvedBarSquares,
    resolvedSeries,
    totalSeriesCount,
    xScaleFactory,
    yScale,
  };
};

export type { UseBarScalesOptions, UseBarScalesResult };
export { useBarScales };
