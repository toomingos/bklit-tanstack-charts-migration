// Bklit ChoroplethChart on TanStack geoShape; zoom rides projection params, not group transforms.
import React, { Children, createContext, createElement, isValidElement, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { NamedExoticComponent, ReactElement, ReactNode, RefObject } from 'react';
import { useEffectEvent } from './internal/use-effect-event';
import type { FeatureCollection,Feature,Geometry} from "geojson";
import { geoCentroid, geoMercator } from 'd3-geo';
import type { GeoPermissibleObjects, GeoProjection } from 'd3-geo';
import type { TransformMatrix, ProvidedZoom } from "./internal/choropleth-zoom-types";
import { ChoroplethZoom, identityMatrix } from "./internal/choropleth-zoom";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { ChartHost, HOST_INITIAL_WIDTH, adoptHostWidth } from "./internal/chart-host";
import { scopeResourceIds, scopedResourceId } from "./internal/resource-host";
import { useSanitizedId } from "./internal/use-sanitized-id";
import type {
  ChartMarkState,
  ChartPoint,
  ChartRendererRenderContext,
  ChartValue,
  StaticChartDefinition,
} from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import { geoShape as geoMark } from "@tanstack/charts/geo";
import { withStates } from "./internal/with-states";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { CHART_ROLE } from "./children";
import { roleOf } from "./internal/children-extract";
import { ChoroplethZoomValue } from "./internal/choropleth-zoom-context";
import { TS_CHART_SVG_SELECTOR, useChoroplethReveal } from "./internal/choropleth-reveal";
import { createChoroplethFocus } from "./internal/choropleth-focus";
import { useChoroplethZoomMotion } from "./internal/use-choropleth-zoom-motion";
import { useChoroplethPaths } from "./internal/use-choropleth-paths";
import { intFmt } from "./internal/formatters";
import { ChoroplethGraticuleOverlay } from "./internal/choropleth-graticule";
import type { ChoroplethGraticuleProps } from "./internal/choropleth-graticule-props";
import { findRevealRoot, isRevealed } from "./internal/deferred-reveal";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import type { EnterTransition } from './internal/enter-transition';
import "./styles.css";

// Open-ended GeoJSON property bag (legacy shape: unknown values; only `name`/`id` read).
interface ChoroplethFeatureProperties {
  readonly name?: string;
  readonly id?: string | number;
  readonly [key: string]: unknown;
}

type ChoroplethFeature = Feature<Geometry, ChoroplethFeatureProperties>;

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
  readonly panelStyle?: React.CSSProperties;
  readonly backgroundColor?: string;
}

// No featurePaths array: geoShape marks own the paths; pathGenerator serves callers that want them.
interface ChoroplethContextValue {
  readonly features: ChoroplethFeature[];
  readonly featureCollection: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  /** Precomputed SVG path strings — one per feature index. */
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
  readonly setTooltipData: React.Dispatch<React.SetStateAction<ChoroplethTooltipData | null>>;
}

interface ChoroplethTooltipData {
  readonly featureIndex: number;
  readonly x: number;
  readonly y: number;
  readonly feature: ChoroplethFeature;
}

const EMPTY_FEATURE_COLLECTION: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  features: [],
  type: "FeatureCollection",
};

const CHOROPLETH_CONTEXT_DEFAULT: ChoroplethContextValue = {
  animationDuration: 0,
  containerRef: { current: null },
  featureCollection: EMPTY_FEATURE_COLLECTION,
  featurePaths: [],
  features: [],
  height: 0,
  hoveredFeatureIndex: null,
  innerHeight: 0,
  innerWidth: 0,
  isLoaded: false,
  margin: { bottom: 0, left: 0, right: 0, top: 0 },
  // No-op default: returns no path string until a real generator is provided.
  pathGenerator: (): string | undefined => undefined,
  projectPoint: () => null,
  rawPathGenerator: () => null,
  revealEpoch: 0,
  setHoveredFeatureIndex: (): void => undefined,
  setTooltipData: (): void => undefined,
  tooltipData: null,
  unprojectPoint: () => null,
  width: 0,
};

const ChoroplethContext = createContext<ChoroplethContextValue>(CHOROPLETH_CONTEXT_DEFAULT);

const ChoroplethProvider = ({ children, value }: { readonly children: ReactNode; readonly value: ChoroplethContextValue }): ReactElement => (
  <ChoroplethContext.Provider value={value}>{children}</ChoroplethContext.Provider>
);

const useChoropleth = (): ChoroplethContextValue => useContext(ChoroplethContext)

const DEFAULT_CHOROPLETH_COLORS = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
];

const DEFAULT_MARGIN: Margin = { bottom: 0, left: 0, right: 0, top: 0 };

const DEFAULT_INITIAL_ZOOM: TransformMatrix = identityMatrix();

const ANIMATION_DURATION_MS = 800;
const CHOROPLETH_TOOLTIP_OFFSET = 16;

const RenderChoroplethFeature = (_props: Readonly<ChoroplethFeatureProps>): ReactElement => createElement("g");

const ChoroplethFeatureComponent: NamedExoticComponent<Readonly<ChoroplethFeatureProps>> = memo(RenderChoroplethFeature);
ChoroplethFeatureComponent.displayName = "ChoroplethFeature";
Object.defineProperty(ChoroplethFeatureComponent, CHART_ROLE, {
  configurable: true,
  enumerable: true,
  value: "choroplethFeature",
  writable: true,
});

const ChoroplethTooltip = (_props: Readonly<ChoroplethTooltipProps>): ReactElement | null => null;
Object.defineProperty(ChoroplethTooltip, CHART_ROLE, {
  configurable: true,
  enumerable: true,
  value: "choroplethTooltip",
  writable: true,
});
ChoroplethTooltip.displayName = "ChoroplethTooltip";

const RenderChoroplethGraticule = (_props: Readonly<ChoroplethGraticuleProps>): ReactElement => createElement("g");

const ChoroplethGraticule: NamedExoticComponent<Readonly<ChoroplethGraticuleProps>> = memo(RenderChoroplethGraticule);
ChoroplethGraticule.displayName = "ChoroplethGraticule";
Object.defineProperty(ChoroplethGraticule, CHART_ROLE, {
  configurable: true,
  enumerable: true,
  value: "choroplethGraticule",
  writable: true,
});

const resolveFeatureFill = (feature: ChoroplethFeature, index: number, featureConfig: Readonly<ChoroplethFeatureProps> | undefined): string => {
  const patternId = featureConfig?.getFeaturePattern?.(feature, index);
  const baseFillValue = featureConfig?.fill ?? "";
  if ((patternId ?? "").length > 0) {return `url(#${patternId})`;}
  if (baseFillValue.length > 0) {return baseFillValue;}
  if (featureConfig?.getFeatureColor) {return featureConfig.getFeatureColor(feature, index);}
  return DEFAULT_CHOROPLETH_COLORS[index % DEFAULT_CHOROPLETH_COLORS.length] ?? "var(--chart-1)";
}

const choroplethFeatureKey = (feature: Readonly<Pick<ChoroplethFeature, "properties" | "id">>): string => feature.properties.name ?? String(feature.id ?? "")

// Fraction (0-1) to color-mix percent scale for withAlpha.
const ALPHA_TO_PERCENT = 100;

// FillOpacity is per-call, not per-datum: base alpha bakes into fill/stroke via color-mix.
const withAlpha = (color: string, alphaPercent: number): string => {
  const pct = Math.max(0, Math.min(ALPHA_TO_PERCENT, alphaPercent));
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

// Default map center latitude (longitude 0 needs no name: it is exempt).
const DEFAULT_CENTER_LATITUDE = 20;
// Default map center (stable reference for the center prop default).
const DEFAULT_CENTER: [number, number] = [0, DEFAULT_CENTER_LATITUDE];
// Dimmed-feature opacity when another feature is hovered (bklit hover-chrome value).
const DEFAULT_FADED_OPACITY = 0.4;
// Scale calibration for the d3 mercator: base scale unit at the reference viewport width.
const CHOROPLETH_REFERENCE_WIDTH = 630;
const CHOROPLETH_BASE_SCALE = 100;
// Downward nudge of the default projection center (title/legend space).
const CHOROPLETH_TRANSLATE_Y_OFFSET = 50;
const DEFAULT_STROKE_WIDTH = 0.5;
// Swatch marker for the tooltip value row.
const TOOLTIP_SWATCH_STYLE = { backgroundColor: "var(--chart-1)" } as const;
// Graticule overlay svg floats above the map without intercepting pointer events.
const GRATICULE_LAYER_STYLE = { left: 0, pointerEvents: "none", position: "absolute", top: 0 } as const;
// Inner overlay container fills the sized body.
const CHOROPLETH_INNER_STYLE = { inset: 0, position: "absolute" } as const;

interface ExtractedConfig {
  readonly featureConfig: ChoroplethFeatureProps | undefined;
  readonly tooltipConfig: ChoroplethTooltipProps | undefined;
  readonly graticuleConfig: ChoroplethGraticuleProps | undefined;
  readonly overlayChildren: readonly ReactNode[];
}

interface FeaturePaintOptions {
  readonly featureConfig: ChoroplethFeatureProps | undefined;
  readonly baseOpacity: number;
}

interface FeaturePainters {
  readonly fill: (feature: ChoroplethFeature, context: { readonly index: number }) => string;
  readonly stroke: (feature: Readonly<Pick<ChoroplethFeature, "properties" | "id">>) => string;
}

const resolveChoroplethStroke = (featureConfig: Readonly<ChoroplethFeatureProps> | undefined): string =>
  featureConfig?.stroke ?? "var(--background)";

const makeFeaturePainters = (options: Readonly<FeaturePaintOptions>): FeaturePainters => {
  const { featureConfig, baseOpacity } = options;
  const baseAlpha = baseOpacity * ALPHA_TO_PERCENT;
  return {
    // Pattern fills can't alpha-blend: pattern-filled features keep the base paint (fidelity gap).
    fill: (feature: ChoroplethFeature, { index }: { readonly index: number }): string => {
      const resolved = resolveFeatureFill(feature, index, featureConfig);
      if ((featureConfig?.getFeaturePattern?.(feature, index) ?? "").length > 0) {return resolved;}
      return withAlpha(resolved, baseAlpha);
    },
    stroke: (): string => withAlpha(resolveChoroplethStroke(featureConfig), baseAlpha),
  };
};

interface ChoroplethFocusStatesOptions {
  readonly featureConfig: ChoroplethFeatureProps | undefined;
  readonly dimOpacity: number;
}

// Feature focus dim + focused highlight (I1 wrapper); pattern fills dim via opacity (D424 restore).
// Transition matches the geo term in styles.css (choropleth: 0.18s ease-out).
const choroplethFocusStates = (options: Readonly<ChoroplethFocusStatesOptions>): ChartMarkState<ChoroplethFeature>[] => {
  const { dimOpacity, featureConfig } = options;
  const isPatternFeature = (feature: ChoroplethFeature, index: number): boolean =>
    (featureConfig?.getFeaturePattern?.(feature, index) ?? "").length > 0;
  return [
    {
      style: {
        // Pattern fills skip the fill entry (url() paints can't alpha-blend).
        fill: (context): string => {
          if (isPatternFeature(context.datum, context.index)) {
            return resolveFeatureFill(context.datum, context.index, featureConfig);
          }
          return withAlpha(resolveFeatureFill(context.datum, context.index, featureConfig), dimOpacity * ALPHA_TO_PERCENT);
        },
        opacity: (context): number => (isPatternFeature(context.datum, context.index) ? dimOpacity : 1),
        stroke: (): string => withAlpha(resolveChoroplethStroke(featureConfig), dimOpacity * ALPHA_TO_PERCENT),
      },
      transition: { duration: 180, easing: "ease-out", type: "tween" },
      when: { focus: "unmatched" },
    },
    {
      style: {
        // Focused feature returns to full alpha (bklit hover-chrome hovered value).
        fill: (context): string => {
          if (isPatternFeature(context.datum, context.index)) {
            return resolveFeatureFill(context.datum, context.index, featureConfig);
          }
          return withAlpha(resolveFeatureFill(context.datum, context.index, featureConfig), ALPHA_TO_PERCENT);
        },
        stroke: (): string => withAlpha(resolveChoroplethStroke(featureConfig), ALPHA_TO_PERCENT),
      },
      transition: { duration: 180, easing: "ease-out", type: "tween" },
      when: { focus: "primary" },
    },
  ];
};

// MultiPolygon anchors use projectPoint(geoCentroid(feature)): path.centroid skews toward Alaska.
const choroplethTooltipAnchor = (projForMark: GeoProjection) =>
  (
    points: readonly ChartPoint<ChoroplethFeature>[],
  ): { x: number; y: number } | undefined => {
    const firstPoint = points.at(0);
    if (firstPoint === undefined) {return undefined;}
    const centroid = geoCentroid(firstPoint.datum);
    const projected =
      Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])
        ? projForMark(centroid)
        : undefined;
    return projected && Number.isFinite(projected[0]) && Number.isFinite(projected[1])
      ? { x: projected[0], y: projected[1] }
      : { x: firstPoint.x, y: firstPoint.y };
  };

interface ChoroplethDefinitionOptions {
  readonly data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  readonly width: number;
  readonly height: number;
  readonly projection: GeoProjection | undefined;
  readonly featureConfig: ChoroplethFeatureProps | undefined;
  readonly baseOpacity: number;
  readonly dimOpacity: number;
  readonly hasTooltipChild: boolean;
}

/*
 * Generics pinned explicitly: the mark infers number but the chart is driven with ChartValue,
 * so the return annotation states that once, where it is checked, instead of a cast.
 */
const buildChoroplethDefinition = (
  options: Readonly<ChoroplethDefinitionOptions>,
): StaticChartDefinition<ChoroplethFeature, ChartValue, ChartValue, "dom"> | undefined => {
  const { data, projection, featureConfig, baseOpacity, dimOpacity, hasTooltipChild } = options;
  // Width/height always arrive positive from host-owned sizing; only a missing projection blocks the definition.
  if (!projection) {return undefined;}
  const projForMark = projection;
  const painters = makeFeaturePainters({ baseOpacity, featureConfig });
  const chartDefinition = defineChart({
    // Package owns the pointer: the focus strategy resolves exact containment first.
    // Strategy-first resolution survives state repaints and motion presentation points.
    focus: createChoroplethFocus({ features: data.features, projection: projForMark }),
    focusRing: false,
    guides: false,
    margin: 0,
    marks: [
      withStates(geoMark(data.features, {
        fill: painters.fill,
        id: "choropleth",
        key: choroplethFeatureKey,
        // Native motion suppressed per-mark so the default enter fade never races the app-owned group fade.
        motion: false,
        projection: () => projForMark,
        stroke: painters.stroke,
        strokeOpacity: 1,
        strokeWidth: featureConfig?.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      }), data.features, choroplethFocusStates({ dimOpacity, featureConfig })),
    ],
    scales: { x: null, y: null },
    // Tooltip is instant-mount/instant-unmount (sticky/motion false), matching the retired box.
    tooltip: hasTooltipChild
      ? {
          anchor: choroplethTooltipAnchor(projForMark),
          className: "bkm-native-tooltip",
          motion: false,
          offset: CHOROPLETH_TOOLTIP_OFFSET,
          placement: ["right", "left"],
          sticky: false,
          use: tooltip,
        }
      : false,
  });
  return chartDefinition;
};

interface ChoroplethTooltipCardConfig {
  readonly backgroundColor: ChoroplethTooltipProps["backgroundColor"];
  readonly className: ChoroplethTooltipProps["className"];
  readonly content: ChoroplethTooltipProps["content"];
  readonly formatValue: (value: number) => string;
  readonly getFeatureName: ChoroplethTooltipProps["getFeatureName"];
  readonly getFeatureValue: ChoroplethTooltipProps["getFeatureValue"];
  readonly panelStyle: ChoroplethTooltipProps["panelStyle"];
  readonly valueLabel: string;
}

interface ChoroplethTooltipBodyContext {
  readonly defaultBody: ReactNode;
  readonly points: readonly ChartPoint<ChoroplethFeature>[];
}

const tooltipCardStyle = (cfg: Readonly<ChoroplethTooltipCardConfig>): React.CSSProperties => {
  const tooltipBackground = cfg.backgroundColor ?? "";
  const backgroundOverride = tooltipBackground.length > 0 ? { backgroundColor: tooltipBackground } : undefined;
  return {
    ...backgroundOverride,
    ...cfg.panelStyle,
  };
};

const renderCustomTooltipCard = (
  cfg: Readonly<ChoroplethTooltipCardConfig>,
  feature: ChoroplethFeature,
  index: number,
): ReactElement | undefined => {
  if (!cfg.content) {return undefined;}
  return (
    <div className="bkm-tooltip-panel" style={tooltipCardStyle(cfg)}>
      {cfg.content({ feature, index })}
    </div>
  );
};

const renderTooltipValueRow = (cfg: Readonly<ChoroplethTooltipCardConfig>, value: number): ReactElement => (
  <div className="bkm-tooltip-row">
    <div className="bkm-tooltip-row-label">
      <span className="bkm-tooltip-swatch" style={TOOLTIP_SWATCH_STYLE} />
      <span className="bkm-tooltip-series">{cfg.valueLabel}</span>
    </div>
    <span className="bkm-tooltip-value">{cfg.formatValue(value)}</span>
  </div>
);

const renderDefaultTooltipCard = (
  cfg: Readonly<ChoroplethTooltipCardConfig>,
  feature: ChoroplethFeature,
  index: number,
): ReactElement => {
  const name = cfg.getFeatureName
    ? cfg.getFeatureName(feature, index)
    : (feature.properties.name ?? `Feature ${index}`);
  const value = cfg.getFeatureValue?.(feature, index);
  return (
    <div
      className={(cfg.className ?? "").length > 0 ? `bkm-tooltip-panel ${cfg.className}` : "bkm-tooltip-panel"}
      style={tooltipCardStyle(cfg)}
    >
      <div className="bkm-tooltip-content">
        <div className="bkm-tooltip-title">{name}</div>
        {value === undefined ? undefined : (
          <div className="bkm-tooltip-rows">
            {renderTooltipValueRow(cfg, value)}
          </div>
        )}
      </div>
    </div>
  );
};

const renderFeatureTooltipCard = (
  cfg: Readonly<ChoroplethTooltipCardConfig>,
  feature: ChoroplethFeature,
  index: number,
): ReactNode => renderCustomTooltipCard(cfg, feature, index) ?? renderDefaultTooltipCard(cfg, feature, index);

const renderChoroplethTooltipBody = (
  ctx: Readonly<ChoroplethTooltipBodyContext>,
  getTooltipConfig: () => ChoroplethTooltipCardConfig | undefined,
): ReactNode => {
  const cfg = getTooltipConfig();
  if (!cfg) {return ctx.defaultBody;}
  const firstPoint = ctx.points.at(0);
  if (firstPoint === undefined) {return undefined;}
  return renderFeatureTooltipCard(cfg, firstPoint.datum, firstPoint.datumIndex);
};

const syncZoomContainer = (
  chartContainer: HTMLElement,
  zoom: ProvidedZoom<HTMLElement> | null,
  isDragging: boolean,
): void => {
  if (!zoom) {return;}
  // The zoom target is the host div (gestures bind the whole chart box, not just the svg).
  // The zoom plumbing is typed for HTMLElement so this assigns directly.
  zoom.containerRef.current = chartContainer;
  chartContainer.style.touchAction = "none";
  chartContainer.style.cursor = isDragging ? "grabbing" : "grab";
  chartContainer.style.contain = "layout style paint";
};

const resolveSurfaceSvg = (chartContainer: HTMLElement, surfaceElement: Element | undefined): SVGSVGElement | undefined => {
  // The surface element is typed as a plain Element; narrow to the svg with
  // Using instanceof narrows to the svg, falling back to a typed query, so no assertion is needed.
  if (surfaceElement instanceof SVGSVGElement) {return surfaceElement;}
  return chartContainer.querySelector<SVGSVGElement>(TS_CHART_SVG_SELECTOR) ?? undefined;
};

interface GraticuleLayerOptions {
  readonly graticuleConfig: ChoroplethGraticuleProps;
  readonly projection: GeoProjection;
  readonly width: number;
  readonly height: number;
}

const renderGraticuleLayer = (options: Readonly<GraticuleLayerOptions>): ReactElement => {
  const { graticuleConfig, projection, width, height } = options;
  return (
    <svg
      width={width}
      height={height}
      style={GRATICULE_LAYER_STYLE}
      aria-hidden="true"
    >
      <g>
        <ChoroplethGraticuleOverlay
          projection={projection}
          stroke={graticuleConfig.stroke}
          strokeWidth={graticuleConfig.strokeWidth}
          step={graticuleConfig.step}
        />
      </g>
    </svg>
  );
};

const extractChoroplethChildren = (children: ReactNode): ExtractedConfig => {
  let featureConfig: ChoroplethFeatureProps | undefined = undefined;
  let tooltipConfig: ChoroplethTooltipProps | undefined = undefined;
  let graticuleConfig: ChoroplethGraticuleProps | undefined = undefined;
  const overlayChildren: ReactNode[] = [];

  const visit = (node: ReactNode): void => {
    for (const child of Children.toArray(node)) {
      if (isValidElement(child)) {
        // The roleOf helper maps each child component type to its props contract, so pinning the
        // The isValidElement generic pinned to the role's config type recovers props without asserting.
        const role = roleOf(child.type);
        if (role === "choroplethFeature" && isValidElement<ChoroplethFeatureProps>(child)) {featureConfig = child.props;}
        else if (role === "choroplethTooltip" && isValidElement<ChoroplethTooltipProps>(child)) {tooltipConfig = child.props;}
        else if (role === "choroplethGraticule" && isValidElement<ChoroplethGraticuleProps>(child)) {graticuleConfig = child.props;}
        else {overlayChildren.push(child);}
      } else {overlayChildren.push(child);}
    }
  };
  visit(children);
  return { featureConfig, graticuleConfig, overlayChildren, tooltipConfig };
}

interface ChoroplethRevealInputs {
  readonly animationDuration: number;
  readonly revealSignature: string;
}

// Tooltip card config from the tooltip child (extracted to keep the body under max-statements).
const useChoroplethTooltipCard = (
  tooltipConfig: ChoroplethTooltipProps | undefined,
  hasTooltipChild: boolean,
): (() => ChoroplethTooltipCardConfig | undefined) => {
  const formatValue = tooltipConfig?.formatValue ?? intFmt;
  const tooltipContent = tooltipConfig?.content;
  const getFeatureName = tooltipConfig?.getFeatureName;
  const getFeatureValue = tooltipConfig?.getFeatureValue;
  const valueLabel = tooltipConfig?.valueLabel ?? "Value";
  return useCallback((): ChoroplethTooltipCardConfig | undefined => {
    if (!hasTooltipChild) {return undefined;}
    return {
      backgroundColor: tooltipConfig?.backgroundColor,
      className: tooltipConfig?.className,
      content: tooltipContent,
      formatValue,
      getFeatureName,
      getFeatureValue,
      panelStyle: tooltipConfig?.panelStyle,
      valueLabel,
    };
  }, [hasTooltipChild, tooltipContent, formatValue, getFeatureName, getFeatureValue, valueLabel, tooltipConfig]);
};


const ChoroplethChartBody = ({
  data,
  margin: marginProp,
  animationDuration = ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature = "",
  aspectRatio = "16 / 9",
  scale: scaleProp,
  center = DEFAULT_CENTER,
  translate: translateProp,
  zoomEnabled = false,
  zoomMin = 0.5,
  zoomMax = 4,
  initialZoom = DEFAULT_INITIAL_ZOOM,
  children,
  width,
  height,
  adoptWidth,
  ariaLabel = "Choropleth chart",
  ariaDescription,
}: ChoroplethChartProps & { width: number; height: number; adoptWidth: (sceneWidth: number | undefined) => void }): ReactElement => {
  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const ratio = useMemo(() => parseAspectRatio(aspectRatio), [aspectRatio]);

  const { featureConfig, tooltipConfig, graticuleConfig, overlayChildren } =
    useMemo(() => extractChoroplethChildren(children), [children]);
  // One prefix per mount scopes renderer ids and seam ids alike.
  const idPrefix = useSanitizedId();
  // Consumer pattern ids resolve against the seam-scoped def id (D548 ruling 2).
  const scopedFeatureConfig = useMemo((): ChoroplethFeatureProps | undefined => {
    const getFeaturePattern = featureConfig?.getFeaturePattern;
    if (featureConfig === undefined || getFeaturePattern === undefined) {return featureConfig;}
    return {
      ...featureConfig,
      getFeaturePattern: (feature: ChoroplethFeature, index: number): string | null | undefined => {
        const patternId = getFeaturePattern(feature, index);
        return patternId === null || patternId === undefined || patternId === "" ? patternId : scopedResourceId(idPrefix, patternId);
      },
    };
  }, [featureConfig, idPrefix]);

  const dimOpacity = featureConfig?.fadedOpacity ?? DEFAULT_FADED_OPACITY;
  const baseOpacity = 0.85;
  const hasTooltipChild = Boolean(tooltipConfig);

  const zoomRefForChrome = useRef<ProvidedZoom<HTMLElement> | null>(null);

  // Zoom-motion state plus the per-frame tick; hook owns the contiguous group below.
  const { displayMatrix, getIsDragging, onZoomTick, setRefreshTooltipAnchor } =
    useChoroplethZoomMotion({ initialZoom });

  const projection = useMemo((): GeoProjection => {
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const baseScale = scaleProp ?? (innerW > 0 ? (innerW / CHOROPLETH_REFERENCE_WIDTH) * CHOROPLETH_BASE_SCALE : CHOROPLETH_BASE_SCALE);
    const baseTranslate: [number, number] = translateProp ?? [
      innerW / 2 + margin.left,
      innerH / 2 + margin.top + CHOROPLETH_TRANSLATE_Y_OFFSET,
    ];
    // Composition stays exact only for skew-free, uniform-scale matrices (the only shape gestures produce).
    const currentMatrix = displayMatrix;
    return geoMercator()
      .center(center)
      .scale(baseScale * currentMatrix.scaleX)
      .translate([
        currentMatrix.scaleX * baseTranslate[0] + currentMatrix.translateX,
        currentMatrix.scaleY * baseTranslate[1] + currentMatrix.translateY,
      ]);
  }, [width, height, margin, scaleProp, center, translateProp, displayMatrix]);

  // IsLoaded/revealEpoch exist for useChoropleth() lifecycle parity; the reveal itself is WAAPI.
  // Epoch counts reveal cycles including the initial mount, so it starts at 1.
  const [prevRevealInputs, setPrevRevealInputs] = useState<ChoroplethRevealInputs>({ animationDuration, revealSignature });
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(1);
  // Render-time adjustment: new reveal inputs re-arm the cycle instead of syncing state in the effect below.
  if (prevRevealInputs.animationDuration !== animationDuration || prevRevealInputs.revealSignature !== revealSignature) {
    setPrevRevealInputs({ animationDuration, revealSignature });
    setRevealEpoch((epoch) => epoch + 1);
    setIsLoaded(false);
  }
  useEffect(() => {
    const timeout = setTimeout((): void =>{  setIsLoaded(true); }, animationDuration);
    return (): void =>{  clearTimeout(timeout); };
  }, [animationDuration, revealEpoch]);

  // Path generators plus project/unproject; hook owns the contiguous group below.
  const { pathGenerator, projectPoint, rawPathGenerator, unprojectPoint } = useChoroplethPaths({ projection });

  const definition = useMemo<
    StaticChartDefinition<ChoroplethFeature, ChartValue, ChartValue, "dom"> | undefined
  >(() => buildChoroplethDefinition({
    baseOpacity,
    data,
    dimOpacity,
    featureConfig: scopedFeatureConfig,
    hasTooltipChild,
    height,
    projection,
    width,
  }), [
    baseOpacity, data, dimOpacity, scopedFeatureConfig, hasTooltipChild, height, projection, width,
  ]);

  const renderContextRef = useRef<Pick<
    ChartRendererRenderContext<ChoroplethFeature>,
    "scene" | "interaction"
  > | null>(null);
  // Package-owned focus key mirror for the zoom anchor refresh; written from the host callback below.
  const focusedKeyRef = useRef<string | null>(null);

  const getTooltipConfig = useChoroplethTooltipCard(tooltipConfig, hasTooltipChild);

// Package owns hover; the host callback only mirrors the focused key for the zoom anchor refresh.
  const [hoveredFeatureIndex, setHoveredFeatureIndexState] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<ChoroplethTooltipData | null>(null);
  const handleFocusChange = useCallback((point: ChartPoint<ChoroplethFeature> | null) => {
    focusedKeyRef.current = point?.key ?? null;
    if (point === null) {
      setHoveredFeatureIndexState(null);
      setTooltipData(null);
      return;
    }
    setHoveredFeatureIndexState(point.datumIndex);
    setTooltipData({ feature: point.datum, featureIndex: point.datumIndex, x: point.x, y: point.y });
  }, []);

  const setHoveredFeatureIndex = useCallback((index: number | null): void => {
    setHoveredFeatureIndexState(index);
    if (index === null) {return;}
    const ctx = renderContextRef.current;
    const candidate = ctx?.scene.points.find((point) => point.datumIndex === index);
    if (candidate && ctx) {ctx.interaction.setControlledFocus(candidate, { source: "programmatic" });}
  }, []);

  const reveal = useChoroplethReveal({ animationDuration, enterTransition, revealSignature });

  const refreshTooltipAnchor = useCallback(() => {
    const ctx = renderContextRef.current;
    const key = focusedKeyRef.current;
    if (!ctx || key === null) {return;}
    const candidate = ctx.scene.points.find((point: Readonly<Pick<ChartPoint<ChoroplethFeature>, "key">>) => point.key === key);
    if (!candidate) {return;}
    ctx.interaction.setControlledFocus(candidate, { source: "programmatic" });
  }, []);
  // Latest-callback sync runs post-commit so the render body stays pure.
  useEffect(() => {
    setRefreshTooltipAnchor(refreshTooltipAnchor);
  }, [refreshTooltipAnchor, setRefreshTooltipAnchor]);

  const { maybeStartReveal: startReveal } = reveal;
  const handleRender = useCallback((
    context: { container: HTMLElement } & Partial<
      Pick<ChartRendererRenderContext<ChoroplethFeature>, "scene" | "interaction" | "surface">
    >,
  ) => {
    adoptWidth(context.scene?.width);
    const { container, scene, interaction, surface } = context;
    if (scene && interaction) {renderContextRef.current = { interaction, scene };}
    const chartContainer = container;
    const svg = resolveSurfaceSvg(chartContainer, surface?.element);
    syncZoomContainer(chartContainer, zoomRefForChrome.current, getIsDragging());
    startReveal(chartContainer, svg);
  }, [adoptWidth, startReveal, getIsDragging]);

  const containerRefForFallback = useRef<HTMLDivElement | null>(null);
  const handleFallbackRef = useCallback((el: HTMLDivElement | null): void => {
    containerRefForFallback.current = el;
  }, []);
  const handleTooltipBody = useCallback(
    (ctx: ChartTooltipBodyRenderContext<ChoroplethFeature>): ReactNode =>
      renderChoroplethTooltipBody(ctx, getTooltipConfig),
    [getTooltipConfig],
  );
  const revealHasRevealed = reveal.hasRevealed;
  /*
   * Fallback replay reads through an effect event so the layout subscription stays stable
   * across render identity changes (latest reveal still observed at replay time).
   */
  const replayRenderEvent = useEffectEvent((fallbackContainer: HTMLDivElement): void => {
    handleRender({ container: fallbackContainer });
  });
  useLayoutEffect((): (() => void) | undefined => {
    if (revealHasRevealed()) {return undefined;}
    if (animationDuration <= 0) {return undefined;}
    const fallbackContainer = containerRefForFallback.current;
    if (!fallbackContainer) {return undefined;}
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (revealHasRevealed()) {return;}
        if (!fallbackContainer.querySelector(".ts-chart__marks")) {return;}
        if (isRevealed(findRevealRoot(fallbackContainer, TS_CHART_SVG_SELECTOR))) {return;}
        if (fallbackContainer.getAnimations().length > 0) {return;}
        replayRenderEvent(fallbackContainer);
      });
    });
    return (): void =>{  cancelAnimationFrame(raf); };
  }, [animationDuration, revealHasRevealed]);

  // Patterns arrive as conditional JSX, so false and null mean absent just like undefined.
  // Consumer ids enter the seam mount-scoped (D548 ruling 2).
  const choroplethPatterns = scopeResourceIds(featureConfig?.patterns, idPrefix);
  const chartNode = (
    <>
      {definition ? (
        <ChartHost
          renderer={chartMotionRenderer<ChoroplethFeature>()}
          ariaLabel={ariaLabel}
          ariaDescription={ariaDescription}
          aspectRatio={ratio}
          idPrefix={idPrefix}
          initialWidth={HOST_INITIAL_WIDTH}
          definition={definition}
          resources={choroplethPatterns}
          onFocusChange={handleFocusChange}
          onRender={handleRender}
          renderTooltipBody={handleTooltipBody}
        />
      ) : undefined}
      {graticuleConfig ? renderGraticuleLayer({ graticuleConfig, height, projection, width }) : undefined}
    </>
  );

  const choroplethContextValue = useMemo<ChoroplethContextValue>(
    () => ({
      animationDuration,
      containerRef: containerRefForFallback,
      enterTransition,
      featureCollection: data,
      featurePaths: data.features.map((feature) => rawPathGenerator(feature)),
      features: data.features,
      height,
      hoveredFeatureIndex,
      innerHeight: Math.max(0, height - margin.top - margin.bottom),
      innerWidth: Math.max(0, width - margin.left - margin.right),
      isLoaded,
      margin,
      pathGenerator,
      projectPoint,
      rawPathGenerator,
      revealEpoch,
      setHoveredFeatureIndex,
      setTooltipData,
      tooltipData,
      unprojectPoint,
      width,
    }),
    [
      data, pathGenerator, rawPathGenerator, projectPoint, unprojectPoint,
      width, height, margin, isLoaded, animationDuration,
      enterTransition, revealEpoch, hoveredFeatureIndex, setHoveredFeatureIndex, tooltipData,
    ],
  );

  const inner = (
    <div
      ref={handleFallbackRef}
      style={CHOROPLETH_INNER_STYLE}
    >
      {chartNode}
      {overlayChildren}
    </div>
  );

  if (!zoomEnabled) {
    return (
      <ChoroplethContext.Provider value={choroplethContextValue}>
        {inner}
      </ChoroplethContext.Provider>
    );
  }

  return (
    <ChoroplethZoom
      height={height}
      width={width}
      initialTransformMatrix={initialZoom}
      zoomMin={zoomMin}
      zoomMax={zoomMax}
      onZoomTick={onZoomTick}
    >
      {(zoom) => {
        zoomRefForChrome.current = zoom;
        return (
          <ChoroplethZoomValue zoom={zoom}>
            <ChoroplethContext.Provider value={choroplethContextValue}>
              {inner}
            </ChoroplethContext.Provider>
          </ChoroplethZoomValue>
        );
      }}
    </ChoroplethZoom>
  );
}


interface SizedBodyOptions {
  readonly adoptWidth: (sceneWidth: number | undefined) => void;
  readonly data: ChoroplethChartProps["data"];
  readonly margin: Margin;
  readonly animationDuration: number;
  readonly enterTransition: EnterTransition | undefined;
  readonly revealSignature: string;
  readonly aspectRatio: string;
  readonly scaleProp: number | undefined;
  readonly center: [number, number];
  readonly translateProp: [number, number] | undefined;
  readonly zoomEnabled: boolean;
  readonly zoomMin: number;
  readonly zoomMax: number;
  readonly initialZoom: TransformMatrix;
  readonly width: number;
  readonly ratio: number;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const renderSizedBody = (options: Readonly<SizedBodyOptions>): ReactElement => {
  const { width } = options;
  // Width always arrives positive from host-owned sizing.
  const height = Math.max(0, width / options.ratio);
  return (
    <ChoroplethChartBody
      adoptWidth={options.adoptWidth}
      data={options.data}
      margin={options.margin}
      animationDuration={options.animationDuration}
      enterTransition={options.enterTransition}
      revealSignature={options.revealSignature}
      aspectRatio={options.aspectRatio}
      scale={options.scaleProp}
      center={options.center}
      translate={options.translateProp}
      zoomEnabled={options.zoomEnabled}
      zoomMin={options.zoomMin}
      zoomMax={options.zoomMax}
      initialZoom={options.initialZoom}
      width={width}
      height={height}
      ariaLabel={options.ariaLabel}
      ariaDescription={options.ariaDescription}
    >
      {options.children}
    </ChoroplethChartBody>
  );
};


// Container sizing (host-owned width probe plus the aspect-locked wrapper style) as one unit.
interface ChoroplethContainerSizing {
  readonly adoptWidth: (sceneWidth: number | undefined) => void;
  readonly containerStyle: React.CSSProperties;
  readonly width: number;
}

const useChoroplethContainerSizing = (ratio: number): ChoroplethContainerSizing => {
  // Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const adoptWidth = useCallback((sceneWidth: number | undefined): void => {
    adoptHostWidth(setLiveWidth, sceneWidth);
  }, []);
  const containerStyle = useMemo(() => ({ aspectRatio: String(ratio), overflow: "hidden", position: "relative", width: "100%" }) as const, [ratio]);
  return { adoptWidth, containerStyle, width: liveWidth };
};

const ChoroplethChart = ({
  data,
  margin: marginProp,
  animationDuration = ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature = "",
  aspectRatio = "16 / 9",
  scale: scaleProp,
  center = DEFAULT_CENTER,
  translate: translateProp,
  zoomEnabled = false,
  zoomMin = 0.5,
  zoomMax = 4,
  initialZoom = DEFAULT_INITIAL_ZOOM,
  className = "",
  children,
  ariaLabel,
  ariaDescription,
}: ChoroplethChartProps): ReactElement => {
  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const ratio = useMemo(() => parseAspectRatio(aspectRatio), [aspectRatio]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { adoptWidth, containerStyle, width } = useChoroplethContainerSizing(ratio);

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-bkm-chart="choropleth"
    >
      {renderSizedBody({
        adoptWidth,
        animationDuration,
        ariaDescription,
        ariaLabel,
        aspectRatio,
        center,
        children,
        data,
        enterTransition,
        initialZoom,
        margin,
        ratio,
        revealSignature,
        scaleProp,
        translateProp,
        width,
        zoomEnabled,
        zoomMax,
        zoomMin,
      })}
    </div>
  );
}

ChoroplethChart.displayName = "ChoroplethChart";

export type { TransformMatrix } from "./internal/choropleth-zoom-types";
export { ChoroplethZoomContext, useChoroplethZoom } from "./internal/choropleth-zoom-context";
export type { ChoroplethZoomContextValue, ChoroplethZoomInstance } from "./internal/choropleth-zoom-context";
export {
  ChoroplethChart,
  ChoroplethFeatureComponent,
  ChoroplethGraticule,
  ChoroplethProvider,
  ChoroplethTooltip,
  useChoropleth,
};
export type {
  ChoroplethChartProps,
  ChoroplethContextValue,
  ChoroplethFeature,
  ChoroplethFeatureProperties,
  ChoroplethFeatureProps,
  ChoroplethTooltipData,
  ChoroplethTooltipProps,
  Margin,
};
export type { ChoroplethGraticuleProps } from "./internal/choropleth-graticule-props";
