import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react';
import { createPortal } from "react-dom";
import type { MotionValue } from "motion/react";
import type { ChartPoint, ChartValue } from "@tanstack/charts";
import type { ChartTooltipBodyRenderContext } from "@tanstack/react-charts/tooltip";
import { indicatorFadeGradientStops, resolveVerticalFadeSides } from './fade-mask';
import type { IndicatorFadeEdges, IndicatorFadeGradientStop, VerticalFadeSides } from './fade-mask';
import { resolveIndicatorPixelWidth } from "./tooltip-mappers";
import { useSanitizedId } from "./use-sanitized-id";
import { TooltipContentRow } from "./tooltip-content-row";
import { TooltipGradientStop } from "./tooltip-gradient-stop";
import type { SpringConfig } from './chart-config-context';
import type { LineConfig } from './chart-context';
import type { ChartDatum, ChartTooltipConfig, ChartTooltipPoint, IndicatorWidth, TooltipRow } from "./types";
import { TICKER_ITEM_HEIGHT } from "./design-tokens";

// Corner radius is clamped to this fraction of the side so a ring never over-rounds past a capsule.
const MAX_CORNER_RADIUS_FRACTION = 0.5;
// Ring-variant dot stroke width in px when the caller omits strokeWidth.
const RING_STROKE_WIDTH_PX = 1.5;
// Full extent derived from a half extent (dot diameter and ring side from radius).
const FULL_EXTENT_FACTOR = 2;
// Divisor that converts a full width into a half-width centering offset.
const HALF_DIVISOR = 2;
// Lower clamp for normalized fractions such as the corner-radius fraction.
const FRACTION_LOWER_BOUND = 0;
// Default hover-dot stroke width in px for the solid-dot variant.
const DEFAULT_DOT_STROKE_WIDTH_PX = 2;
// Default hover-dot radius in px when the caller omits size.
const DEFAULT_DOT_SIZE = 5;
// Default ring corner-radius fraction when the caller omits it.
const DEFAULT_CORNER_RADIUS_FRACTION = 0.25;
// Minimum crosshair stroke width in px so a zero-width indicator stays visible.
const MIN_INDICATOR_STROKE_WIDTH_PX = 1;
// Default vertical fade length in px for the indicator gradient.
const DEFAULT_FADE_LENGTH_PX = 10;
// Default tooltip offset in px from the cursor when the caller omits it.
const DEFAULT_TOOLTIP_OFFSET_PX = 16;
// Non-positive measured sizes are ignored so the cached box never collapses.
const MIN_MEASURED_PX = 0;


interface TooltipDotProps {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
  readonly color: string;
  readonly size?: number;
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
  readonly variant?: "dot" | "ring";
  readonly cornerRadiusFraction?: number;
  readonly springConfig?: Readonly<SpringConfig>;
  readonly animate?: boolean;
}

const ringCornerRadius = (halfExtent: number, cornerRadiusFraction: number): number => {
  const side = halfExtent * FULL_EXTENT_FACTOR;
  return side * Math.max(FRACTION_LOWER_BOUND, Math.min(MAX_CORNER_RADIUS_FRACTION, cornerRadiusFraction));
}

interface DotPaint {
  readonly fill: string;
  readonly stroke: string;
}

const resolveDotPaint = (variant: "dot" | "ring", color: string, strokeColor: string): DotPaint => {
  const isRing = variant === "ring";
  return { fill: isRing ? "transparent" : color, stroke: isRing ? color : strokeColor };
};

const resolveDotStrokeWidth = (strokeWidth: number | undefined, isRing: boolean): number =>
  strokeWidth ?? (isRing ? RING_STROKE_WIDTH_PX : DEFAULT_DOT_STROKE_WIDTH_PX);

// The package owns motion (V2.4): x/y arrive from the focus point.
// Legacy spring numbers map onto the package transition in focus-marks.ts.
const TooltipDot = Object.assign(
  ({
    x,
    y,
    visible,
    color,
    size = DEFAULT_DOT_SIZE,
    strokeColor = "var(--chart-background)",
    strokeWidth = DEFAULT_DOT_STROKE_WIDTH_PX,
    variant = "dot",
    cornerRadiusFraction = DEFAULT_CORNER_RADIUS_FRACTION,
  }: Readonly<TooltipDotProps>): ReactElement | null => {
  const isRing = variant === "ring";
  const { fill, stroke } = resolveDotPaint(variant, color, strokeColor);
  const effectiveStrokeWidth = resolveDotStrokeWidth(strokeWidth, isRing);

  if (!visible) {
    return null;
  }

  if (isRing) {
    const side = size * FULL_EXTENT_FACTOR;
    const rx = ringCornerRadius(size, cornerRadiusFraction);
    return (
      <rect
        height={side}
        rx={rx}
        ry={rx}
        width={side}
        x={x - size}
        y={y - size}
        fill={fill}
        stroke={stroke}
        strokeWidth={effectiveStrokeWidth}
      />
    );
  }
  return <circle cx={x} cy={y} fill={fill} r={size} stroke={stroke} strokeWidth={effectiveStrokeWidth} />;
},
  { displayName: "TooltipDot" },
);


interface TooltipIndicatorProps {
  readonly x: number;
  readonly height: number;
  readonly visible: boolean;
  readonly width?: IndicatorWidth;
  readonly span?: number;
  readonly columnWidth?: number;
  readonly colorEdge?: string;
  readonly colorMid?: string;
  readonly fadeEdges?: IndicatorFadeEdges | boolean;
  readonly fadeLength?: number;
  readonly animate?: boolean;
  readonly gradientId?: string;
  readonly springConfig?: Readonly<SpringConfig>;
  readonly strokeDasharray?: string;
}

interface IndicatorStyle {
  readonly dashed: boolean;
  readonly fadeSides: VerticalFadeSides;
  readonly fill: string;
  readonly lineX: number;
  readonly pixelWidth: number;
  readonly rectX: number;
  readonly strokeWidth: number;
}

interface ResolveIndicatorStyleOptions {
  readonly colorEdge: string;
  readonly colorMid: string;
  readonly columnWidth?: number;
  readonly fadeEdges: IndicatorFadeEdges | boolean;
  readonly span?: number;
  readonly strokeDasharray?: string;
  readonly width: IndicatorWidth;
  readonly x: number;
}

const resolveIndicatorStyle = (options: Readonly<ResolveIndicatorStyleOptions>): IndicatorStyle => {
  const { colorEdge, colorMid, columnWidth, fadeEdges, span, strokeDasharray, width, x } = options;
  const pixelWidth = resolveIndicatorPixelWidth({ columnWidth, span, width });
  return {
    dashed: Boolean(strokeDasharray),
    fadeSides: resolveVerticalFadeSides(fadeEdges),
    fill: colorMid || colorEdge,
    lineX: x,
    pixelWidth,
    rectX: x - pixelWidth / HALF_DIVISOR,
    strokeWidth: Math.max(MIN_INDICATOR_STROKE_WIDTH_PX, pixelWidth),
  };
};

interface DashedIndicatorOptions {
  readonly height: number;
  readonly indicatorFill: string;
  readonly lineX: number;
  readonly strokeDasharray?: string;
  readonly strokeWidth: number;
}

const renderDashedIndicator = (options: Readonly<DashedIndicatorOptions>): ReactElement => {
  const { height, indicatorFill, lineX, strokeDasharray, strokeWidth } = options;
  return (
    <line
      stroke={indicatorFill}
      strokeDasharray={strokeDasharray}
      strokeWidth={strokeWidth}
      x1={lineX}
      x2={lineX}
      y1={0}
      y2={height}
    />
  );
};

interface SolidIndicatorOptions {
  readonly height: number;
  readonly indicatorFill: string;
  readonly pixelWidth: number;
  readonly rectX: number;
}

const renderSolidIndicator = (options: Readonly<SolidIndicatorOptions>): ReactElement => {
  const { height, indicatorFill, pixelWidth, rectX } = options;
  return (
    <rect
      fill={indicatorFill}
      height={height}
      width={pixelWidth}
      x={rectX}
      y={0}
    />
  );
};

interface FadedIndicatorOptions {
  readonly fadeLength: number;
  readonly fadeSides: VerticalFadeSides;
  readonly gradientId: string;
  readonly height: number;
  readonly indicatorFill: string;
  readonly pixelWidth: number;
  readonly rectX: number;
}

const renderFadedIndicator = (options: Readonly<FadedIndicatorOptions>): ReactElement => {
  const { fadeLength, fadeSides, gradientId, height, indicatorFill, pixelWidth, rectX } = options;
  const fadeStops = indicatorFadeGradientStops(fadeSides, fadeLength);
  const stopNodes = fadeStops.map((stop: Readonly<IndicatorFadeGradientStop>) => (
    <TooltipGradientStop
      fill={indicatorFill}
      key={stop.offset}
      offset={stop.offset}
      opacity={stop.opacity}
    />
  ));
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
          {stopNodes}
        </linearGradient>
      </defs>
      <rect
        fill={`url(#${gradientId})`}
        height={height}
        width={pixelWidth}
        x={rectX}
        y={0}
      />
    </g>
  );
};

interface IndicatorBodyOptions {
  readonly animate?: boolean;
  readonly fadeLength: number;
  readonly gradientId: string;
  readonly height: number;
  readonly strokeDasharray?: string;
  readonly style: Readonly<IndicatorStyle>;
}

// The package owns motion (V2.4): x arrives from the focus point.
// Legacy spring numbers map onto the package transition in focus-marks.ts.
const renderIndicatorBody = (options: Readonly<IndicatorBodyOptions>): ReactElement => {
  const { fadeLength, gradientId, height, strokeDasharray, style } = options;
  if (style.dashed) {
    return renderDashedIndicator({
      height,
      indicatorFill: style.fill,
      lineX: style.lineX,
      strokeDasharray,
      strokeWidth: style.strokeWidth,
    });
  }
  if (!style.fadeSides.any) {
    return renderSolidIndicator({
      height,
      indicatorFill: style.fill,
      pixelWidth: style.pixelWidth,
      rectX: style.rectX,
    });
  }
  return renderFadedIndicator({
    fadeLength,
    fadeSides: style.fadeSides,
    gradientId,
    height,
    indicatorFill: style.fill,
    pixelWidth: style.pixelWidth,
    rectX: style.rectX,
  });
};

const TooltipIndicatorInner = ({
  x,
  height,
  width = "line",
  span,
  columnWidth,
  colorEdge = "var(--chart-crosshair)",
  colorMid = "var(--chart-crosshair)",
  fadeEdges = "both",
  fadeLength = DEFAULT_FADE_LENGTH_PX,
  animate = true,
  gradientId: gradientIdProp,
  strokeDasharray,
}: Readonly<Omit<TooltipIndicatorProps, "visible">>): ReactElement => {
  // Caller ids win; the default is per-mount so two indicators never share one gradient.
  const fallbackGradientId = useSanitizedId();
  const gradientId = gradientIdProp ?? fallbackGradientId;
  const style = resolveIndicatorStyle({ colorEdge, colorMid, columnWidth, fadeEdges, span, strokeDasharray, width, x });

  return renderIndicatorBody({
    animate,
    fadeLength,
    gradientId,
    height,
    strokeDasharray,
    style,
  });
}

const TooltipIndicator = Object.assign(
  (props: Readonly<TooltipIndicatorProps>): ReactElement | null => {
  if (!props.visible) {
    return null;
  }
  return (
    <TooltipIndicatorInner
      animate={props.animate}
      colorEdge={props.colorEdge}
      colorMid={props.colorMid}
      columnWidth={props.columnWidth}
      fadeEdges={props.fadeEdges}
      fadeLength={props.fadeLength}
      gradientId={props.gradientId}
      height={props.height}
      span={props.span}
      springConfig={props.springConfig}
      strokeDasharray={props.strokeDasharray}
      width={props.width}
      x={props.x}
    />
  );
},
  { displayName: "TooltipIndicator" },
);


interface TooltipBoxProps {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly containerWidth: number;
  readonly containerHeight: number;
  readonly offset?: number;
  readonly className?: string;
  readonly children: ReactNode;
  readonly left?: number | MotionValue<number>;
  readonly top?: number | MotionValue<number>;
  readonly flipped?: boolean;
  readonly springConfig?: SpringConfig;
  readonly animate?: boolean;
  readonly entrance?: boolean;
  readonly panelStyle?: CSSProperties;
  readonly backgroundColor?: string;
}

const BOX_FALLBACK_WIDTH = 180;
const BOX_FALLBACK_HEIGHT = 80;

interface TooltipPlacement {
  readonly flip: boolean;
  readonly tx: number;
  readonly ty: number;
}

interface ResolveTooltipPlacementOptions {
  readonly containerHeight: number;
  readonly containerWidth: number;
  readonly flip: boolean;
  readonly leftOverride?: number;
  readonly offset: number;
  readonly tooltipHeight: number;
  readonly tooltipWidth: number;
  readonly topOverride?: number;
  readonly x: number;
  readonly y: number;
}

const resolveTooltipPlacement = (options: Readonly<ResolveTooltipPlacementOptions>): TooltipPlacement => {
  const { containerHeight, flip, leftOverride, offset, tooltipHeight, tooltipWidth, topOverride, x, y } = options;
  const tx = leftOverride ?? (flip ? x - offset - tooltipWidth : x + offset);
  const ty = topOverride ?? Math.max(offset, Math.min(y - tooltipHeight / HALF_DIVISOR, containerHeight - tooltipHeight - offset));
  return { flip, tx, ty };
};

interface TooltipBoxSize {
  height: number;
  width: number;
}

interface RenderPlacementOptions {
  readonly boxSizeRef: RefObject<TooltipBoxSize>;
  readonly containerHeight: number;
  readonly containerWidth: number;
  readonly flippedOverride?: boolean;
  readonly leftOverride?: number;
  readonly offset: number;
  readonly topOverride?: number;
  readonly x: number;
  readonly y: number;
}

interface TooltipRenderPlacement {
  readonly isFlipped: boolean;
  readonly tx: number;
  readonly ty: number;
}

const resolveTooltipRenderPlacement = (options: Readonly<RenderPlacementOptions>): TooltipRenderPlacement => {
  const { boxSizeRef, containerHeight, containerWidth, flippedOverride, leftOverride, offset, topOverride, x, y } = options;
  const tooltipWidth = boxSizeRef.current.width;
  const tooltipHeight = boxSizeRef.current.height;
  const shouldFlipX = x + tooltipWidth + offset > containerWidth;
  const placement = resolveTooltipPlacement({
    containerHeight,
    containerWidth,
    flip: shouldFlipX,
    leftOverride,
    offset,
    tooltipHeight,
    tooltipWidth,
    topOverride,
    x,
    y,
  });
  return { isFlipped: flippedOverride ?? shouldFlipX, tx: placement.tx, ty: placement.ty };
};

const measureTooltipBoxPanel = (
  panelRef: RefObject<HTMLDivElement | null>,
  sizeRef: RefObject<TooltipBoxSize>,
): TooltipBoxSize => {
  const el = panelRef.current;
  if (el) {
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (width > MIN_MEASURED_PX) {sizeRef.current.width = width;}
    if (height > MIN_MEASURED_PX) {sizeRef.current.height = height;}
  }
  return { height: sizeRef.current.height, width: sizeRef.current.width };
};

interface TooltipPortalOptions {
  readonly children: ReactNode;
  readonly container: HTMLElement;
  readonly layerClassName: string;
  readonly layerRef: RefObject<HTMLDivElement | null>;
  readonly layerStyle: Readonly<CSSProperties>;
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly panelStyleResolved: Readonly<CSSProperties>;
}

const renderTooltipPortal = (options: Readonly<TooltipPortalOptions>): ReactNode => {
  const { children, container, layerClassName, layerRef, layerStyle, panelRef, panelStyleResolved } = options;
  const extraClassName = layerClassName ? ` ${layerClassName}` : "";
  return createPortal(
    <div
      className={`bkm-tooltip-layer${extraClassName}`}
      data-slot="tooltip"
      ref={layerRef}
      style={layerStyle}
    >
      <div className="bkm-tooltip-panel" data-slot="tooltip-panel" ref={panelRef} style={panelStyleResolved}>
        {children}
      </div>
    </div>,
    container,
  );
};

const useTooltipLayerFade = (_layerRef: RefObject<HTMLDivElement | null>, _entrance: boolean): void => {
  // Retired: the 100ms mount fade now rides the package tooltip motion.
};

// The package owns motion (V2.4): the layer renders at the resolved focus point.
// Follow timing lives in the native tooltip extension.
const TooltipBoxInner = ({
  x,
  y,
  containerWidth,
  containerHeight,
  offset = DEFAULT_TOOLTIP_OFFSET_PX,
  layerClassName = "",
  children,
  left: leftOverride,
  top: topOverride,
  flipped: flippedOverride,
  entrance = true,
  panelStyle,
  backgroundColor = "var(--chart-tooltip-background)",
  container,
}: Readonly<Omit<TooltipBoxProps, "visible" | "containerRef" | "className" | "left" | "top"> & {
  container: HTMLElement;
  layerClassName?: string;
  left?: number;
  top?: number;
}>): ReactNode => {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const boxSizeRef = useRef({ height: BOX_FALLBACK_HEIGHT, width: BOX_FALLBACK_WIDTH });
  const [staticPosition, setStaticPosition] = useState({ left: x, top: y });
  const placement = resolveTooltipRenderPlacement({
    boxSizeRef,
    containerHeight,
    containerWidth,
    flippedOverride,
    leftOverride,
    offset,
    topOverride,
    x,
    y,
  });

  useLayoutEffect(() => {
    const cached = measureTooltipBoxPanel(panelRef, boxSizeRef);
    const synced = resolveTooltipPlacement({
      containerHeight,
      containerWidth,
      flip: leftOverride === undefined ? x + cached.width + offset > containerWidth : (flippedOverride ?? false),
      leftOverride,
      offset,
      tooltipHeight: cached.height,
      tooltipWidth: cached.width,
      topOverride,
      x,
      y,
    });
    setStaticPosition({ left: synced.tx, top: synced.ty });
  }, [
    x,
    y,
    containerWidth,
    containerHeight,
    offset,
    leftOverride,
    topOverride,
    flippedOverride,
    children,
  ]);

  useTooltipLayerFade(layerRef, entrance);

  return renderTooltipPortal({
    children,
    container,
    layerClassName,
    layerRef,
    layerStyle: { left: staticPosition.left, top: staticPosition.top },
    panelRef,
    panelStyleResolved: {
      transformOrigin: placement.isFlipped ? "right top" : "left top",
      ...(backgroundColor ? { backgroundColor } : undefined),
      ...panelStyle,
    },
  });
}

// Mounted flag without a post-paint setState: false on the server, true once mounted.
const subscribeMounted = (notify: () => void): (() => void) => (): void => {
  // Final snapshot check on unsubscribe; the snapshot is constant so this never re-renders.
  notify();
};
const getMountedSnapshot = (): boolean => true;
const getMountedServerSnapshot = (): boolean => false;

// Inner-only-on-visible: springs init at the cursor, not (0,0).
const isPx = (value: number | MotionValue<number> | undefined): value is number => Number.isFinite(value);
const TooltipBox = Object.assign(
  (props: Readonly<TooltipBoxProps>): ReactElement | null => {
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getMountedServerSnapshot);

  const container = props.containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  if (!props.visible) {
    return null;
  }
  // Animated overrides resolve through the package motion path; static placement consumes numbers only.
  const leftOverride = isPx(props.left) ? props.left : undefined;
  const topOverride = isPx(props.top) ? props.top : undefined;
  return (
    <TooltipBoxInner
      animate={props.animate}
      backgroundColor={props.backgroundColor}
      container={container}
      containerHeight={props.containerHeight}
      containerWidth={props.containerWidth}
      entrance={props.entrance}
      flipped={props.flipped}
      layerClassName={props.className}
      left={leftOverride}
      offset={props.offset}
      panelStyle={props.panelStyle}
      springConfig={props.springConfig}
      top={topOverride}
      x={props.x}
      y={props.y}
    >
      {props.children}
    </TooltipBoxInner>
  );
},
  { displayName: "TooltipBox" },
);


interface TooltipContentProps {
  readonly title?: string;
  readonly rows: TooltipRow[];
  readonly children?: ReactNode;
}

const renderTooltipContentRow = (row: Readonly<TooltipRow>): ReactElement => (
  <TooltipContentRow
    key={`${row.label}-${row.color}`}
    row={row}
  />
);

const TooltipContent = Object.assign(
  ({ title, rows, children }: Readonly<TooltipContentProps>): ReactElement => (
    <div className="overflow-hidden">
      <div className="px-3 py-2.5">
        {title !== undefined && title !== "" && (
          <div className="mb-2 text-left font-medium text-chart-tooltip-foreground text-xs">
            {title}
          </div>
        )}
        <div className="space-y-1.5">
          {rows.map((row) => renderTooltipContentRow(row))}
        </div>

        {children !== undefined && children !== null && (
          <div className="mt-2 transition-opacity duration-200 ease-out">
            {children}
          </div>
        )}
      </div>
    </div>
  ),
  { displayName: "TooltipContent" },
);

// Token positions inside a "Month Day" ticker label.
const MONTH_PART_INDEX = 0;
const DAY_PART_INDEX = 1;
// Offset of the last element when indexing from the end.
const LAST_ELEMENT_OFFSET = -1;
// Index of the first element in a zero-based list.
const FIRST_INDEX = 0;
// Offset from length to the last valid index.
const LAST_INDEX_OFFSET = 1;
// Step used when scanning month segments from newest to oldest.
const INDEX_STEP = 1;
// Count that represents an empty label list.
const EMPTY_COUNT = 0;

interface DateTickerProps {
  readonly currentIndex: number;
  readonly labels: string[];
  readonly visible: boolean;
}

const COMPACT_TICKER_THRESHOLD = 60;

interface ParsedLabel {
  readonly month: string;
  readonly day: string;
  readonly full: string;
  readonly key: string;
}

interface MonthSegment {
  readonly month: string;
  readonly key: string;
  readonly startIndex: number;
}

const toParsedLabel = (label: string, index: number): ParsedLabel => {
  const parts = label.split(" ");
  return { day: parts[DAY_PART_INDEX] || "", full: label, key: `${label}::${index}`, month: parts[MONTH_PART_INDEX] || "" };
};

const buildMonthSegments = (parsedLabels: readonly ParsedLabel[]): MonthSegment[] => {
  const segments: MonthSegment[] = [];
  for (const [index, label] of parsedLabels.entries()) {
    const prev = segments.at(LAST_ELEMENT_OFFSET);
    if (!prev || prev.month !== label.month) {
      segments.push({
        key: `${label.month}-${index}`,
        month: label.month,
        startIndex: index,
      });
    }
  }
  return segments;
};

const resolveCurrentMonthIndex = (
  currentIndex: number,
  parsedLabels: readonly ParsedLabel[],
  monthSegments: readonly MonthSegment[],
): number => {
  if (currentIndex < FIRST_INDEX || currentIndex >= parsedLabels.length) {
    return FIRST_INDEX;
  }
  for (let segmentIndex = monthSegments.length - LAST_INDEX_OFFSET; segmentIndex >= FIRST_INDEX; segmentIndex -= INDEX_STEP) {
    const segment = monthSegments.at(segmentIndex);
    if (segment && segment.startIndex <= currentIndex) {
      return segmentIndex;
    }
  }
  return FIRST_INDEX;
};

const renderCompactTicker = (pillClassName: string, label: string): ReactElement => (
  <div className={pillClassName} data-slot="date-pill">
    <div className="flex h-6 items-center justify-center">
      <span className="whitespace-nowrap font-medium text-sm">{label}</span>
    </div>
  </div>
);

interface TickerStacksOptions {
  readonly monthSegments: readonly MonthSegment[];
  readonly parsedLabels: readonly ParsedLabel[];
  readonly dayStyle: Readonly<CSSProperties>;
  readonly monthStyle: Readonly<CSSProperties>;
}

// The package owns motion (V2.4): stacks render at the focus-point offset.
const renderTickerStacks = (options: Readonly<TickerStacksOptions>): ReactNode => {
  const { monthSegments, parsedLabels, dayStyle, monthStyle } = options;
  const monthItems = monthSegments.map((segment) => (
    <div
      className="flex h-6 shrink-0 items-center justify-center"
      key={segment.key}
    >
      <span className="whitespace-nowrap font-medium text-sm">
        {segment.month}
      </span>
    </div>
  ));
  const dayItems = parsedLabels.map((label) => (
    <div
      className="flex h-6 shrink-0 items-center justify-center"
      key={label.key}
    >
      <span className="whitespace-nowrap font-medium text-sm">
        {label.day}
      </span>
    </div>
  ));
  const monthStack = (
    <div className="relative h-6 overflow-hidden">
      <div className="flex flex-col" style={monthStyle}>
        {monthItems}
      </div>
    </div>
  );
  const dayStack = (
    <div className="relative h-6 overflow-hidden">
      <div className="flex flex-col" style={dayStyle}>
        {dayItems}
      </div>
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-1">
      {monthStack}
      {dayStack}
    </div>
  );
};

interface FullTickerOptions {
  readonly monthSegments: readonly MonthSegment[];
  readonly parsedLabels: readonly ParsedLabel[];
  readonly pillClassName: string;
  readonly dayStyle: Readonly<CSSProperties>;
  readonly monthStyle: Readonly<CSSProperties>;
  readonly visible: boolean;
}

const renderFullTicker = (options: Readonly<FullTickerOptions>): ReactElement | null => {
  const { monthSegments, parsedLabels, pillClassName, dayStyle, monthStyle, visible } = options;
  if (!visible || parsedLabels.length === EMPTY_COUNT) {return null;}
  const stacks = renderTickerStacks({ dayStyle, monthSegments, monthStyle, parsedLabels });
  return (
    <div className={pillClassName} data-slot="date-pill">
      <div className="relative h-6 overflow-hidden">
        {stacks}
      </div>
    </div>
  );
};

const DateTicker = Object.assign(
  ({ currentIndex, labels, visible }: Readonly<DateTickerProps>): ReactElement | null => {
  const compact = useMemo(
    () => visible && labels.length > COMPACT_TICKER_THRESHOLD,
    [visible, labels.length],
  );

  const parsedLabels = useMemo<ParsedLabel[]>(() => labels.map((label, index) => toParsedLabel(label, index)), [labels]);

  const monthSegments = useMemo<MonthSegment[]>(() => buildMonthSegments(parsedLabels), [parsedLabels]);

  const currentMonthIndex = useMemo(() => resolveCurrentMonthIndex(currentIndex, parsedLabels, monthSegments), [currentIndex, parsedLabels, monthSegments]);

  const dayStyle = useMemo((): CSSProperties => ({ transform: `translateY(${-currentIndex * TICKER_ITEM_HEIGHT}px)` }), [currentIndex]);
  const monthStyle = useMemo((): CSSProperties => ({ transform: `translateY(${-currentMonthIndex * TICKER_ITEM_HEIGHT}px)` }), [currentMonthIndex]);

  const pillClassName =
    "overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900";

  if (compact) {
    return renderCompactTicker(pillClassName, labels.at(currentIndex) ?? labels.at(FIRST_INDEX) ?? "");
  }

  return renderFullTicker({ dayStyle, monthSegments, monthStyle, parsedLabels, pillClassName, visible });
},
  { displayName: "DateTicker" },
);

// Legacy `<ChartTooltip>` props (config-carrier surface); the package owns the paint.
interface ChartTooltipProps {
  readonly showDatePill?: boolean;
  readonly showCrosshair?: boolean;
  readonly showDots?: boolean;
  readonly dotVariant?: "dot" | "ring";
  readonly dotSize?: number;
  readonly dotRadiusFraction?: number;
  readonly dotScale?: number;
  readonly dotStrokeWidth?: number;
  readonly indicatorColor?: string | ((point: Record<string, unknown>) => string);
  readonly content?: (props: {
    point: Record<string, unknown>;
    index: number;
  }) => ReactNode;
  readonly rows?: (point: Record<string, unknown>) => TooltipRow[];
  readonly dotColor?:
    | string
    | ((point: Record<string, unknown>, line: LineConfig) => string);
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
}

// Panel chrome shared by both body-render paths below.
interface TooltipPanelParams {
  readonly panelClassName: string;
  readonly panelStyle: CSSProperties;
}

interface RenderSeriesTooltipBodyOptions<
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> {
  tooltip: ChartTooltipConfig | null | undefined;
  buildRows: (
    datum: Readonly<ChartDatum>,
    ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>
  ) => TooltipRow[];
  resolveTitle: (
    datum: Readonly<ChartDatum>,
    ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>
  ) => string | undefined;
}

const buildPanelClassName = (cfg: ChartTooltipConfig | null | undefined): string => {
  const className = cfg?.className ?? "";
  return className.length > 0 ? `bkm-tooltip-panel ${className}` : "bkm-tooltip-panel";
};

const buildPanelStyle = (cfg: ChartTooltipConfig | null | undefined): CSSProperties => {
  const backgroundColor = cfg?.backgroundColor ?? "";
  const style: CSSProperties = { ...cfg?.panelStyle };
  if (backgroundColor.length > 0) {
    style.backgroundColor = backgroundColor;
  }
  return style;
};

interface CustomTooltipBodyParams<TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue> {
  primary: ChartPoint<ChartDatum, TXValue, TYValue>;
  datum: Readonly<ChartDatum>;
  panel: TooltipPanelParams;
}

// Custom `tooltip.content` render path; kept out of renderDefaultTooltipBody so each stays short.
const renderCustomTooltipBody = <TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(
  content: (props: { point: ChartTooltipPoint; index: number }) => ReactNode,
  params: CustomTooltipBodyParams<TXValue, TYValue>
): ReactNode => (
  <div className={params.panel.panelClassName} style={params.panel.panelStyle}>
    {content({ index: params.primary.datumIndex, point: params.datum })}
  </div>
);

interface DefaultTooltipBodyParams<TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue> {
  ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>;
  buildRows: (datum: Readonly<ChartDatum>, ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>) => TooltipRow[];
  resolveTitle: (datum: Readonly<ChartDatum>, ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>) => string | undefined;
  cfg: ChartTooltipConfig | null | undefined;
  datum: Readonly<ChartDatum>;
  panel: TooltipPanelParams;
}

const renderDefaultTooltipBody = <TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(
  params: DefaultTooltipBodyParams<TXValue, TYValue>
): ReactNode => {
  const { ctx, buildRows, resolveTitle, cfg, datum, panel } = params;
  const title = resolveTitle(datum, ctx);
  const rows: TooltipRow[] = cfg?.rows ? cfg.rows(datum) : buildRows(datum, ctx);
  return (
    <div className={panel.panelClassName} style={panel.panelStyle}>
      <TooltipContent title={title} rows={rows}>
        {cfg?.children}
      </TooltipContent>
    </div>
  );
};

const renderSeriesTooltipBody = <TXValue extends ChartValue = ChartValue, TYValue extends ChartValue = ChartValue>(ctx: ChartTooltipBodyRenderContext<ChartDatum, TXValue, TYValue>, options: RenderSeriesTooltipBodyOptions<TXValue, TYValue>): ReactNode => {
  const primary = ctx.points.at(0);
  if (primary === undefined) {return false;}
  const {datum} = primary;
  const cfg = options.tooltip;
  const panel: TooltipPanelParams = { panelClassName: buildPanelClassName(cfg), panelStyle: buildPanelStyle(cfg) };
  return cfg?.content
    ? renderCustomTooltipBody(cfg.content, { datum, panel, primary })
    : renderDefaultTooltipBody({ buildRows: options.buildRows, cfg, ctx, datum, panel, resolveTitle: options.resolveTitle });
}

export { DateTicker, TooltipBox, TooltipContent, TooltipDot, TooltipIndicator, renderSeriesTooltipBody };
export type {
  ChartTooltipProps,
  DateTickerProps,
  RenderSeriesTooltipBodyOptions,
  TooltipBoxProps,
  TooltipContentProps,
  TooltipDotProps,
  TooltipIndicatorProps,
};
