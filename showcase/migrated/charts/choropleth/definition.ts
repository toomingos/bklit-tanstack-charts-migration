import { defineChart } from "@tanstack/charts/scene";
import { geoShape } from "@tanstack/charts/geo";
import type { ChartBounds, DomChartDefinition } from "@tanstack/charts";
import { erase } from "../kit/cartesian/erased-types";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeoProjection } from "d3-geo";
import { bklitTooltip } from "../kit/tooltip/bklit-tooltip";
import { sizedTooltipPlacement } from "../kit/tooltip/sized-tooltip-placement";
import { TOOLTIP_MOTION, TOOLTIP_OFFSET } from "../kit/theme";
import type { createLayerMotion } from "./enter";
import { createGeoContainmentFocus } from "./focus";
import type { GeoGeometry, ProjectionHolder } from "./focus";
import { featureHighlightMark } from "./highlight";
import { FEATURES_ID, featureKey, GRATICULE_ID, graticuleFeature, HIGHLIGHT_ID, makeProjection, resolveFill } from "./projection";
import type { ProjectionOptions } from "./projection";
import { tooltipAnchor } from "./tooltip";
import type { ChoroplethFeature, ChoroplethFeatureProperties, ChoroplethFeatureProps, ChoroplethGraticuleProps, ChoroplethTooltipProps, Margin } from "./types";

interface DefinitionInput {
  readonly data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  readonly margin: Margin;
  readonly center: [number, number];
  readonly scale: number | undefined;
  readonly translate: [number, number] | undefined;
  readonly holder: ProjectionHolder;
  readonly geometry: GeoGeometry;
  readonly shown: boolean;
  readonly patternPrefix: string;
  readonly featureConfig: ChoroplethFeatureProps | undefined;
  readonly graticuleConfig: ChoroplethGraticuleProps | undefined;
  readonly tooltipConfig: ChoroplethTooltipProps | undefined;
  readonly layerMotion: ReturnType<typeof createLayerMotion>;
}

/** The chart definition: features geoShape, optional graticule layer, the hovered-feature guide mark and the built-in tooltip. */
export const createDefinition = (input: DefinitionInput): DomChartDefinition<ChoroplethFeature, number, number> => {
  const { data, margin, center, scale, translate, holder, geometry, shown, patternPrefix, featureConfig, graticuleConfig, tooltipConfig, layerMotion } = input;
  const projectionOptions: ProjectionOptions = { center, k: 1, scale, translate, tx: 0, ty: 0 };
  const projection = (context: { chart: ChartBounds }): GeoProjection => {
    holder.projection = makeProjection(context.chart, projectionOptions);
    holder.chart = context.chart;
    // Hit-test geometry is built with the projection (load), not on the first hover moves.
    geometry.warm(data.features);
    return holder.projection;
  };
  const stroke = featureConfig?.stroke ?? "var(--background)";
  const features = geoShape(data.features, {
    // Documented geo `className` hook (reference/marks/geo.md): the CSS selects the group by class.
    className: "bkm-choro-features",
    fill: (feature, context) => resolveFill(feature, context.index, featureConfig, patternPrefix),
    id: FEATURES_ID,
    key: featureKey,
    motion: layerMotion,
    opacity: shown ? 1 : 0,
    projection,
    stroke,
    strokeWidth: featureConfig?.strokeWidth ?? 0.5,
  });
  const graticule = graticuleConfig
    ? [geoShape([graticuleFeature(graticuleConfig.step)], {
        fill: "none",
        id: GRATICULE_ID,
        key: () => GRATICULE_ID,
        motion: layerMotion,
        projection,
        stroke: graticuleConfig.stroke ?? "rgba(255,255,255,0.1)",
        strokeWidth: graticuleConfig.strokeWidth ?? 0.5,
      })]
    : [];
  return erase(defineChart({
    focus: createGeoContainmentFocus<ChoroplethFeature>(FEATURES_ID, holder, geometry),
    focusRing: false,
    guides: false,
    margin,
    marks: [features, ...graticule, featureHighlightMark({ id: HIGHLIGHT_ID, markId: FEATURES_ID })],
    maxFocusDistance: 0,
    scales: { x: null, y: null },
    // `portal`: the native placement without the per-paint size read (gap #21, kit/tooltip/sized-tooltip-placement.ts).
    tooltip: tooltipConfig
      ? { anchor: tooltipAnchor(holder, geometry), className: "bkm-choro-tooltip", motion: TOOLTIP_MOTION, offset: TOOLTIP_OFFSET, placement: ["right", "left"], portal: sizedTooltipPlacement(), sticky: false, use: bklitTooltip }
      : false,
  }));
};
