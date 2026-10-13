import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { ReadyStore } from "../kit/entrance/reveal-arm";
import type { GeoPermissibleObjects } from "d3-geo";
import type { CSSProperties, Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { EnterTransition } from "../kit/motion/phase";
import type { TransformMatrix } from "./zoom";

/** Properties of a GeoJSON feature. Other keys are allowed and passed through to your callbacks. */
interface ChoroplethFeatureProperties {
  /** Display name of the feature, used by the default tooltip. */
  readonly name?: string;
  /** Optional identifier of the feature. */
  readonly id?: string | number;
  readonly [key: string]: unknown;
}

/** A GeoJSON feature of the map, with `name` and `id` properties. */
type ChoroplethFeature = Feature<Geometry, ChoroplethFeatureProperties | null>;

interface Margin {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Props of `ChoroplethChart`. */
interface ChoroplethChartProps {
  /** GeoJSON `FeatureCollection` to draw, with one feature per region. Pass GeoJSON objects: TopoJSON is not read, so convert it first (for example with `topojson-client`'s `feature()`). */
  readonly data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  /**
   * Chart margins in pixels. Any side you omit keeps its default.
   * @default { top: 0, right: 0, bottom: 0, left: 0 }
   */
  readonly margin?: Partial<Margin>;
  /**
   * Duration of the enter animation in milliseconds.
   * @default 800
   */
  readonly animationDuration?: number;
  /**
   * Enter transition (a spring or a cubic-bezier tween), in seconds.
   * @default a tween of `animationDuration` on the reveal curve
   */
  readonly enterTransition?: EnterTransition;
  /**
   * Changing this value replays the enter animation.
   * @default ""
   */
  readonly revealSignature?: string;
  /**
   * Aspect ratio of the chart as "width / height".
   * @default "16 / 9"
   */
  readonly aspectRatio?: string;
  /** Projection scale of the Mercator projection. When omitted it follows the chart width. */
  readonly scale?: number;
  /**
   * Geographic center of the map as `[longitude, latitude]`.
   * @default [0, 20]
   */
  readonly center?: [number, number];
  /** Pixel offset of the projection center as `[x, y]`. When omitted the map is centered in the chart. */
  readonly translate?: [number, number];
  /**
   * Enable zoom and pan with the mouse wheel, pinch, and drag.
   * @default false
   */
  readonly zoomEnabled?: boolean;
  /**
   * Minimum zoom scale.
   * @default 0.5
   */
  readonly zoomMin?: number;
  /**
   * Maximum zoom scale.
   * @default 4
   */
  readonly zoomMax?: number;
  /**
   * Initial zoom transform.
   * @default the identity transform (no zoom, no pan)
   */
  readonly initialZoom?: TransformMatrix;
  /**
   * Additional class name for the chart container.
   * @default ""
   */
  readonly className?: string;
  /** `ChoroplethFeatureComponent`, `ChoroplethGraticule` and `ChoroplethTooltip` to configure the map, plus any elements that call `useChoropleth()` or `useChoroplethZoom()`. */
  readonly children: ReactNode;
  /**
   * Accessible label of the chart.
   * @default "Choropleth chart"
   */
  readonly ariaLabel?: string;
  /** Longer accessible description of the chart. */
  readonly ariaDescription?: string;
}

/** Props of `ChoroplethFeatureComponent`. */
interface ChoroplethFeatureProps {
  /**
   * Solid fill color for every feature. Takes precedence over `getFeatureColor`.
   * @default a cycle of the `--chart-scale-01` to `--chart-scale-05` variables, by feature index
   */
  readonly fill?: string;
  /**
   * Border color of the features.
   * @default "var(--bkm-background)"
   */
  readonly stroke?: string;
  /**
   * Border width of the features in pixels.
   * @default 0.5
   */
  readonly strokeWidth?: number;
  /**
   * Opacity of the other features while one is hovered or focused.
   * @default 0.4
   */
  readonly fadedOpacity?: number;
  /** Returns a fill color per feature. Used when `fill` is not set. */
  readonly getFeatureColor?: (feature: ChoroplethFeature, index: number) => string;
  /** Pattern definitions (SVG `<pattern>` elements) that features can reference by id through `getFeaturePattern`. */
  readonly patterns?: ReactNode;
  /** Returns the id of a pattern to fill a feature with, or `null`/`undefined` to use the color. A pattern wins over `fill` and `getFeatureColor`. */
  readonly getFeaturePattern?: (feature: ChoroplethFeature, index: number) => string | null | undefined;
}

/** Props of `ChoroplethTooltip`. */
interface ChoroplethTooltipProps {
  /** Custom tooltip content for a feature. Replaces the default name and value. */
  readonly content?: (props: { feature: ChoroplethFeature; index: number }) => ReactNode;
  /**
   * Formats the value in the default tooltip.
   * @default integer formatting
   */
  readonly formatValue?: (value: number) => string;
  /**
   * Returns the tooltip title of a feature.
   * @default the feature's `properties.name`, or "Feature <index>"
   */
  readonly getFeatureName?: (feature: ChoroplethFeature, index: number) => string;
  /** Returns the value shown for a feature. When it returns `undefined` the value row is hidden. */
  readonly getFeatureValue?: (feature: ChoroplethFeature, index: number) => number | undefined;
  /**
   * Label of the value row.
   * @default "Value"
   */
  readonly valueLabel?: string;
  /** Additional class name for the tooltip panel. */
  readonly className?: string;
  /** Inline styles for the tooltip panel, for example a blur or border. */
  readonly panelStyle?: CSSProperties;
  /** Background color of the tooltip panel (a CSS variable or a color). */
  readonly backgroundColor?: string;
}

/** Props of `ChoroplethGraticule`. */
interface ChoroplethGraticuleProps {
  /**
   * Color of the graticule lines.
   * @default "rgba(255,255,255,0.1)"
   */
  readonly stroke?: string;
  /**
   * Width of the graticule lines in pixels.
   * @default 0.5
   */
  readonly strokeWidth?: number;
  /**
   * Spacing of the lines as `[longitude, latitude]` in degrees.
   * @default [10, 10]
   */
  readonly step?: [number, number];
}

/** Tooltip anchor and feature while a tooltip is shown. */
interface ChoroplethTooltipData {
  /** Index of the hovered feature in `data.features`. */
  readonly featureIndex: number;
  /** Horizontal tooltip anchor, relative to the chart. */
  readonly x: number;
  /** Vertical tooltip anchor, relative to the chart. */
  readonly y: number;
  /** The hovered feature. */
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

/** Value returned by `useChoropleth()`. */
interface ChoroplethContextValue {
  /** The features of `data`. */
  readonly features: ChoroplethFeature[];
  /** The `data` passed to the chart. */
  readonly featureCollection: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  /** SVG path string per feature index at the current size and zoom (`null` where a feature has no path). */
  readonly featurePaths: readonly (string | null)[];
  /** Returns the SVG path of a feature, or `undefined`. */
  readonly pathGenerator: (feature: ChoroplethFeature) => string | undefined;
  /** Returns the SVG path of any GeoJSON object in the chart's projection, or `null`. */
  readonly rawPathGenerator: (geo: GeoPermissibleObjects) => string | null;
  /** Projects `[longitude, latitude]` to chart pixels, or `null` when it cannot be projected. */
  readonly projectPoint: (coords: [number, number]) => [number, number] | null;
  /** Converts chart pixels back to `[longitude, latitude]`, or `null`. */
  readonly unprojectPoint?: (point: [number, number]) => [number, number] | null;
  /** Chart width in pixels. */
  width: number;
  /** Chart height in pixels. */
  height: number;
  /** Width inside the margins. */
  readonly innerWidth: number;
  /** Height inside the margins. */
  readonly innerHeight: number;
  /** Resolved chart margins. */
  readonly margin: Margin;
  /** Ref to the chart container element. */
  readonly containerRef: RefObject<HTMLDivElement | null>;
  /** `true` once the enter animation has finished. */
  readonly isLoaded: boolean;
  /** Enter animation duration in milliseconds. */
  readonly animationDuration: number;
  /** The `enterTransition` prop of the chart, if set. */
  readonly enterTransition?: EnterTransition;
  /** Increments when the enter animation replays. */
  readonly revealEpoch: number;
  /** Index of the hovered or focused feature, or `null`. */
  readonly hoveredFeatureIndex: number | null;
  /** Hovers a feature by index; `null` clears it. */
  readonly setHoveredFeatureIndex: (index: number | null) => void;
  /** Tooltip anchor and feature while one is shown, otherwise `null`. */
  readonly tooltipData: ChoroplethTooltipData | null;
  /** Sets or updates the tooltip data (accepts a value or an updater function). */
  readonly setTooltipData: Dispatch<SetStateAction<ChoroplethTooltipData | null>>;
  /** Internal hover store used by `useChoropleth`; do not use it directly. */
  readonly hoverStore?: HoverStore;
  /** Internal store behind `isLoaded`; do not use it directly. */
  readonly readyStore?: ReadyStore;
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
