// Line layer inputs (V1.4): registry contributions merged with core math.
// Layer state lives in host computers and carriers; no layer imports here.
import { useMemo } from "react";
import type { ChartControl } from "@tanstack/charts";
import type { BrushRange } from "@tanstack/charts/interaction/brush";
import {
  DEFAULT_LINE_STROKE,
  EMPTY_BRUSH_CONTROLS,
  maxProjectionTailTime,
  scanRenderTimeExtent,
} from "./line-chart-support";
import { useSanitizedId } from "./use-sanitized-id";
import type { BrushChildConfig, ChartDatum, ExtractedChildren } from "./types";
import type { ChartChildRegistration, ChartLayerContribution } from "./chart-child-registry";
import type { MarkerGradientDef } from "./series-marker-mark";
import type { MarkerRevealSeriesConfig } from "./parity/animation";
import type { ProjectionLineConfig } from "./projection-config";

// Shared empty marker lookup: keeps the spec marks memo identical with no markers.
const NO_MARKER_GRADIENTS: Readonly<Map<string, string>> = new Map<string, string>();

interface LineLayerInputsParams {
  readonly idPrefix?: string;
  readonly lines: ExtractedChildren["lines"];
  readonly projectionConfigs: readonly ProjectionLineConfig[];
  readonly registryEntries: readonly ChartChildRegistration[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly xDomain: [Date, Date] | undefined;
}

interface LineLayerInputs {
  readonly brushConfig: BrushChildConfig | undefined;
  readonly brushControls: readonly ChartControl<Date, number>[];
  readonly brushRangeValue: BrushRange<Date> | undefined;
  readonly brushTrackExtent: [Date, Date] | undefined;
  readonly crosshairGradientId: string;
  readonly hasBrush: boolean;
  readonly markerGradientDefs: readonly MarkerGradientDef[];
  readonly markerGradientIdByKey: Readonly<Map<string, string>>;
  readonly markerSeriesConfigs: readonly MarkerRevealSeriesConfig[];
  readonly profitLossHoveredIndex: number | null;
  readonly timeExtent: Readonly<{ maxTime: number; minTime: number }> | undefined;
  readonly timeExtentRaw: Readonly<{ maxTime: number; minTime: number }> | undefined;
}

// Registry contributions merged here; fallbacks are the no-layer behavior.
const contributionFor = (entries: readonly ChartChildRegistration[], role: string): ChartLayerContribution | undefined =>
  entries.find((entry) => entry.role === role)?.contribution;

const useLineLayerInputs = (params: Readonly<LineLayerInputsParams>): LineLayerInputs => {
  const { idPrefix, lines, projectionConfigs, registryEntries, renderData, xDataKey, xDomain } = params;
  const brushContribution = contributionFor(registryEntries, "layer:brush")?.brush;
  const markerContribution = contributionFor(registryEntries, "layer:markers")?.markerGradients;
  // Scoped to the mount prefix so two LineCharts never share a gradient id.
  const crosshairFallbackId = useSanitizedId();
  const crosshairGradientId = idPrefix === undefined ? crosshairFallbackId : `${idPrefix}-crosshair`;
  const markerSeriesConfigs = useMemo(() => lines.map((line) => ({ dataKey: line.dataKey, markers: line.markers, showMarkers: line.showMarkers, stroke: line.stroke ?? DEFAULT_LINE_STROKE })), [lines]);
  const brushConfig = brushContribution?.config;
  const brushControls = brushContribution?.controls ?? EMPTY_BRUSH_CONTROLS;
  const brushRangeValue = brushContribution?.range;
  const brushTrackExtent = brushContribution?.trackExtent;
  const hasBrush = brushContribution !== undefined;
  const markerGradientIdByKey = markerContribution?.gradientIdByKey ?? NO_MARKER_GRADIENTS;
  const markerGradientDefs = markerContribution?.gradientDefs ?? [];
  const profitLossHoveredIndex = contributionFor(registryEntries, "profitLossLine")?.profitLossHoveredIndex ?? null;
  const timeExtentRaw = useMemo(() => {
    if (xDomain) {return { maxTime: xDomain[1].getTime(), minTime: xDomain[0].getTime() } as const;}
    return scanRenderTimeExtent(renderData, xDataKey);
  }, [renderData, xDataKey, xDomain]);
  // Rendered x-domain extends the data extent by the projection tail; xDomain skips the merge.
  const timeExtent = useMemo((): { maxTime: number; minTime: number } | undefined => {
    if (!timeExtentRaw) {return undefined;}
    if (xDomain) {return timeExtentRaw;}
    if (projectionConfigs.length === 0) {return timeExtentRaw;}
    const maxTime = maxProjectionTailTime(projectionConfigs, timeExtentRaw.maxTime);
    if (maxTime === timeExtentRaw.maxTime) {return timeExtentRaw;}
    return { maxTime, minTime: timeExtentRaw.minTime };
  }, [timeExtentRaw, projectionConfigs, xDomain]);
  return {
    brushConfig,
    brushControls,
    brushRangeValue,
    brushTrackExtent,
    crosshairGradientId,
    hasBrush,
    markerGradientDefs,
    markerGradientIdByKey,
    markerSeriesConfigs,
    profitLossHoveredIndex,
    timeExtent,
    timeExtentRaw,
  };
};

export { useLineLayerInputs };
export type { LineLayerInputs, LineLayerInputsParams };
