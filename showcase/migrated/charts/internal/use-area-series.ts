// Area series hook: contiguous series/render-model group from area-chart.tsx.
// Hook call order is unchanged; logic moved verbatim.
import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./decimate";
import { buildMarkerGradientDefs } from "./series-marker-mark";
import type { MarkerGradientDef, MarkerSeriesConfig } from "./series-marker-mark";
import { useSanitizedId } from "./use-sanitized-id";
import { DISCRETE_INTERACTION_THRESHOLD } from "./design-tokens";
import type { ChartDatum, ExtractedChildren } from "./types";
import {
  buildPatternAreaDefs,
  buildPatternIdMap,
  resolvePatternAreas,
  resolveResolvedAreas,
} from "./area-chart-model";
import type {
  AreaPatternDef,
  ResolvedArea,
  ResolvedPatternArea,
} from "./area-chart-model";
import type { AreaLabelFade } from "./area-chart-definition";

interface AreaSeriesParams {
  readonly areas: ExtractedChildren["areas"];
  readonly data: ChartDatum[];
  readonly idPrefix?: string;
  readonly innerWidth: number;
  readonly patternAreas: ExtractedChildren["patternAreas"];
}

interface AreaSeries {
  readonly areaMarkerConfigs: MarkerSeriesConfig[];
  readonly areaMarkerGradientDefs: MarkerGradientDef[];
  readonly areaMarkerGradientIdByKey: Map<string, string>;
  readonly crosshairGradientId: string;
  readonly hoveredIndex: number | undefined;
  readonly isDiscrete: boolean;
  readonly labelFade: AreaLabelFade | undefined;
  readonly patternDefs: AreaPatternDef[];
  readonly patternIdByKey: Map<string, string>;
  readonly renderData: readonly ChartDatum[];
  readonly resolvedAreas: ResolvedArea[];
  readonly resolvedPatternAreas: ResolvedPatternArea[];
  readonly setHoveredIndex: Dispatch<SetStateAction<number | undefined>>;
  readonly setLabelFade: Dispatch<SetStateAction<AreaLabelFade | undefined>>;
}

const useAreaSeries = (params: Readonly<AreaSeriesParams>): AreaSeries => {
  const { areas, data, idPrefix, innerWidth, patternAreas } = params;
  const resolvedAreas = useMemo<ResolvedArea[]>(
    () => resolveResolvedAreas(areas),
    [areas],
  );

  const resolvedPatternAreas = useMemo<ResolvedPatternArea[]>(
    () => resolvePatternAreas(patternAreas),
    [patternAreas],
  );
  // All consumer-visible ids derive from the mount prefix when the entry provides one.
  const seriesFallbackId = useSanitizedId();
  const seriesBaseId = idPrefix ?? seriesFallbackId;
  const patternBaseId = `${seriesBaseId}-pattern`;
  const patternDefs = useMemo(
    () => buildPatternAreaDefs(resolvedPatternAreas, patternBaseId),
    [resolvedPatternAreas, patternBaseId],
  );
  const patternIdByKey = useMemo(() => buildPatternIdMap(patternDefs), [patternDefs]);

  const renderData = useMemo(() => {
    if (innerWidth <= 0) {return data;}
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      [...resolvedAreas.map((area: Readonly<ResolvedArea>) => area.dataKey), ...resolvedPatternAreas.map((patternArea: Readonly<ResolvedPatternArea>) => patternArea.dataKey)],
    );
  }, [data, innerWidth, resolvedAreas, resolvedPatternAreas]);
  // Dense data snaps instead of springing (bklit pointCount gate).
  const isDiscrete = renderData.length > DISCRETE_INTERACTION_THRESHOLD;
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
  const [labelFade, setLabelFade] = useState<AreaLabelFade | undefined>();
  const crosshairGradientId = `${seriesBaseId}-crosshair`;

  const areaMarkerBaseId = `${seriesBaseId}-marker`;
  const areaMarkerConfigs = useMemo<MarkerSeriesConfig[]>(() => resolvedAreas.map((area: Readonly<ResolvedArea>) => ({ dataKey: area.dataKey, markers: area.markers, showMarkers: area.showMarkers, stroke: area.stroke })), [resolvedAreas]);
  const areaMarkerGradientDefs = useMemo(() => buildMarkerGradientDefs(areaMarkerConfigs, areaMarkerBaseId), [areaMarkerConfigs, areaMarkerBaseId]);
  const areaMarkerGradientIdByKey = useMemo(() => {
    const idByKey = new Map<string, string>();
    for (const gradientDef of areaMarkerGradientDefs) {idByKey.set(gradientDef.dataKey, gradientDef.id);}
    return idByKey;
  }, [areaMarkerGradientDefs]);

  return {
    areaMarkerConfigs,
    areaMarkerGradientDefs,
    areaMarkerGradientIdByKey,
    crosshairGradientId,
    hoveredIndex,
    isDiscrete,
    labelFade,
    patternDefs,
    patternIdByKey,
    renderData,
    resolvedAreas,
    resolvedPatternAreas,
    setHoveredIndex,
    setLabelFade,
  };
};

export { useAreaSeries };
export type { AreaSeries, AreaSeriesParams };
