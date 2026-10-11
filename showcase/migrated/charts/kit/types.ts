// Prop and config types for the native config-carrier children and the chart shells.
import type { CSSProperties, ReactNode } from "react";
import type { CurveFactory } from "d3-shape";
import type { LineConfig as ChartLineConfig } from "./cartesian/chart-context";
import type { PatternPresetId, PatternPresetOptions } from "./pattern/pattern-preset-helpers";
import type { LineLoadingPulseMode, LoadingStyle } from "./motion/phase";

export type { ChartPhase, ChartStatus, EnterTransition } from "./motion/phase";

export type ChartDatum = Record<string, unknown>;

type FadeEdges = boolean | "left" | "right";

export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
}

export interface SeriesPointMarkerStyle {
  readonly fill?: string;
  stroke?: string;
  strokeWidth?: number;
  readonly ringGap?: number;
  readonly outlineWidth?: number;
  readonly outlineColor?: string;
  readonly radius?: number;
  readonly fadeOnHover?: boolean;
  readonly inactiveOpacity?: number;
  readonly inactiveBlur?: number;
  readonly enterBlur?: number;
  readonly showActiveHighlight?: boolean;
}

export interface LineConfig {
  readonly dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  readonly curve?: CurveFactory;
  yAxisId?: string | number;
  readonly fadeEdges?: FadeEdges;
  showHighlight?: boolean;
  readonly showMarkers?: boolean;
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
  readonly dashFromIndex?: number;
  readonly dashArray?: string;
  readonly loadingStroke?: string;
  readonly loadingStrokeOpacity?: number;
  readonly animate?: boolean;
  /** Overlay the loading pulse on this series. `false` disables it. */
  readonly loading?: boolean;
  readonly loadingPulseMode?: LineLoadingPulseMode;
  readonly loadingStyle?: LoadingStyle;
  /** Called when a loop-mode pulse cycle completes. */
  readonly onLoadingPulseCycleComplete?: () => void;
}

export interface AreaConfig {
  readonly dataKey: string;
  stroke?: string;
  strokeWidth?: number;
  readonly fill?: string;
  readonly fillOpacity?: number;
  readonly curve?: CurveFactory;
  yAxisId?: string | number;
  readonly showLine?: boolean;
  readonly gradientToOpacity?: number;
  readonly gradientSpan?: number;
  readonly fadeEdges?: FadeEdges;
  readonly showMarkers?: boolean;
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
  showHighlight?: boolean;
  readonly dashFromIndex?: number;
  readonly dashArray?: string;
  /** Accepted for bklit parity; like `LineConfig.animate`, the native entrance already owns it. */
  readonly animate?: boolean;
  readonly loading?: boolean;
  readonly loadingStroke?: string;
  readonly loadingStrokeOpacity?: number;
  readonly loadingPulseMode?: LineLoadingPulseMode;
  readonly loadingStyle?: LoadingStyle;
}

export interface PatternAreaConfig {
  readonly dataKey: string;
  readonly patternPreset?: PatternPresetId;
  readonly patternColor?: string;
  readonly fill?: string;
  readonly curve?: CurveFactory;
  /** @deprecated No effect (bklit: the pattern fill is not clip-revealed; only the stroke `Area` animates). */
  readonly animate?: boolean;
}

export interface ScatterConfig {
  readonly dataKey: string;
  yAxisId?: string | number;
  readonly animate?: boolean;
  readonly fill?: string;
  stroke?: string;
  strokeWidth?: number;
  readonly ringGap?: number;
  readonly radius?: number;
  /** Overrides fill; ring follows unless stroke is set. */
  readonly yGradient?: boolean | Readonly<{ from?: string; to?: string }>;
  readonly fadeOnHover?: boolean;
  readonly inactiveOpacity?: number;
  readonly inactiveBlur?: number;
  readonly enterBlur?: number;
  readonly showActiveHighlight?: boolean;
  readonly outlineWidth?: number;
  readonly outlineColor?: string;
}

export interface XAxisConfig {
  readonly numTicks?: number;
  readonly tickerHalfWidth?: number;
  readonly tickMode?: "domain" | "data";
  readonly formatValue?: (value: Readonly<Date>) => string;
}

export interface YAxisConfig {
  yAxisId?: string | number;
  readonly orientation?: "left" | "right";
  readonly numTicks?: number;
  readonly formatLargeNumbers?: boolean;
  readonly formatValue?: (value: number) => string;
}

export interface GridProps {
  /** Show horizontal grid lines. Default: true */
  horizontal?: boolean;
  /** Show vertical grid lines. Default: false */
  vertical?: boolean;
  numTicksRows?: number;
  numTicksColumns?: number;
  /** Explicit tick values for horizontal grid lines. Overrides numTicksRows. */
  rowTickValues?: number[];
  stroke?: string;
  /** Grid stroke while loading chrome is active. Falls back to `stroke`. */
  loadingStroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  strokeDasharray?: string;
  /** Horizontal row values rendered with alternate styling (e.g. zero baseline). */
  highlightRowValues?: number[];
  highlightRowStroke?: string;
  highlightRowStrokeOpacity?: number;
  highlightRowStrokeWidth?: number;
  highlightRowStrokeDasharray?: string;
  fadeHorizontal?: boolean;
  fadeVertical?: boolean;
  hideHorizontalEdgeLines?: boolean;
  hideVerticalEdgeLines?: boolean;
  yAxisId?: string | number;
  shimmer?: boolean;
  shimmerStroke?: string;
  shimmerLength?: number;
  shimmerSpeed?: number;
  shimmerSync?: boolean;
}

export interface BackgroundConfig extends PatternPresetOptions {
  readonly pattern?: PatternPresetId;
  readonly color?: string;
  readonly showFill?: boolean;
  readonly opacity?: number;
  readonly fadeHorizontal?: boolean;
  readonly fadeVertical?: boolean;
  readonly fadeHorizontalLength?: number;
  readonly fadeVerticalLength?: number;
}

export interface ProjectionPoint {
  readonly date: Readonly<Date>;
  readonly value: number;
}

export type ProjectionStrokeStyle = "solid" | "gradient";

export interface ProjectionLineProps {
  data: readonly ProjectionPoint[];
  yAxisId?: string | number;
  stroke?: string;
  readonly strokeStyle?: ProjectionStrokeStyle;
  readonly gradientStart?: string;
  readonly gradientEnd?: string;
  strokeWidth?: number;
  readonly curveKind?: "linear" | "bezier";
  readonly curve?: CurveFactory;
  readonly strokeDasharray?: string;
  readonly strokeOpacity?: number;
  readonly showEndMarker?: boolean;
  /** @deprecated Use showEndMarker. */
  readonly showEndpoints?: boolean;
  readonly endpointRadius?: number;
  readonly className?: string;
}

/** One ProjectionLine child reduced to its y-scale group and points (bklit projection-config.ts:16). */
export interface ProjectionLineConfig {
  yAxisId: string;
  data: ProjectionPoint[];
}

export interface ProjectionLineEndMarkerProps {
  data: readonly ProjectionPoint[];
  yAxisId?: string | number;
  stroke?: string;
  readonly strokeOpacity?: number;
  readonly radius?: number;
}

// bklit line-series-terminal-marker.tsx:8 LineSeriesTerminalMarkerProps.
export interface LineSeriesTerminalMarkerProps {
  readonly dataKey: string;
  yAxisId?: string | number;
  readonly fill?: string;
  readonly radius?: number;
  readonly ringGap?: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface ProfitLossLineProps {
  readonly dataKey: string;
  readonly xDataKey?: string;
  strokeWidth?: number;
  readonly positiveColor?: string;
  readonly negativeColor?: string;
  readonly curve?: CurveFactory;
  readonly fadeEdges?: FadeEdges;
}

export interface ChartMarker {
  readonly date: Date;
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly content?: ReactNode;
  readonly color?: string;
  readonly onClick?: () => void;
  readonly href?: string;
  target?: "_blank" | "_self";
}

export interface ChartMarkersProps {
  readonly items: readonly Readonly<ChartMarker>[];
  readonly size?: number;
  readonly showLines?: boolean;
  readonly animate?: boolean;
  readonly maxFanned?: number;
}

/** bklit SeriesMarkers: point markers for the series with this `dataKey` (same as `showMarkers` + `markers` on its Line / Area). */
export interface SeriesMarkersProps extends SeriesPointMarkerStyle {
  readonly dataKey: string;
  readonly animate?: boolean;
}

/** bklit MarkerGroup. On a chart it is one ChartMarkers group at its markers' dates; the pixel-placement and portal props are accepted only. */
export interface MarkerGroupProps {
  readonly x?: number;
  readonly y?: number;
  readonly markers: readonly Readonly<ChartMarker>[];
  readonly isActive?: boolean;
  readonly size?: number;
  readonly onHover?: (markers: ChartMarker[] | null) => void;
  readonly containerRef?: unknown;
  readonly marginLeft?: number;
  readonly marginTop?: number;
  readonly animationDelay?: number;
  readonly animate?: boolean;
  readonly lineHeight?: number;
  readonly showLine?: boolean;
  readonly forceOpen?: boolean;
  /** Accepted, never read: no HTML scene node to size an icon into (UPSTREAM-GAPS #52). */
  readonly iconFill?: boolean;
  readonly borderColor?: string;
  readonly borderWidth?: number;
  readonly maxFanned?: number;
  readonly isMuted?: boolean;
}

export type IndicatorWidth = number | "line" | "thin" | "medium" | "thick";
export type IndicatorFadeEdges = "both" | "none" | "top" | "bottom";

export interface ChartTooltipProps {
  readonly showDatePill?: boolean;
  readonly showCrosshair?: boolean;
  readonly showDots?: boolean;
  readonly dotVariant?: "dot" | "ring";
  readonly dotSize?: number;
  readonly dotRadiusFraction?: number;
  readonly dotScale?: number;
  readonly dotStrokeWidth?: number;
  readonly indicatorColor?: string | ((point: Record<string, unknown>) => string);
  readonly content?: (props: { point: Record<string, unknown>; index: number }) => ReactNode;
  readonly rows?: (point: Record<string, unknown>) => { readonly color: string; readonly label: string; readonly value: string | number }[];
  readonly dotColor?: string | ((point: Record<string, unknown>, line: ChartLineConfig) => string);
  readonly children?: ReactNode;
  readonly className?: string;
  readonly springConfig?: SpringConfig;
  readonly matchCrosshair?: boolean;
  readonly damping?: number;
  readonly indicatorDasharray?: string;
  readonly indicatorFadeEdges?: IndicatorFadeEdges;
  readonly indicatorFadeLength?: number;
  readonly boxSpringConfig?: SpringConfig;
  readonly panelStyle?: CSSProperties;
  readonly backgroundColor?: string;
  readonly indicatorWidth?: IndicatorWidth;
  readonly columnWidth?: number;
}

/** Drag selection reported by `useChartInteraction`-style handlers. */
export interface ChartSelection {
  readonly startX: number;
  readonly endX: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly active: boolean;
}
