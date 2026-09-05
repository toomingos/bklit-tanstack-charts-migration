import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react';
import { createPortal } from "react-dom";
import { indicatorFadeGradientStops, resolveVerticalFadeSides } from './fade-mask';
import type { IndicatorFadeEdges, IndicatorFadeGradientStop, VerticalFadeSides } from './fade-mask';
import { resolveIndicatorPixelWidth } from "./tooltip-mappers";
import { TooltipContentRow } from "./tooltip-content-row";
import { TooltipGradientStop } from "./tooltip-gradient-stop";
import type { SpringConfig } from './chart-config-context';
import type { IndicatorWidth, TooltipRow } from "./types";

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
// Legacy spring numbers map onto the package transition in hover-geometry.ts.
const TooltipDot = ({
  x,
  y,
  visible,
  color,
  size = DEFAULT_DOT_SIZE,
  strokeColor = "var(--chart-background)",
  strokeWidth = DEFAULT_DOT_STROKE_WIDTH_PX,
  variant = "dot",
  cornerRadiusFraction = DEFAULT_CORNER_RADIUS_FRACTION,
}: Readonly<TooltipDotProps>): ReactNode => {
  const isRing = variant === "ring";
  const { fill, stroke } = resolveDotPaint(variant, color, strokeColor);
  const effectiveStrokeWidth = resolveDotStrokeWidth(strokeWidth, isRing);

  if (!visible) {
    return undefined;
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
}


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
// Legacy spring numbers map onto the package transition in hover-geometry.ts.
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
  gradientId = "tooltip-indicator-gradient",
  strokeDasharray,
}: Readonly<Omit<TooltipIndicatorProps, "visible">>): ReactElement => {
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

const TooltipIndicator = (props: Readonly<TooltipIndicatorProps>): ReactNode => {
  if (!props.visible) {
    return undefined;
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
}


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
  readonly left?: number;
  readonly top?: number;
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
      ref={layerRef}
      style={layerStyle}
    >
      <div className="bkm-tooltip-panel" ref={panelRef} style={panelStyleResolved}>
        {children}
      </div>
    </div>,
    container,
  );
};

const useTooltipLayerFade = (layerRef: RefObject<HTMLDivElement | null>, entrance: boolean): void => {
  useEffect((): (() => void) | undefined => {
    const layer = layerRef.current;
    if (!layer || !entrance) {return undefined;}
    // 100ms mount fade mirrors legacy positionBox boxFade.
    const fade = layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, fill: "both" });
    return (): void =>{  fade.cancel(); };
  }, [entrance, layerRef]);
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
}: Readonly<Omit<TooltipBoxProps, "visible" | "containerRef" | "className"> & {
  container: HTMLElement;
  layerClassName?: string;
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
const TooltipBox = (props: Readonly<TooltipBoxProps>): ReactNode => {
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getMountedServerSnapshot);

  const container = props.containerRef.current;
  if (!(mounted && container)) {
    return undefined;
  }
  if (!props.visible) {
    return undefined;
  }
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
      left={props.left}
      offset={props.offset}
      panelStyle={props.panelStyle}
      springConfig={props.springConfig}
      top={props.top}
      x={props.x}
      y={props.y}
    >
      {props.children}
    </TooltipBoxInner>
  );
}


interface TooltipContentProps {
  readonly title?: string;
  readonly rows: readonly Readonly<TooltipRow>[];
  readonly children?: ReactNode;
}

const renderTooltipContentRow = (row: Readonly<TooltipRow>): ReactElement => (
  <TooltipContentRow
    key={`${row.label}-${row.color}`}
    row={row}
  />
);

const TooltipContent = ({ title, rows, children }: Readonly<TooltipContentProps>): ReactElement => (
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
  );

export { DateTicker } from './tooltip-date-ticker';
export { TooltipBox, TooltipContent, TooltipDot, TooltipIndicator };
export type { DateTickerProps } from './tooltip-date-ticker';
export type {
  TooltipBoxProps,
  TooltipContentProps,
  TooltipDotProps,
  TooltipIndicatorProps,
};
