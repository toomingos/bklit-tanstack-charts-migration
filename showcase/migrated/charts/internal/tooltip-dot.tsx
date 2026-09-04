import { useCallback, useEffectEvent, useLayoutEffect, useRef } from 'react';
import type { ReactElement, RefObject } from 'react';
import { createSpring } from './spring';
import type { Spring } from './spring';
import { TooltipDotMarker } from './tooltip-dot-marker';
import { useChartConfig } from './use-chart-config';
import type { SpringConfig } from './chart-config-context';

interface TooltipDotProps {
  x: number;
  y: number;
  visible: boolean;
  color: string;
  size?: number;
  strokeColor?: string;
  strokeWidth?: number;
  variant?: "dot" | "ring";
  cornerRadiusFraction?: number;
  springConfig?: SpringConfig;
  animate?: boolean;
}

interface ResolveDotPaintOptions {
  readonly color: string;
  readonly isRing: boolean;
  readonly strokeColor: string;
}

interface DotPaint {
  readonly fill: string;
  readonly stroke: string;
}

const resolveDotPaint = (options: Readonly<ResolveDotPaintOptions>): DotPaint => {
  const { color, isRing, strokeColor } = options;
  return { fill: isRing ? "transparent" : color, stroke: isRing ? color : strokeColor };
};

interface RetargetDotSpringsOptions {
  readonly animate: boolean;
  readonly springXRef: RefObject<Spring | undefined>;
  readonly springYRef: RefObject<Spring | undefined>;
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
}

// Plain `set()` retargets the in-flight spring without cutting its animation (unlike `jump()`).
const retargetDotSprings = (options: Readonly<RetargetDotSpringsOptions>): void => {
  const { animate, springXRef, springYRef, visible, x, y } = options;
  if (animate && visible) {
    springXRef.current?.set(x);
    springYRef.current?.set(y);
  }
};

interface StopDotSpringsOptions {
  readonly springXRef: RefObject<Spring | undefined>;
  readonly springYRef: RefObject<Spring | undefined>;
}

// Teardown stops both springs and releases them so the next reveal re-seeds from rest.
const stopDotSprings = (options: Readonly<StopDotSpringsOptions>): void => {
  const { springXRef, springYRef } = options;
  springXRef.current?.stop();
  springYRef.current?.stop();
  springXRef.current = undefined;
  springYRef.current = undefined;
};

interface DotPositionSpringsOptions {
  readonly animate: boolean;
  readonly circleRef: RefObject<SVGCircleElement | null>;
  readonly effectiveSpring: SpringConfig;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly size: number;
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
}

const useDotPositionSprings = (options: Readonly<DotPositionSpringsOptions>): void => {
  const { animate, circleRef, effectiveSpring, rectRef, size, visible, x, y } = options;
  const springXRef = useRef<Spring | undefined>(undefined);
  const springYRef = useRef<Spring | undefined>(undefined);

  const ensureSprings = useCallback(() => {
    if (!animate) {return;}
    const springX = springXRef.current ?? createSpring({ damping: effectiveSpring.damping, initial: x, onUpdate: (nx) => { if (circleRef.current) {circleRef.current.setAttribute("cx", String(nx));} if (rectRef.current) {rectRef.current.setAttribute("x", String(nx - size));} }, stiffness: effectiveSpring.stiffness });
    springXRef.current = springX;
    const springY = springYRef.current ?? createSpring({ damping: effectiveSpring.damping, initial: y, onUpdate: (ny) => { if (circleRef.current) {circleRef.current.setAttribute("cy", String(ny));} if (rectRef.current) {rectRef.current.setAttribute("y", String(ny - size));} }, stiffness: effectiveSpring.stiffness });
    springYRef.current = springY;
  }, [animate, circleRef, effectiveSpring, rectRef, size, x, y]);

  // Springs own animated attrs exclusively; React must not set them via JSX.
  // Plain `set()` retargets the in-flight spring without cutting its animation.
  useLayoutEffect((): void => {
    retargetDotSprings({ animate, springXRef, springYRef, visible, x, y });
  }, [animate, visible, x, y]);

  // This effect seeds the springs when the dot appears and tears them down when it hides.
  // It must key on `visible` alone.
  // Position changes are already driven by the position effect above.
  // Re-running here on every x/y would `jump()` the springs and cut the in-flight animation.
  // The other values are read through an EffectEvent so the dependency list is honest.
  // No suppression comment is needed because nothing reactive is omitted.
  // Same pattern the charts use for their `inputsRef` reads.
  const seedDotSprings = useEffectEvent((): boolean => {
    if (!animate) { return false; }
    ensureSprings();
    springXRef.current?.jump(x);
    springYRef.current?.jump(y);
    return true;
  });

  useLayoutEffect((): (() => void) | undefined => {
    if (!visible) { return undefined; }
    const seeded = seedDotSprings();
    if (!seeded) { return undefined; }
    return (): void => {
      stopDotSprings({ springXRef, springYRef });
    };
  }, [visible]);
};

const TooltipDot = ({
  x,
  y,
  visible,
  color,
  size = 5,
  strokeColor = "var(--chart-background)",
  strokeWidth = 2,
  variant = "dot",
  cornerRadiusFraction = 0.25,
  springConfig,
  animate = true,
}: Readonly<TooltipDotProps>): ReactElement | undefined => {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const { fill, stroke } = resolveDotPaint({ color, isRing: variant === "ring", strokeColor });
  // The strokeWidth prop always has a default of 2 by the time it reaches here, so the
  // Ring-specific 1.5 fallback below was already dead; kept as a plain read
  // To preserve the existing (pre-existing-bug) behaviour exactly.
  const effectiveStrokeWidth = strokeWidth;

  const circleRef = useRef<SVGCircleElement | null>(null);
  const rectRef = useRef<SVGRectElement | null>(null);

  useDotPositionSprings({ animate, circleRef, effectiveSpring, rectRef, size, visible, x, y });

  if (!visible) {
    return undefined;
  }

  return (
    <TooltipDotMarker
      animate={animate}
      circleRef={circleRef}
      cornerRadiusFraction={cornerRadiusFraction}
      fill={fill}
      isRing={variant === "ring"}
      rectRef={rectRef}
      size={size}
      stroke={stroke}
      strokeWidth={effectiveStrokeWidth}
      x={x}
      y={y}
    />
  );
};

export { TooltipDot };
export type { TooltipDotProps };
