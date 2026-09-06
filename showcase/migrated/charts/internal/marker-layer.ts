// Series-marker layer (V1.4): gradient defs and id lookup for showMarkers lines.
// Host-mounted only then; absent markers fall back to solid fill.
"use client";

import { useMemo } from "react";
import { useChartChild } from "./use-chart-child";
import { useSanitizedId } from "./use-sanitized-id";
import { buildMarkerGradientDefs } from "./series-marker-mark";
import { DEFAULT_LINE_STROKE } from "./line-chart-support";
import type { ExtractedChildren } from "./types";

interface MarkerLayerProps {
  readonly lines: ExtractedChildren["lines"];
}

const MarkerLayer = (properties: Readonly<MarkerLayerProps>): null => {
  const { lines } = properties;
  // Dispatcher presence-gates this; destructuring keeps carrier props valid.
  const [firstLine] = lines;
  const markerGradientBaseId = useSanitizedId();
  const markerSeriesConfigs = useMemo(() => lines.map((line) => ({ dataKey: line.dataKey, markers: line.markers, showMarkers: line.showMarkers, stroke: line.stroke ?? DEFAULT_LINE_STROKE })), [lines]);
  const markerGradientDefs = useMemo(() => buildMarkerGradientDefs(markerSeriesConfigs, markerGradientBaseId), [markerSeriesConfigs, markerGradientBaseId]);
  const markerGradientIdByKey = useMemo(() => {
    const gradientIdByKey = new Map<string, string>();
    for (const def of markerGradientDefs) {gradientIdByKey.set(def.dataKey, def.id);}
    return gradientIdByKey;
  }, [markerGradientDefs]);
  const contribution = useMemo(() => ({
    markerGradients: {
      gradientDefs: markerGradientDefs,
      gradientIdByKey: markerGradientIdByKey,
    },
  } as const), [markerGradientDefs, markerGradientIdByKey]);
  useChartChild("layer:markers", firstLine, contribution);
  return null;
};

export { MarkerLayer };
