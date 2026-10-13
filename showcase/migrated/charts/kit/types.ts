// Prop and config types for the native config-carrier children and the chart shells.
import type { CSSProperties, ReactNode } from "react";
import type { CurveFactory } from "d3-shape";
import type { LineConfig as ChartLineConfig } from "./cartesian/chart-context";
import type { PatternPresetId, PatternPresetOptions } from "./pattern/pattern-preset-helpers";
import type { LineLoadingPulseMode, LoadingStyle } from "./motion/phase";

export type { ChartPhase, ChartStatus, EnterTransition } from "./motion/phase";

export type ChartDatum = Record<string, unknown>;

type FadeEdges = boolean | "left" | "right";

/** Spring parameters (stiffness and damping) used by the tooltip and highlight springs in `ChartConfigValue`. */
export interface SpringConfig {
  /** Spring stiffness. Higher values snap faster. */
  readonly stiffness: number;
  /** Spring damping. Higher values settle with less overshoot. */
  readonly damping: number;
}

/**
 * Appearance of the point markers drawn on a series (`showMarkers` and `markers` on `Line` and `Area`, `SeriesMarkers`, `SeriesPointMarker`).
 */
export interface SeriesPointMarkerStyle {
  /** Fill color of the inner circle. Defaults to the series stroke color. */
  readonly fill?: string;
  /** Color of the outer ring. Defaults to `fill`. */
  stroke?: string;
  /**
   * Outer ring stroke width in px. Set to `0` to remove the ring.
   * @default 2
   */
  strokeWidth?: number;
  /**
   * Gap between the inner circle and the outer ring, in px.
   * @default 2
   */
  readonly ringGap?: number;
  /**
   * Width in px of an optional outline drawn outside the ring. `0` draws none.
   * @default 0
   */
  readonly outlineWidth?: number;
  /** Color of the outer outline. Defaults to `stroke`. */
  readonly outlineColor?: string;
  /**
   * Radius of the inner circle in px.
   * @default 5
   */
  readonly radius?: number;
  /**
   * Dim the markers that are not hovered while the chart is hovered. The enlarged active marker (`showActiveHighlight`) is drawn only while this is on.
   * @default true
   */
  readonly fadeOnHover?: boolean;
  /**
   * Opacity of the dimmed markers when `fadeOnHover` is on.
   * @default 0.5
   */
  readonly inactiveOpacity?: number;
  /**
   * Blur in px of the dimmed markers when `fadeOnHover` is on.
   * @default 2
   */
  readonly inactiveBlur?: number;
  /**
   * Blur in px the markers start from while they fade in on entrance.
   * @default 2
   */
  readonly enterBlur?: number;
  /**
   * Draw the hovered marker 1.35 times larger.
   * @default true
   */
  readonly showActiveHighlight?: boolean;
}

export interface LineConfig {
  /** Key of the data field that holds this line's y values. */
  readonly dataKey: string;
  /**
   * Stroke color of the line.
   * @default "var(--chart-line-primary)"
   */
  stroke?: string;
  /**
   * Stroke width of the line in px.
   * @default 2.5
   */
  strokeWidth?: number;
  /**
   * d3-shape curve factory used to interpolate between points.
   * @default curveNatural
   */
  readonly curve?: CurveFactory;
  /**
   * Id of the y scale this line is plotted against. Use it with a matching `YAxis` to give a series its own scale.
   * @default "left"
   */
  yAxisId?: string | number;
  /**
   * Fade the line toward transparent at the chart edges. `true` fades both ends, `"left"` or `"right"` fades one side, `false` turns the fade off.
   * @default true
   */
  readonly fadeEdges?: FadeEdges;
  /**
   * Draw a highlighted segment of the line around the hovered point.
   * @default true
   */
  showHighlight?: boolean;
  /**
   * Draw a circle marker at every data point.
   * @default false
   */
  readonly showMarkers?: boolean;
  /** Styling of the point markers drawn by `showMarkers`. See `SeriesPointMarkerStyle`. */
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
  /**
   * Data index from which the line is drawn dashed (inclusive). Useful for marking an incomplete or projected period.
   */
  readonly dashFromIndex?: number;
  /**
   * Dash pattern of the dashed tail when `dashFromIndex` is set.
   * @default "6,4"
   */
  readonly dashArray?: string;
  /**
   * Stroke color of the loading pulse overlay.
   * @default "var(--chart-foreground)"
   */
  readonly loadingStroke?: string;
  /**
   * Stroke opacity of the loading pulse overlay.
   * @default 0.5
   */
  readonly loadingStrokeOpacity?: number;
  /**
   * Whether the point markers animate in. The line itself always enters with the chart's `animationDuration`.
   * @default true
   */
  readonly animate?: boolean;
  /**
   * Show the loading pulse overlay on this line. When unset, the pulse follows the chart's `status`. Set `false` to disable it even while the chart is loading.
   */
  readonly loading?: boolean;
  /**
   * Phase of the loading pulse: `"loop"` repeats, `"exit"` plays the loading to ready transition, `"enter"` plays ready to loading.
   * @default "loop"
   */
  readonly loadingPulseMode?: LineLoadingPulseMode;
  /**
   * Loading animation: a travelling `"pulse"` or a diagonal `"sweep"` shimmer across the skeleton line.
   * @default "pulse"
   */
  readonly loadingStyle?: LoadingStyle;
  /** Called each time a `"loop"` pulse cycle completes. */
  readonly onLoadingPulseCycleComplete?: () => void;
}

export interface AreaConfig {
  /** Key of the data field that holds this area's y values. */
  readonly dataKey: string;
  /**
   * Color of the area's top line. Falls back to `fill`, then to the default line color.
   * @default "var(--chart-line-primary)"
   */
  stroke?: string;
  /**
   * Stroke width of the top line in px.
   * @default 2
   */
  strokeWidth?: number;
  /** Fill color of the area. Defaults to the resolved `stroke`. */
  readonly fill?: string;
  /**
   * Opacity of the fill at the top of the area, before the gradient fades it toward `gradientToOpacity`.
   * @default 0.4
   */
  readonly fillOpacity?: number;
  /**
   * d3-shape curve factory used to interpolate between points.
   * @default curveMonotoneX
   */
  readonly curve?: CurveFactory;
  /**
   * Id of the y scale this area is plotted against.
   * @default "left"
   */
  yAxisId?: string | number;
  /**
   * Draw the stroke line along the top of the area.
   * @default true
   */
  readonly showLine?: boolean;
  /**
   * Fill opacity at the bottom of the vertical gradient.
   * @default 0
   */
  readonly gradientToOpacity?: number;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly gradientSpan?: number;
  /**
   * Fade the area toward transparent at the chart edges. `true` fades both ends, `"left"` or `"right"` fades one side.
   * @default false
   */
  readonly fadeEdges?: FadeEdges;
  /**
   * Draw a circle marker at every data point.
   * @default false
   */
  readonly showMarkers?: boolean;
  /** Styling of the point markers drawn by `showMarkers`. See `SeriesPointMarkerStyle`. */
  readonly markers?: Readonly<SeriesPointMarkerStyle>;
  /**
   * Draw a highlighted segment of the top line around the hovered point.
   * @default true
   */
  showHighlight?: boolean;
  /** Data index from which the top line is drawn dashed (inclusive). */
  readonly dashFromIndex?: number;
  /**
   * Dash pattern of the dashed tail when `dashFromIndex` is set.
   * @default "6,4"
   */
  readonly dashArray?: string;
  /**
   * Whether the point markers animate in. The area itself always enters with the chart's `animationDuration`.
   * @default true
   */
  readonly animate?: boolean;
  /**
   * Show the loading pulse overlay on this area. When unset, the pulse follows the chart's `status`. Set `false` to disable it.
   */
  readonly loading?: boolean;
  /**
   * Stroke color of the loading pulse overlay.
   * @default "var(--chart-foreground)"
   */
  readonly loadingStroke?: string;
  /**
   * Stroke opacity of the loading pulse overlay.
   * @default 0.5
   */
  readonly loadingStrokeOpacity?: number;
  /**
   * Phase of the loading pulse: `"loop"` repeats, `"exit"` plays the loading to ready transition, `"enter"` plays ready to loading.
   * @default "loop"
   */
  readonly loadingPulseMode?: LineLoadingPulseMode;
  /**
   * Loading animation: a travelling `"pulse"` or a diagonal `"sweep"` shimmer.
   * @default "pulse"
   */
  readonly loadingStyle?: LoadingStyle;
}

export interface PatternAreaConfig {
  /** Key of the data field that holds the y values filled with the pattern. */
  readonly dataKey: string;
  /**
   * Pattern drawn inside the area (a `PatternPresetId`, for example `"diagonal"`, `"dots"` or `"cross"`).
   * @default "diagonal"
   */
  readonly patternPreset?: PatternPresetId;
  /** Color of the pattern strokes. Defaults to `fill`, then to the default line color. */
  readonly patternColor?: string;
  /** Fallback color for the pattern when `patternColor` is not set. */
  readonly fill?: string;
  /**
   * d3-shape curve factory used to interpolate between points.
   * @default curveMonotoneX
   */
  readonly curve?: CurveFactory;
  /** Deprecated. The pattern fill does not animate, so this has no effect. */
  readonly animate?: boolean;
}

export interface ScatterConfig {
  /** Key of the data field that holds this series' y values. */
  readonly dataKey: string;
  /**
   * Id of the y scale this series is plotted against.
   * @default "left"
   */
  yAxisId?: string | number;
  /**
   * Whether the dots animate in on entrance.
   * @default true
   */
  readonly animate?: boolean;
  /** Fill color of the dots. Defaults to `stroke`, then to a color from the chart palette. */
  readonly fill?: string;
  /** Color of the ring around each dot. Defaults to the resolved fill. */
  stroke?: string;
  /**
   * Width of the ring around each dot in px.
   * @default 2
   */
  strokeWidth?: number;
  /**
   * Gap between the dot and its ring in px.
   * @default 2
   */
  readonly ringGap?: number;
  /**
   * Radius of the dot in px.
   * @default 5
   */
  readonly radius?: number;
  /**
   * Fills the dots with a color that ends at `to` (or a default accent color when `true`). Overrides `fill`; the ring follows unless `stroke` is set.
   */
  readonly yGradient?: boolean | Readonly<{ from?: string; to?: string }>;
  /**
   * Dim the dots that are not hovered while the chart is hovered.
   * @default true
   */
  readonly fadeOnHover?: boolean;
  /**
   * Opacity of the dimmed dots when `fadeOnHover` is on.
   * @default 0.5
   */
  readonly inactiveOpacity?: number;
  /**
   * Blur in px of the dimmed dots when `fadeOnHover` is on.
   * @default 2
   */
  readonly inactiveBlur?: number;
  /**
   * Blur in px the dots start from while they fade in on entrance.
   * @default 2
   */
  readonly enterBlur?: number;
  /**
   * Draw the hovered dot 1.35 times larger.
   * @default true
   */
  readonly showActiveHighlight?: boolean;
  /**
   * Width in px of an optional outline drawn outside the ring. `0` draws none.
   * @default 0
   */
  readonly outlineWidth?: number;
  /** Color of the outline. Defaults to the ring color. */
  readonly outlineColor?: string;
}

export interface XAxisConfig {
  /**
   * Target number of tick labels along the x axis.
   * @default 5
   */
  readonly numTicks?: number;
  /**
   * Half-width in px of the zone around the date pill inside which tick labels are hidden. Only `BarChart` reads it.
   * @default 50
   */
  readonly tickerHalfWidth?: number;
  /**
   * Where ticks fall: `"data"` places them on evenly spaced data rows, `"domain"` places them at evenly spaced time values across the x domain.
   * @default "data"
   */
  readonly tickMode?: "domain" | "data";
  /** Formats a tick date into its label. Defaults to a short month and day such as "Jan 5". */
  readonly formatValue?: (value: Readonly<Date>) => string;
}

export interface YAxisConfig {
  /**
   * Id of the y scale this axis labels. Must match the `yAxisId` of the series that use it.
   * @default "left"
   */
  yAxisId?: string | number;
  /**
   * Side of the plot the axis sits on. The primary axis is on the left; additional axes default to the right.
   * @default "left"
   */
  readonly orientation?: "left" | "right";
  /**
   * Target number of tick labels. The primary axis also sets the number of horizontal grid lines.
   * @default 5
   */
  readonly numTicks?: number;
  /**
   * Abbreviate values of 1000 and above as thousands, for example `2k`.
   * @default true
   */
  readonly formatLargeNumbers?: boolean;
  /** Formats a tick value into its label. Overrides `formatLargeNumbers`. */
  readonly formatValue?: (value: number) => string;
}

export interface GridProps {
  /**
   * Show horizontal grid lines.
   * @default true
   */
  horizontal?: boolean;
  /**
   * Show vertical grid lines.
   * @default false
   */
  vertical?: boolean;
  /**
   * Number of horizontal grid lines. Ignored when `rowTickValues` is set.
   * @default 5
   */
  numTicksRows?: number;
  /**
   * Number of vertical grid lines.
   * @default 10
   */
  numTicksColumns?: number;
  /** Explicit y values for the horizontal grid lines. Overrides `numTicksRows`. */
  rowTickValues?: number[];
  /**
   * Color of the grid lines.
   * @default "var(--chart-grid)"
   */
  stroke?: string;
  /** Grid color while the chart is loading. Falls back to `stroke`. */
  loadingStroke?: string;
  /**
   * Opacity of the grid lines.
   * @default 1
   */
  strokeOpacity?: number;
  /**
   * Width of the grid lines in px.
   * @default 1
   */
  strokeWidth?: number;
  /**
   * Dash pattern of the grid lines.
   * @default "4,4"
   */
  strokeDasharray?: string;
  /** Y values of horizontal lines drawn with the highlight styling, for example a zero baseline. */
  highlightRowValues?: number[];
  /**
   * Color of the highlighted rows.
   * @default "var(--chart-foreground-muted)"
   */
  highlightRowStroke?: string;
  /**
   * Opacity of the highlighted rows.
   * @default 1
   */
  highlightRowStrokeOpacity?: number;
  /**
   * Width of the highlighted rows in px.
   * @default 1
   */
  highlightRowStrokeWidth?: number;
  /**
   * Dash pattern of the highlighted rows.
   * @default "0"
   */
  highlightRowStrokeDasharray?: string;
  /**
   * Fade the horizontal lines toward transparent at the left and right edges.
   * @default true
   */
  fadeHorizontal?: boolean;
  /**
   * Fade the vertical lines toward transparent at the top and bottom edges.
   * @default false
   */
  fadeVertical?: boolean;
  /**
   * Drop the first and last horizontal line (kept when two or fewer remain).
   * @default false
   */
  hideHorizontalEdgeLines?: boolean;
  /**
   * Drop the first and last vertical line (kept when two or fewer remain).
   * @default false
   */
  hideVerticalEdgeLines?: boolean;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The grid follows the primary (left) y scale.
   */
  yAxisId?: string | number;
  /**
   * While the chart is loading, sweep a bright band across the grid.
   * @default false
   */
  shimmer?: boolean;
  /**
   * Color of the shimmer band.
   * @default "color-mix(in oklch, var(--bkm-foreground) 68%, transparent)"
   */
  shimmerStroke?: string;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  shimmerLength?: number;
  /**
   * Speed multiplier of the shimmer sweep. `2` is twice as fast.
   * @default 1
   */
  shimmerSpeed?: number;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  shimmerSync?: boolean;
}

export interface BackgroundConfig extends PatternPresetOptions {
  /**
   * Pattern preset. `"none"` draws nothing.
   * @default "diagonal"
   */
  readonly pattern?: PatternPresetId;
  /**
   * Color of the pattern strokes.
   * @default "var(--chart-grid)"
   */
  readonly color?: string;
  /**
   * Draw the pattern over the plot area.
   * @default true
   */
  readonly showFill?: boolean;
  /**
   * Opacity of the pattern.
   * @default 1
   */
  readonly opacity?: number;
  /**
   * Fade the pattern out at the left and right edges.
   * @default true
   */
  readonly fadeHorizontal?: boolean;
  /**
   * Fade the pattern out at the top and bottom edges.
   * @default true
   */
  readonly fadeVertical?: boolean;
  /**
   * Width of the horizontal fade zone, as a percent of the plot width per edge (clamped to 0 to 45).
   * @default 10
   */
  readonly fadeHorizontalLength?: number;
  /**
   * Height of the vertical fade zone, as a percent of the plot height per edge (clamped to 0 to 45).
   * @default 10
   */
  readonly fadeVerticalLength?: number;
}

/** A point on a projection path. */
export interface ProjectionPoint {
  /** X position of the point. */
  readonly date: Readonly<Date>;
  /** Y value of the point. */
  readonly value: number;
}

/**
 * How a `ProjectionLine` is painted: `"solid"` uses one color, `"gradient"` blends from `gradientStart` to `gradientEnd` along the path.
 */
export type ProjectionStrokeStyle = "solid" | "gradient";

/**
 * Props of `ProjectionLine`: a forecast path drawn after the last data point, usually a dashed line from the last data row to a horizon point.
 */
export interface ProjectionLineProps {
  /**
   * Projection path points: the anchor (usually the last data row) followed by the horizon end. Needs at least two points to draw.
   */
  data: readonly ProjectionPoint[];
  /**
   * Id of the y-scale group the path is drawn against.
   * @default "left"
   */
  yAxisId?: string | number;
  /**
   * Stroke color of a solid path.
   * @default "var(--chart-3)"
   */
  stroke?: string;
  /**
   * `"solid"` paints one color, `"gradient"` blends `gradientStart` into `gradientEnd` along the path.
   * @default "solid"
   */
  readonly strokeStyle?: ProjectionStrokeStyle;
  /**
   * Gradient start color when `strokeStyle` is `"gradient"`.
   * @default `stroke`
   */
  readonly gradientStart?: string;
  /**
   * Gradient end color when `strokeStyle` is `"gradient"`.
   * @default "var(--chart-5)"
   */
  readonly gradientEnd?: string;
  /**
   * Stroke width in px.
   * @default 2
   */
  strokeWidth?: number;
  /**
   * `"linear"` draws straight segments, `"bezier"` draws a smooth S-curve with horizontal tangents.
   * @default "linear"
   */
  readonly curveKind?: "linear" | "bezier";
  /** Accepted so bklit-ui code compiles. Not read: use `curveKind` to choose the shape. */
  readonly curve?: CurveFactory;
  /**
   * SVG dash pattern of the path. Pass `"0"` for a solid path.
   * @default "6,4"
   */
  readonly strokeDasharray?: string;
  /**
   * Stroke opacity of the path.
   * @default 1
   */
  readonly strokeOpacity?: number;
  /**
   * Whether the horizon end reserves room for an end marker: the path stops short of the plot edge by the marker radius so it is not clipped. The marker dot itself is not drawn by this package.
   * @default true
   */
  readonly showEndMarker?: boolean;
  /**
   * Deprecated alias of `showEndMarker`.
   * @deprecated Use showEndMarker.
   */
  readonly showEndpoints?: boolean;
  /**
   * Radius in px of the end marker, used to keep the path inside the plot.
   * @default 5
   */
  readonly endpointRadius?: number;
  /** Accepted so bklit-ui code compiles. Not read. */
  readonly className?: string;
}

/** One `ProjectionLine` reduced to its y-scale group and points. */
export interface ProjectionLineConfig {
  /** Id of the y-scale group the projection is drawn against. */
  yAxisId: string;
  /** Points of the projection path. */
  data: ProjectionPoint[];
}

/** Props of `ProjectionLineEndMarker`, the dot at the end of a projection path. Accepted so bklit-ui code compiles; this package does not draw the dot. */
export interface ProjectionLineEndMarkerProps {
  /** Projection path points; the marker sits on the last one. */
  data: readonly ProjectionPoint[];
  /**
   * Id of the y-scale group the marker is drawn against.
   * @default "left"
   */
  yAxisId?: string | number;
  /**
   * Marker color.
   * @default "var(--chart-3)"
   */
  stroke?: string;
  /**
   * Marker opacity.
   * @default 1
   */
  readonly strokeOpacity?: number;
  /**
   * Marker radius in px.
   * @default 5
   */
  readonly radius?: number;
}

/**
 * Props of `LineSeriesTerminalMarker`, a ring on the last data point of a series; it is the usual anchor for a `ProjectionLine`.
 */
// bklit line-series-terminal-marker.tsx:8 LineSeriesTerminalMarkerProps.
export interface LineSeriesTerminalMarkerProps {
  /** Key of the series in the chart data. The ring sits on the last row's value. */
  readonly dataKey: string;
  /**
   * Id of the y-scale group the series uses.
   * @default "left"
   */
  yAxisId?: string | number;
  /**
   * Fill of the inner circle. No inner circle is drawn when omitted, `""` or `"transparent"`, which leaves a hollow ring.
   */
  readonly fill?: string;
  /**
   * Radius of the inner circle in px.
   * @default 5
   */
  readonly radius?: number;
  /**
   * Gap between the inner circle and the ring in px.
   * @default 0
   */
  readonly ringGap?: number;
  /**
   * Ring color.
   * @default "var(--chart-1)"
   */
  stroke?: string;
  /**
   * Ring stroke width in px.
   * @default 1.5
   */
  strokeWidth?: number;
}

/** Props of `ProfitLossLine`, a single line that is green above zero and red below it. */
export interface ProfitLossLineProps {
  /**
   * Key of the numeric series in the chart data. Values at or above zero use `positiveColor`, values below use `negativeColor`.
   */
  readonly dataKey: string;
  /** Accepted so bklit-ui code compiles. Not read: the line uses the chart's `xDataKey`. */
  readonly xDataKey?: string;
  /**
   * Stroke width in px.
   * @default 2.5
   */
  strokeWidth?: number;
  /**
   * Color above zero.
   * @default "var(--color-emerald-500, oklch(69.6% 0.17 162.48))"
   */
  readonly positiveColor?: string;
  /**
   * Color below zero.
   * @default "var(--color-red-500, oklch(63.7% 0.237 25.331))"
   */
  readonly negativeColor?: string;
  /**
   * d3 curve factory used to draw the line.
   * @default `curveLinear`
   */
  readonly curve?: CurveFactory;
  /** Accepted so bklit-ui code compiles. Not read: a profit/loss line never fades its ends. */
  readonly fadeEdges?: FadeEdges;
}

/** One event marker for `ChartMarkers`: a circle with an icon at a date on the x-axis. */
export interface ChartMarker {
  /**
   * Date the marker is placed at on the x-axis. Markers that share a date are grouped into one cluster with a count badge.
   */
  readonly date: Date;
  /** Icon or glyph shown inside the marker circle. Only text (a string or number) is drawn. */
  readonly icon: ReactNode;
  /** Title shown in the tooltip. */
  readonly title: string;
  /** Optional description shown under the title in the tooltip. */
  readonly description?: string;
  /** Optional custom tooltip content. Replaces the title and description. */
  readonly content?: ReactNode;
  /** Background color of the marker circle. */
  readonly color?: string;
  /** Called when the marker is clicked. */
  readonly onClick?: () => void;
  /** URL to navigate to when the marker is clicked. */
  readonly href?: string;
  /** Where `href` opens: `"_blank"` for a new tab, `"_self"` for the same tab. */
  target?: "_blank" | "_self";
}

/** Props of `ChartMarkers`, a row of event markers along the top of the plot. */
export interface ChartMarkersProps {
  /** The markers to display. Markers on the same date are grouped. */
  readonly items: readonly Readonly<ChartMarker>[];
  /**
   * Diameter of each marker circle in px.
   * @default 28
   */
  readonly size?: number;
  /**
   * Draw a dashed vertical guide line from each marker down the plot.
   * @default true
   */
  readonly showLines?: boolean;
  /** Accepted so bklit-ui code compiles. Not read: markers fade in with the chart entrance. */
  readonly animate?: boolean;
  /** Cap on how many markers of a cluster fan out on hover. The count badge still shows the full cluster size. */
  readonly maxFanned?: number;
}

/**
 * Props of `SeriesMarkers`: point markers for the series with this `dataKey` (same as `showMarkers` plus `markers` on its `Line` or `Area`).
 */
export interface SeriesMarkersProps extends SeriesPointMarkerStyle {
  /** Key of the series (a `Line` or `Area` `dataKey`) to draw markers on. */
  readonly dataKey: string;
  /**
   * Fade the markers in with the chart entrance.
   * @default true
   */
  readonly animate?: boolean;
}

/**
 * Props of `MarkerGroup`. As a chart child it draws one `ChartMarkers` group at the dates of its `markers`; the pixel-placement and portal props exist so bklit-ui code compiles and are not read.
 */
export interface MarkerGroupProps {
  /** Accepted so bklit-ui code compiles. Not read: the group is placed at the date of its markers. */
  readonly x?: number;
  /** Accepted so bklit-ui code compiles. Not read. */
  readonly y?: number;
  /** Markers in this group. Markers on the same date form one cluster. */
  readonly markers: readonly Readonly<ChartMarker>[];
  /** Accepted so bklit-ui code compiles. Not read. */
  readonly isActive?: boolean;
  /**
   * Diameter of each marker circle in px.
   * @default 28
   */
  readonly size?: number;
  /** Accepted so bklit-ui code compiles. Not read. */
  readonly onHover?: (markers: ChartMarker[] | null) => void;
  /** Accepted so bklit-ui code compiles. Not read. */
  readonly containerRef?: unknown;
  /** Horizontal offset from the chart container used to anchor the fan-out of a cluster. */
  readonly marginLeft?: number;
  /** Vertical offset from the chart container used to anchor the fan-out of a cluster. */
  readonly marginTop?: number;
  /** Accepted so bklit-ui code compiles. Not read. */
  readonly animationDelay?: number;
  /** Accepted so bklit-ui code compiles. Not read: markers fade in with the chart entrance. */
  readonly animate?: boolean;
  /** Accepted so bklit-ui code compiles. Not read: the guide line spans the plot. */
  readonly lineHeight?: number;
  /**
   * Draw a dashed vertical guide line from each marker down the plot.
   * @default true
   */
  readonly showLine?: boolean;
  /**
   * Keep clusters fanned out even when they are not hovered.
   * @default false
   */
  readonly forceOpen?: boolean;
  /** Accepted so bklit-ui code compiles. Not read. */
  readonly iconFill?: boolean;
  /** Stroke color of the marker circle. Defaults to the `--chart-marker-border` color. */
  readonly borderColor?: string;
  /**
   * Stroke width of the marker circle in px.
   * @default 1.5
   */
  readonly borderWidth?: number;
  /** Cap on how many markers of a cluster fan out on hover. The count badge still shows the full cluster size. */
  readonly maxFanned?: number;
  /**
   * Fade the markers to 40% opacity at rest, to spotlight another group.
   * @default false
   */
  readonly isMuted?: boolean;
}

/** Width of the tooltip crosshair: a pixel number, or `"line"` (1px), `"thin"` (2px), `"medium"` (4px) or `"thick"` (8px). */
export type IndicatorWidth = number | "line" | "thin" | "medium" | "thick";
/** Which ends of the tooltip crosshair fade out: `"both"`, `"top"`, `"bottom"` or `"none"`. */
export type IndicatorFadeEdges = "both" | "none" | "top" | "bottom";

export interface ChartTooltipProps {
  /**
   * Show the date pill that rides along the bottom of the plot.
   * @default true
   */
  readonly showDatePill?: boolean;
  /**
   * Show the vertical crosshair line.
   * @default true
   */
  readonly showCrosshair?: boolean;
  /**
   * Show a dot on every series at the hovered position.
   * @default true
   */
  readonly showDots?: boolean;
  /**
   * Dot style: a filled `"dot"` or a transparent `"ring"` square. Read by `BarChart` only.
   * @default "dot"
   */
  readonly dotVariant?: "dot" | "ring";
  /**
   * Dot radius in px.
   * @default 5
   */
  readonly dotSize?: number;
  /**
   * Corner radius of the `"ring"` variant as a fraction of its side (0 is square, 0.5 is a circle). Read by `BarChart` only.
   * @default 0.25
   */
  readonly dotRadiusFraction?: number;
  /**
   * Multiplier applied to the dot or ring size. Read by `BarChart` and `LiveLineChart`.
   * @default 1
   */
  readonly dotScale?: number;
  /**
   * Stroke width of the dots in px.
   * @default 2
   */
  readonly dotStrokeWidth?: number;
  /**
   * Color of the crosshair. Only a string is applied; the function form that bklit-ui accepts is ignored and the default is used.
   * @default "var(--chart-crosshair)"
   */
  readonly indicatorColor?: string | ((point: Record<string, unknown>) => string);
  /** Replaces the default tooltip panel body. Receives the hovered data row and its index. */
  readonly content?: (props: { point: Record<string, unknown>; index: number }) => ReactNode;
  /** Replaces the default rows (one per series) with your own list of `{ color, label, value }`. */
  readonly rows?: (point: Record<string, unknown>) => { readonly color: string; readonly label: string; readonly value: string | number }[];
  /**
   * Fill of the tooltip dots. A function receives the hovered row and the series config. Defaults to each series' color.
   */
  readonly dotColor?: string | ((point: Record<string, unknown>, line: ChartLineConfig) => string);
  /** Extra content rendered below the rows in the default panel, for example marker details. */
  readonly children?: ReactNode;
  /** Extra class name for the tooltip panel. */
  readonly className?: string;
  /** Spring for the floating panel when `matchCrosshair` is on. Defaults to the chart's tooltip spring. */
  readonly springConfig?: SpringConfig;
  /**
   * Make the floating panel follow the pointer with the same spring as the crosshair instead of `damping`.
   * @default false
   */
  readonly matchCrosshair?: boolean;
  /**
   * Spring damping for the floating panel when `matchCrosshair` is off. `0` moves the panel instantly.
   * @default 20
   */
  readonly damping?: number;
  /** Dash pattern of the crosshair. Omit for a solid line. */
  readonly indicatorDasharray?: string;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. The crosshair in this package is solid.
   */
  readonly indicatorFadeEdges?: IndicatorFadeEdges;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly indicatorFadeLength?: number;
  /** Spring for the floating panel. Takes priority over `matchCrosshair` and `damping`. */
  readonly boxSpringConfig?: SpringConfig;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Style the panel with `className` or the `--chart-tooltip-*` CSS variables instead.
   */
  readonly panelStyle?: CSSProperties;
  /**
   * Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. Set `--chart-tooltip-background` instead.
   */
  readonly backgroundColor?: string;
  /**
   * Thickness of the crosshair: a width in px, or `"line"` (1px), `"thin"` (2px), `"medium"` (4px) or `"thick"` (8px).
   * @default "line"
   */
  readonly indicatorWidth?: IndicatorWidth;
  /** Accepted for bklit-ui compatibility. It has no effect in bklit-tanstack-charts. */
  readonly columnWidth?: number;
}

/**
 * A drag selection over the chart, in x-axis data indices. `SegmentBackground` and the `SegmentLine*` children read it from `useChartHover()`.
 */
export interface ChartSelection {
  /** X position (px) where the drag started. */
  readonly startX: number;
  /** X position (px) where the drag currently ends. */
  readonly endX: number;
  /** Data index where the selection starts. */
  readonly startIndex: number;
  /** Data index where the selection ends. */
  readonly endIndex: number;
  /** Whether a drag is in progress. */
  readonly active: boolean;
}
