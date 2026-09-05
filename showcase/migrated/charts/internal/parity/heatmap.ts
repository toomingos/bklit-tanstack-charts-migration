import type { Feature, Geometry } from "geojson";

type PatternPresetId =
  | "none"
  | "diagonal"
  | "horizontal"
  | "vertical"
  | "cross"
  | "dots"
  | "circles"
  | "accent";

type HeatmapLevelColors = readonly [string, string, string, string, string];

type HeatmapLevelFillMode = "solid" | "pattern";

interface HeatmapLevelStyle {
  color: string;
  fillMode?: HeatmapLevelFillMode;
  pattern?: PatternPresetId;
  patternColor?: string;
  patternScale?: number;
  patternStrokeWidth?: number;
  patternRadius?: number;
  patternComplement?: boolean;
  patternFill?: string;
  patternTileBackground?: string;
  patternOpacity?: number;
  patternDotsFill?: boolean;
}

type HeatmapLevelStyles = readonly [
  HeatmapLevelStyle,
  HeatmapLevelStyle,
  HeatmapLevelStyle,
  HeatmapLevelStyle,
  HeatmapLevelStyle,
];

interface ChoroplethFeatureProperties {
  name?: string;
  id?: string | number;
  [key: string]: unknown;
}

type ChoroplethFeature = Feature<Geometry, ChoroplethFeatureProperties>;

interface ChoroplethTooltipData {
  featureIndex: number;
  x: number;
  y: number;
  feature: ChoroplethFeature;
}

interface SankeyNodeDatum {
  name: string;
  category?: "source" | "landing" | "outcome";
  [key: string]: unknown;
}

interface SankeyLinkDatum {
  source: number;
  target: number;
  value: number;
  [key: string]: unknown;
}

interface SankeyTooltipData {
  type: "node" | "link";
  nodeIndex?: number;
  linkIndex?: number;
  x: number;
  y: number;
  data: SankeyNodeDatum | SankeyLinkDatum;
}

const levelColorsFromStyles = (
  levelStyles: HeatmapLevelStyles,
): HeatmapLevelColors => [
  levelStyles[0].color,
  levelStyles[1].color,
  levelStyles[2].color,
  levelStyles[3].color,
  levelStyles[4].color,
];

export { levelColorsFromStyles };
export type {
  ChoroplethTooltipData,
  SankeyLinkDatum,
  SankeyNodeDatum,
  SankeyTooltipData,
};
