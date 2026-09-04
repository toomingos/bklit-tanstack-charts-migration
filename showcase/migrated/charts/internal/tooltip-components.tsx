import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react';
import { createPortal } from "react-dom";
import { createSpring } from './spring';
import type { Spring } from './spring';
import { ENTRANCE_SPRING, TICKER_ITEM_HEIGHT } from "./design-tokens";
import { useChartConfig } from './use-chart-config';
import type { SpringConfig } from './chart-config-context';
import { indicatorFadeGradientStops, resolveVerticalFadeSides } from './fade-mask';
import type { IndicatorFadeEdges, IndicatorFadeGradientStop, VerticalFadeSides } from './fade-mask';
import { resolveIndicatorPixelWidth } from "./tooltip-mappers";
import { TooltipContentRow } from "./tooltip-content-row";
import { TooltipGradientStop } from "./tooltip-gradient-stop";
import type { IndicatorWidth, TooltipRow } from "./types";

// Corner radius is clamped to this fraction of the side so a ring never over-rounds past a capsule.
const MAX_CORNER_RADIUS_FRACTION = 0.5;
// Ring-variant dot stroke width in px when the caller omits strokeWidth.
const RING_STROKE_WIDTH_PX = 1.5;
// Entrance slide distance in px (sign flips with the tooltip side).
const ENTRANCE_SLIDE_OFFSET_PX = 20;
// Entrance starts at this scale and grows to 1 with progress.
const ENTRANCE_START_SCALE = 0.85;
// Ticker digit-roll spring params (stiffness, damping).
const TICKER_SPRING_STIFFNESS = 400;
const TICKER_SPRING_DAMPING = 35;
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
// Entrance animation progress runs from empty to full.
const FULL_PROGRESS = 1;
// Entrance animation starts from zero progress.
const ENTRANCE_START_PROGRESS = 0;
// Non-positive measured sizes are ignored so the cached box never collapses.
const MIN_MEASURED_PX = 0;
// Token positions inside a "Month Day" ticker label.
const MONTH_PART_INDEX = 0;
const DAY_PART_INDEX = 1;
// Offset of the last element when indexing from the end.
const LAST_ELEMENT_OFFSET = -1;
// Sentinel for "no month selected yet" in the ticker month tracker.
const UNSET_MONTH_INDEX = -1;
// Index of the first element in a zero-based list.
const FIRST_INDEX = 0;
// Offset from length to the last valid index.
const LAST_INDEX_OFFSET = 1;
// Step used when scanning month segments from newest to oldest.
const INDEX_STEP = 1;
// Count that represents an empty label list.
const EMPTY_COUNT = 0;


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

interface DotSpringRefs {
  readonly circleRef: RefObject<SVGCircleElement | null>;
  readonly rectRef: RefObject<SVGRectElement | null>;
}

interface EnsureDotSpringsOptions {
  readonly animate: boolean;
  readonly circleRef: RefObject<SVGCircleElement | null>;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly size: number;
  readonly spring: Readonly<SpringConfig>;
  readonly springXRef: RefObject<Spring | undefined>;
  readonly springYRef: RefObject<Spring | undefined>;
  readonly x: number;
  readonly y: number;
}

const ensureDotSprings = (options: Readonly<EnsureDotSpringsOptions>): void => {
  const { animate, circleRef, rectRef, size, spring, springXRef, springYRef, x, y } = options;
  if (!animate) {return;}
  springXRef.current ??= createSpring({ damping: spring.damping, initial: x, onUpdate: (nx) => { if (circleRef.current) {circleRef.current.setAttribute("cx", String(nx));} if (rectRef.current) {rectRef.current.setAttribute("x", String(nx - size));} }, stiffness: spring.stiffness });
  springYRef.current ??= createSpring({ damping: spring.damping, initial: y, onUpdate: (ny) => { if (circleRef.current) {circleRef.current.setAttribute("cy", String(ny));} if (rectRef.current) {rectRef.current.setAttribute("y", String(ny - size));} }, stiffness: spring.stiffness });
};

interface DotSpringTargets {
  readonly springXRef: RefObject<Spring | undefined>;
  readonly springYRef: RefObject<Spring | undefined>;
  readonly x: number;
  readonly y: number;
}

const setDotSpringTargets = (options: Readonly<DotSpringTargets>): void => {
  const { springXRef, springYRef, x, y } = options;
  springXRef.current?.set(x);
  springYRef.current?.set(y);
};

interface DotSpringsOptions {
  readonly animate: boolean;
  readonly effectiveSpring: Readonly<SpringConfig>;
  readonly size: number;
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
}

// Hover-dot spring tracking: springs own animated attrs exclusively and are driven
// Imperatively (jump on mount/visible, set in a layout effect), so React never sets them via JSX.
const useTooltipDotSprings = (options: Readonly<DotSpringsOptions>): DotSpringRefs => {
  const { animate, effectiveSpring, size, visible, x, y } = options;
  const circleRef = useRef<SVGCircleElement | null>(null);
  const rectRef = useRef<SVGRectElement | null>(null);
  const springXRef = useRef<Spring | undefined>(undefined);
  const springYRef = useRef<Spring | undefined>(undefined);
  const ensureSprings = useCallback(() => {
    ensureDotSprings({ animate, circleRef, rectRef, size, spring: effectiveSpring, springXRef, springYRef, x, y });
  }, [animate, effectiveSpring, size, x, y]);
  // Spring drivers read the latest targets without re-triggering each other.
  const syncDotSprings = useEffectEvent((shouldJump: boolean): void => {
    if (shouldJump) {
      ensureSprings();
      springXRef.current?.jump(x);
      springYRef.current?.jump(y);
      return;
    }
    if (!animate || !visible) {return;}
    setDotSpringTargets({ springXRef, springYRef, x, y });
  });
  // Springs own animated attrs exclusively; React must not set them via JSX.
  useLayoutEffect(() => {
    syncDotSprings(false);
  });
  useLayoutEffect((): (() => void) | undefined => {
    if (!visible) {return undefined;}
    syncDotSprings(true);
    return (): void => {
      springXRef.current?.stop();
      springYRef.current?.stop();
      springXRef.current = undefined;
      springYRef.current = undefined;
    };
  }, [visible]);
  return { circleRef, rectRef };
};

interface DotBodyOptions {
  readonly animate: boolean;
  readonly circleRef: RefObject<SVGCircleElement | null>;
  readonly color: string;
  readonly cornerRadiusFraction: number;
  readonly fill: string;
  readonly isRing: boolean;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly size: number;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly x: number;
  readonly y: number;
}

const renderDotBody = (options: Readonly<DotBodyOptions>): ReactNode => {
  const { animate, circleRef, cornerRadiusFraction, fill, isRing, rectRef, size, stroke, strokeWidth, x, y } = options;
  const side = size * FULL_EXTENT_FACTOR;
  const rx = ringCornerRadius(size, cornerRadiusFraction);
  if (isRing) {
    if (animate) {
      return (
        <rect
          ref={rectRef}
          height={side}
          rx={rx}
          ry={rx}
          width={side}
        />
      );
    }
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
        strokeWidth={strokeWidth}
      />
    );
  }
  if (animate) {
    return <circle ref={circleRef} fill={fill} r={size} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  return <circle cx={x} cy={y} fill={fill} r={size} stroke={stroke} strokeWidth={strokeWidth} />;
};

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
  springConfig,
  animate = true,
}: Readonly<TooltipDotProps>): ReactNode => {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const isRing = variant === "ring";
  const { fill, stroke } = resolveDotPaint(variant, color, strokeColor);
  const effectiveStrokeWidth = resolveDotStrokeWidth(strokeWidth, isRing);
  const { circleRef, rectRef } = useTooltipDotSprings({ animate, effectiveSpring, size, visible, x, y });

  if (!visible) {
    return undefined;
  }

  return renderDotBody({
    animate,
    circleRef,
    color,
    cornerRadiusFraction,
    fill,
    isRing,
    rectRef,
    size,
    stroke,
    strokeWidth: effectiveStrokeWidth,
    x,
    y,
  });
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

interface IndicatorSpringRefs {
  readonly lineRef: RefObject<SVGLineElement | null>;
  readonly rectRef: RefObject<SVGRectElement | null>;
}

interface EnsureIndicatorSpringsOptions {
  readonly animate: boolean;
  readonly lineRef: RefObject<SVGLineElement | null>;
  readonly lineX: number;
  readonly lineSpringRef: RefObject<Spring | null>;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly rectSpringRef: RefObject<Spring | null>;
  readonly rectX: number;
  readonly spring: Readonly<SpringConfig>;
}

const ensureIndicatorSprings = (options: Readonly<EnsureIndicatorSpringsOptions>): void => {
  const { animate, lineRef, lineX, lineSpringRef, rectRef, rectSpringRef, rectX, spring } = options;
  if (!animate) {return;}
  rectSpringRef.current ??= createSpring({ damping: spring.damping, initial: rectX, onUpdate: (nx) => { rectRef.current?.setAttribute("x", String(nx)); }, stiffness: spring.stiffness });
  lineSpringRef.current ??= createSpring({ damping: spring.damping, initial: lineX, onUpdate: (nx) => { lineRef.current?.setAttribute("x1", String(nx)); lineRef.current?.setAttribute("x2", String(nx)); }, stiffness: spring.stiffness });
};

interface IndicatorSpringTargets {
  readonly lineSpringRef: RefObject<Spring | null>;
  readonly lineX: number;
  readonly rectSpringRef: RefObject<Spring | null>;
  readonly rectX: number;
}

const setIndicatorSpringTargets = (options: Readonly<IndicatorSpringTargets>): void => {
  const { lineSpringRef, lineX, rectSpringRef, rectX } = options;
  rectSpringRef.current?.set(rectX);
  lineSpringRef.current?.set(lineX);
};

interface IndicatorSpringsOptions {
  readonly animate: boolean;
  readonly effectiveSpring: Readonly<SpringConfig>;
  readonly lineX: number;
  readonly rectX: number;
}

// Crosshair spring tracking: springs own the animated x attrs exclusively and are
// Driven imperatively, so React never sets them via JSX on the animated path.
const useTooltipIndicatorSprings = (options: Readonly<IndicatorSpringsOptions>): IndicatorSpringRefs => {
  const { animate, effectiveSpring, lineX, rectX } = options;
  const rectRef = useRef<SVGRectElement | null>(null);
  const lineRef = useRef<SVGLineElement | null>(null);
  const rectSpringRef = useRef<Spring | null>(null);
  const lineSpringRef = useRef<Spring | null>(null);
  const ensureSprings = useCallback(() => {
    ensureIndicatorSprings({ animate, lineRef, lineSpringRef, lineX, rectRef, rectSpringRef, rectX, spring: effectiveSpring });
  }, [animate, effectiveSpring, lineX, rectX]);
  // Cursor follow reads the latest targets without re-triggering the snap below.
  const followIndicatorTargets = useEffectEvent((): void => {
    if (!animate) {return;}
    setIndicatorSpringTargets({ lineSpringRef, lineX, rectSpringRef, rectX });
  });
  useLayoutEffect(() => {
    followIndicatorTargets();
  });
  useLayoutEffect(() => {
    if (!animate) {return;}
    ensureSprings();
    rectSpringRef.current?.jump(rectX);
    lineSpringRef.current?.jump(lineX);
  });
  return { lineRef, rectRef };
};

interface DashedIndicatorOptions {
  readonly animate: boolean;
  readonly height: number;
  readonly indicatorFill: string;
  readonly lineRef: RefObject<SVGLineElement | null>;
  readonly lineX: number;
  readonly strokeDasharray?: string;
  readonly strokeWidth: number;
}

const renderDashedIndicator = (options: Readonly<DashedIndicatorOptions>): ReactElement => {
  const { animate, height, indicatorFill, lineRef, lineX, strokeDasharray, strokeWidth } = options;
  if (animate) {
    return (
      <line
        ref={lineRef}
        stroke={indicatorFill}
        strokeDasharray={strokeDasharray}
        strokeWidth={strokeWidth}
        y1={0}
        y2={height}
      />
    );
  }
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
  readonly animate: boolean;
  readonly height: number;
  readonly indicatorFill: string;
  readonly pixelWidth: number;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly rectX: number;
}

const renderSolidIndicator = (options: Readonly<SolidIndicatorOptions>): ReactElement => {
  const { animate, height, indicatorFill, pixelWidth, rectRef, rectX } = options;
  if (animate) {
    return (
      <rect
        ref={rectRef}
        fill={indicatorFill}
        height={height}
        width={pixelWidth}
        y={0}
      />
    );
  }
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
  readonly animate: boolean;
  readonly fadeLength: number;
  readonly fadeSides: VerticalFadeSides;
  readonly gradientId: string;
  readonly height: number;
  readonly indicatorFill: string;
  readonly pixelWidth: number;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly rectX: number;
}

const renderFadedIndicator = (options: Readonly<FadedIndicatorOptions>): ReactElement => {
  const { animate, fadeLength, fadeSides, gradientId, height, indicatorFill, pixelWidth, rectRef, rectX } = options;
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
        ref={animate ? rectRef : undefined}
        fill={`url(#${gradientId})`}
        height={height}
        width={pixelWidth}
        x={animate ? undefined : rectX}
        y={0}
      />
    </g>
  );
};

interface IndicatorBodyOptions {
  readonly animate: boolean;
  readonly fadeLength: number;
  readonly gradientId: string;
  readonly height: number;
  readonly lineRef: RefObject<SVGLineElement | null>;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly strokeDasharray?: string;
  readonly style: Readonly<IndicatorStyle>;
}

const renderIndicatorBody = (options: Readonly<IndicatorBodyOptions>): ReactElement => {
  const { animate, fadeLength, gradientId, height, lineRef, rectRef, strokeDasharray, style } = options;
  if (style.dashed) {
    return renderDashedIndicator({
      animate,
      height,
      indicatorFill: style.fill,
      lineRef,
      lineX: style.lineX,
      strokeDasharray,
      strokeWidth: style.strokeWidth,
    });
  }
  if (!style.fadeSides.any) {
    return renderSolidIndicator({
      animate,
      height,
      indicatorFill: style.fill,
      pixelWidth: style.pixelWidth,
      rectRef,
      rectX: style.rectX,
    });
  }
  return renderFadedIndicator({
    animate,
    fadeLength,
    fadeSides: style.fadeSides,
    gradientId,
    height,
    indicatorFill: style.fill,
    pixelWidth: style.pixelWidth,
    rectRef,
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
  springConfig,
  strokeDasharray,
}: Readonly<Omit<TooltipIndicatorProps, "visible">>): ReactElement => {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const style = resolveIndicatorStyle({ colorEdge, colorMid, columnWidth, fadeEdges, span, strokeDasharray, width, x });
  const { lineRef, rectRef } = useTooltipIndicatorSprings({ animate, effectiveSpring, lineX: style.lineX, rectX: style.rectX });

  return renderIndicatorBody({
    animate,
    fadeLength,
    gradientId,
    height,
    lineRef,
    rectRef,
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

interface MaybeRunEntranceOptions {
  readonly entrance: boolean;
  readonly flip: boolean;
  readonly prevFlipRef: RefObject<boolean | null>;
  readonly runEntrance: (flipped: boolean) => void;
}

const maybeRunTooltipEntrance = (options: Readonly<MaybeRunEntranceOptions>): void => {
  const { entrance, flip, prevFlipRef, runEntrance } = options;
  const prevFlip = prevFlipRef.current;
  prevFlipRef.current = flip;
  if (entrance && (prevFlip === null || flip !== prevFlip)) {
    runEntrance(flip);
  }
};

interface TooltipBoxMotionOptions {
  readonly animate: boolean;
  readonly effectiveSpring: Readonly<SpringConfig>;
  readonly entrance: boolean;
  readonly targetX: number;
  readonly targetY: number;
}

interface TooltipBoxMotion {
  readonly ensurePositionSprings: () => void;
  readonly layerRef: RefObject<HTMLDivElement | null>;
  readonly leftSpringRef: RefObject<Spring | null>;
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly prevFlipRef: RefObject<boolean | null>;
  readonly runEntrance: (flipped: boolean) => void;
  readonly topSpringRef: RefObject<Spring | null>;
}

// Tooltip-box motion: position springs plus the entrance spring, all driven imperatively
// Off render-time targets; React only paints the static fallback position.
const useTooltipBoxMotion = (options: Readonly<TooltipBoxMotionOptions>): TooltipBoxMotion => {
  const { animate, effectiveSpring, entrance, targetX, targetY } = options;
  const layerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const leftSpringRef = useRef<Spring | null>(null);
  const topSpringRef = useRef<Spring | null>(null);
  const entranceSpringRef = useRef<Spring | null>(null);
  const prevFlipRef = useRef<boolean | null>(null);
  const runEntrance = useCallback((flipped: boolean) => {
    const panel = panelRef.current;
    if (!panel || !entrance) {return;}
    entranceSpringRef.current ??= createSpring({
      damping: ENTRANCE_SPRING.damping,
      initial: 0,
      onUpdate: (progress) => {
        if (!panelRef.current) {return;}
        const from = flipped ? ENTRANCE_SLIDE_OFFSET_PX : -ENTRANCE_SLIDE_OFFSET_PX;
        panelRef.current.style.transformOrigin = flipped ? "right top" : "left top";
        panelRef.current.style.transform = `translateX(${from * (FULL_PROGRESS - progress)}px) scale(${ENTRANCE_START_SCALE + (FULL_PROGRESS - ENTRANCE_START_SCALE) * progress})`;
        panelRef.current.style.opacity = String(progress);
      },
      stiffness: ENTRANCE_SPRING.stiffness,
    });
    entranceSpringRef.current.jump(ENTRANCE_START_PROGRESS);
    entranceSpringRef.current.set(FULL_PROGRESS);
  }, [entrance]);
  const ensurePositionSprings = useCallback(() => {
    if (!animate) {return;}
    leftSpringRef.current ??= createSpring({ damping: effectiveSpring.damping, initial: targetX, onUpdate: (leftPx) => { if (layerRef.current) {layerRef.current.style.left = `${leftPx}px`;} }, stiffness: effectiveSpring.stiffness });
    topSpringRef.current ??= createSpring({ damping: effectiveSpring.damping, initial: targetY, onUpdate: (topPx) => { if (layerRef.current) {layerRef.current.style.top = `${topPx}px`;} }, stiffness: effectiveSpring.stiffness });
  }, [animate, effectiveSpring, targetX, targetY]);
  return { ensurePositionSprings, layerRef, leftSpringRef, panelRef, prevFlipRef, runEntrance, topSpringRef };
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

interface SyncBoxLayoutOptions {
  readonly animate: boolean;
  readonly boxSizeRef: RefObject<TooltipBoxSize>;
  readonly children: ReactNode;
  readonly containerHeight: number;
  readonly containerWidth: number;
  readonly entrance: boolean;
  readonly flippedOverride?: boolean;
  readonly leftOverride?: number;
  readonly motion: Readonly<TooltipBoxMotion>;
  readonly offset: number;
  readonly setStaticPosition: (position: Readonly<{ left: number; top: number }>) => void;
  readonly topOverride?: number;
  readonly x: number;
  readonly y: number;
}

const syncTooltipBoxLayout = (options: Readonly<SyncBoxLayoutOptions>): void => {
  const { animate, boxSizeRef, containerHeight, containerWidth, entrance, flippedOverride, leftOverride, motion, offset, setStaticPosition, topOverride, x, y } = options;
  const cached = measureTooltipBoxPanel(motion.panelRef, boxSizeRef);
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
  maybeRunTooltipEntrance({ entrance, flip: synced.flip, prevFlipRef: motion.prevFlipRef, runEntrance: motion.runEntrance });
  if (!animate) {
    setStaticPosition({ left: synced.tx, top: synced.ty });
    return;
  }
  motion.ensurePositionSprings();
  motion.leftSpringRef.current?.jump(synced.tx);
  motion.topSpringRef.current?.jump(synced.ty);
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

interface BoxFollowOptions {
  readonly animate: boolean;
  readonly ensurePositionSprings: () => void;
  readonly leftSpringRef: RefObject<Spring | null>;
  readonly targetX: number;
  readonly targetY: number;
  readonly topSpringRef: RefObject<Spring | null>;
}

const useTooltipBoxFollow = (options: Readonly<BoxFollowOptions>): void => {
  const { animate, ensurePositionSprings, leftSpringRef, targetX, targetY, topSpringRef } = options;
  useEffect(() => {
    if (!animate) {return;}
    ensurePositionSprings();
    leftSpringRef.current?.set(targetX);
    topSpringRef.current?.set(targetY);
  });
};

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
  springConfig,
  animate = true,
  entrance = true,
  panelStyle,
  backgroundColor = "var(--chart-tooltip-background)",
  container,
}: Readonly<Omit<TooltipBoxProps, "visible" | "containerRef" | "className"> & {
  container: HTMLElement;
  layerClassName?: string;
}>): ReactNode => {
  const { tooltipBoxSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipBoxSpring;
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
  const motion = useTooltipBoxMotion({
    animate,
    effectiveSpring,
    entrance,
    targetX: placement.tx,
    targetY: placement.ty,
  });

  // Motion members stay listed so the sync only re-runs on real motion changes.
  useLayoutEffect(() => {
    syncTooltipBoxLayout({
      animate,
      boxSizeRef,
      children,
      containerHeight,
      containerWidth,
      entrance,
      flippedOverride,
      leftOverride,
      motion: {
        ensurePositionSprings: motion.ensurePositionSprings,
        layerRef: motion.layerRef,
        leftSpringRef: motion.leftSpringRef,
        panelRef: motion.panelRef,
        prevFlipRef: motion.prevFlipRef,
        runEntrance: motion.runEntrance,
        topSpringRef: motion.topSpringRef,
      },
      offset,
      setStaticPosition,
      topOverride,
      x,
      y,
    });
  }, [
    x,
    y,
    containerWidth,
    containerHeight,
    offset,
    leftOverride,
    topOverride,
    flippedOverride,
    animate,
    entrance,
    children,
    boxSizeRef,
    motion.ensurePositionSprings,
    motion.layerRef,
    motion.leftSpringRef,
    motion.panelRef,
    motion.prevFlipRef,
    motion.runEntrance,
    motion.topSpringRef,
  ]);

  useTooltipLayerFade(motion.layerRef, entrance);

  useTooltipBoxFollow({
    animate,
    ensurePositionSprings: motion.ensurePositionSprings,
    leftSpringRef: motion.leftSpringRef,
    targetX: placement.tx,
    targetY: placement.ty,
    topSpringRef: motion.topSpringRef,
  });

  return renderTooltipPortal({
    children,
    container,
    layerClassName,
    layerRef: motion.layerRef,
    layerStyle: { left: staticPosition.left, top: staticPosition.top },
    panelRef: motion.panelRef,
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



interface DateTickerProps {
  readonly currentIndex: number;
  readonly labels: readonly string[];
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

interface DateTickerSprings {
  readonly daySpringRef: RefObject<Spring | undefined>;
  readonly dayStackRef: RefObject<HTMLDivElement | null>;
  readonly monthSpringRef: RefObject<Spring | undefined>;
  readonly monthStackRef: RefObject<HTMLDivElement | null>;
  readonly prevMonthRef: RefObject<number>;
}

interface DateTickerAnimationOptions {
  readonly compact: boolean;
  readonly currentIndex: number;
  readonly currentMonthIndex: number;
}

// Date-ticker rolling animation: digit/month stacks are translated imperatively by
// Springs; compact mode skips springs entirely and renders the current label.
const useDateTickerAnimation = (options: Readonly<DateTickerAnimationOptions>): DateTickerSprings => {
  const { compact, currentIndex, currentMonthIndex } = options;
  const dayStackRef = useRef<HTMLDivElement | null>(null);
  const monthStackRef = useRef<HTMLDivElement | null>(null);
  const daySpringRef = useRef<Spring | undefined>(undefined);
  const monthSpringRef = useRef<Spring | undefined>(undefined);
  const prevMonthRef = useRef(UNSET_MONTH_INDEX);
  useEffect((): (() => void) | undefined => {
    if (compact) {return undefined;}
    daySpringRef.current ??= createSpring({ damping: TICKER_SPRING_DAMPING, initial: 0, onUpdate: (offsetY) => { if (dayStackRef.current) {dayStackRef.current.style.transform = `translateY(${offsetY}px)`;} }, stiffness: TICKER_SPRING_STIFFNESS });
    monthSpringRef.current ??= createSpring({ damping: TICKER_SPRING_DAMPING, initial: 0, onUpdate: (offsetY) => { if (monthStackRef.current) {monthStackRef.current.style.transform = `translateY(${offsetY}px)`;} }, stiffness: TICKER_SPRING_STIFFNESS });
    return (): void => {
      daySpringRef.current?.stop();
      monthSpringRef.current?.stop();
      daySpringRef.current = undefined;
      monthSpringRef.current = undefined;
    };
  }, [compact]);
  useEffect(() => {
    if (compact) {return;}
    const targetDayY = -currentIndex * TICKER_ITEM_HEIGHT;
    const targetMonthY = -currentMonthIndex * TICKER_ITEM_HEIGHT;
    daySpringRef.current?.set(targetDayY);
    if (prevMonthRef.current === UNSET_MONTH_INDEX || prevMonthRef.current !== currentMonthIndex) {
      prevMonthRef.current = currentMonthIndex;
      monthSpringRef.current?.set(targetMonthY);
    }
  }, [compact, currentIndex, currentMonthIndex]);
  return { daySpringRef, dayStackRef, monthSpringRef, monthStackRef, prevMonthRef };
};

const renderCompactTicker = (pillClassName: string, label: string): ReactNode => (
  <div className={pillClassName}>
    <div className="flex h-6 items-center justify-center">
      <span className="whitespace-nowrap font-medium text-sm">{label}</span>
    </div>
  </div>
);

interface FullTickerOptions {
  readonly monthSegments: readonly MonthSegment[];
  readonly parsedLabels: readonly ParsedLabel[];
  readonly pillClassName: string;
  readonly springs: Readonly<DateTickerSprings>;
  readonly visible: boolean;
}

interface TickerStacksOptions {
  readonly monthSegments: readonly MonthSegment[];
  readonly parsedLabels: readonly ParsedLabel[];
  readonly springs: Readonly<DateTickerSprings>;
}

const renderTickerStacks = (options: Readonly<TickerStacksOptions>): ReactNode => {
  const { monthSegments, parsedLabels, springs } = options;
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
      <div className="flex flex-col" ref={springs.monthStackRef}>
        {monthItems}
      </div>
    </div>
  );
  const dayStack = (
    <div className="relative h-6 overflow-hidden">
      <div className="flex flex-col" ref={springs.dayStackRef}>
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

const renderFullTicker = (options: Readonly<FullTickerOptions>): ReactNode => {
  const { monthSegments, parsedLabels, pillClassName, springs, visible } = options;
  if (!visible || parsedLabels.length === EMPTY_COUNT) {return undefined;}
  const stacks = renderTickerStacks({ monthSegments, parsedLabels, springs });
  return (
    <div className={pillClassName}>
      <div className="relative h-6 overflow-hidden">
        {stacks}
      </div>
    </div>
  );
};

const DateTicker = ({ currentIndex, labels, visible }: Readonly<DateTickerProps>): ReactNode => {
  const compact = useMemo(
    () => visible && labels.length > COMPACT_TICKER_THRESHOLD,
    [visible, labels.length],
  );

  const parsedLabels = useMemo<ParsedLabel[]>(() => labels.map((label, index) => toParsedLabel(label, index)), [labels]);

  const monthSegments = useMemo<MonthSegment[]>(() => buildMonthSegments(parsedLabels), [parsedLabels]);

  const currentMonthIndex = useMemo(() => resolveCurrentMonthIndex(currentIndex, parsedLabels, monthSegments), [currentIndex, parsedLabels, monthSegments]);

  const springs = useDateTickerAnimation({ compact, currentIndex, currentMonthIndex });

  const pillClassName =
    "overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900";

  if (compact) {
    return renderCompactTicker(pillClassName, labels.at(currentIndex) ?? labels.at(FIRST_INDEX) ?? "");
  }

  return renderFullTicker({ monthSegments, parsedLabels, pillClassName, springs, visible });
}

export { DateTicker, TooltipBox, TooltipContent, TooltipDot, TooltipIndicator };
export type {
  DateTickerProps,
  TooltipBoxProps,
  TooltipContentProps,
  TooltipDotProps,
  TooltipIndicatorProps,
};
