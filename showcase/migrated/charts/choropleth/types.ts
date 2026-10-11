import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeoPermissibleObjects } from "d3-geo";
import type { CSSProperties, Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { EnterTransition } from "../kit/motion/phase";
import type { TransformMatrix } from "./zoom";

// Open-ended GeoJSON property bag (only `name`/`id` are read).
interface ChoroplethFeatureProperties {
  readonly name?: string;
  readonly id?: string | number;
  readonly [key: string]: unknown;
}

type ChoroplethFeature = Feature<Geometry, ChoroplethFeatureProperties | null>;

interface Margin {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

interface ChoroplethChartProps {
  readonly data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  readonly margin?: Partial<Margin>;
  readonly animationDuration?: number;
  readonly enterTransition?: EnterTransition;
  readonly revealSignature?: string;
  readonly aspectRatio?: string;
  readonly scale?: number;
  readonly center?: [number, number];
  readonly translate?: [number, number];
  readonly zoomEnabled?: boolean;
  readonly zoomMin?: number;
  readonly zoomMax?: number;
  readonly initialZoom?: TransformMatrix;
  readonly className?: string;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

interface ChoroplethFeatureProps {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly fadedOpacity?: number;
  readonly getFeatureColor?: (feature: ChoroplethFeature, index: number) => string;
  readonly patterns?: ReactNode;
  readonly getFeaturePattern?: (feature: ChoroplethFeature, index: number) => string | null | undefined;
}

interface ChoroplethTooltipProps {
  readonly content?: (props: { feature: ChoroplethFeature; index: number }) => ReactNode;
  readonly formatValue?: (value: number) => string;
  readonly getFeatureName?: (feature: ChoroplethFeature, index: number) => string;
  readonly getFeatureValue?: (feature: ChoroplethFeature, index: number) => number | undefined;
  readonly valueLabel?: string;
  readonly className?: string;
  readonly panelStyle?: CSSProperties;
  readonly backgroundColor?: string;
}

interface ChoroplethGraticuleProps {
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly step?: [number, number];
}

interface ChoroplethTooltipData {
  readonly featureIndex: number;
  readonly x: number;
  readonly y: number;
  readonly feature: ChoroplethFeature;
}

// Hover mirror lives in an external store (no chart-level React state): only useChoropleth() consumers re-render on focus.
interface HoverStore {
  hovered: number | null;
  tooltip: ChoroplethTooltipData | null;
  version: number;
  readonly listeners: Set<() => void>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly set: (hovered: number | null, tooltip: ChoroplethTooltipData | null) => void;
}

interface ChoroplethContextValue {
  readonly features: ChoroplethFeature[];
  readonly featureCollection: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  readonly featurePaths: readonly (string | null)[];
  readonly pathGenerator: (feature: ChoroplethFeature) => string | undefined;
  readonly rawPathGenerator: (geo: GeoPermissibleObjects) => string | null;
  readonly projectPoint: (coords: [number, number]) => [number, number] | null;
  readonly unprojectPoint?: (point: [number, number]) => [number, number] | null;
  width: number;
  height: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly margin: Margin;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly isLoaded: boolean;
  readonly animationDuration: number;
  readonly enterTransition?: EnterTransition;
  readonly revealEpoch: number;
  readonly hoveredFeatureIndex: number | null;
  readonly setHoveredFeatureIndex: (index: number | null) => void;
  readonly tooltipData: ChoroplethTooltipData | null;
  readonly setTooltipData: Dispatch<SetStateAction<ChoroplethTooltipData | null>>;
  readonly hoverStore?: HoverStore;
}

export type {
  ChoroplethChartProps,
  ChoroplethContextValue,
  ChoroplethFeature,
  ChoroplethFeatureProperties,
  ChoroplethFeatureProps,
  ChoroplethGraticuleProps,
  ChoroplethTooltipData,
  ChoroplethTooltipProps,
  HoverStore,
  Margin,
};
