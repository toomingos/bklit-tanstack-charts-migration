// Line-chart marker gradient state: series configs, defs, and id lookup.
import { useMemo } from "react";
import { useSanitizedId } from "./use-sanitized-id";
import { buildMarkerGradientDefs } from "./series-marker-mark";
import type { MarkerGradientDef } from "./series-marker-mark";
import type { MarkerRevealSeriesConfig } from "./line-marker-reveal";
import type { ExtractedChildren } from "./types";

interface LineMarkerGradients {
  readonly crosshairGradientId: string;
  readonly markerGradientBaseId: string;
  readonly markerGradientDefs: readonly MarkerGradientDef[];
  readonly markerGradientIdByKey: Readonly<Map<string, string>>;
  readonly markerSeriesConfigs: readonly Readonly<MarkerRevealSeriesConfig>[];
}

const useLineMarkerGradients = (params: Readonly<{ lines: ExtractedChildren["lines"]; defaultStroke: string }>): LineMarkerGradients => {
  const { defaultStroke, lines } = params;
  const markerGradientBaseId = useSanitizedId();
  const crosshairGradientId = useSanitizedId();
  const markerSeriesConfigs = useMemo(() => lines.map((line) => ({ dataKey: line.dataKey, markers: line.markers, showMarkers: line.showMarkers, stroke: line.stroke ?? defaultStroke })), [lines, defaultStroke]);
  const markerGradientDefs = useMemo(() => buildMarkerGradientDefs(markerSeriesConfigs, markerGradientBaseId), [markerSeriesConfigs, markerGradientBaseId]);
  const markerGradientIdByKey = useMemo(() => {
    const gradientIdByKey = new Map<string, string>();
    for (const def of markerGradientDefs) {gradientIdByKey.set(def.dataKey, def.id);}
    return gradientIdByKey;
  }, [markerGradientDefs]);
  return { crosshairGradientId, markerGradientBaseId, markerGradientDefs, markerGradientIdByKey, markerSeriesConfigs };
};

export { useLineMarkerGradients };
export type { LineMarkerGradients };
