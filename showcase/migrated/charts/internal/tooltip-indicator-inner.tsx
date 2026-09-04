import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ReactElement, RefObject } from 'react';
import { createSpring } from './spring';
import type { Spring } from './spring';
import { useChartConfig } from './use-chart-config';
import { indicatorFadeGradientStops } from './fade-mask';
import { computeIndicatorGeometry, computeIndicatorRenderMode } from './tooltip-indicator-geometry';
import type { IndicatorRenderMode } from './tooltip-indicator-geometry';
import { IndicatorDashedLine } from './tooltip-indicator-dashed-line';
import { IndicatorSolidRect } from './tooltip-indicator-solid-rect';
import { IndicatorFadedRect } from './tooltip-indicator-faded-rect';
import type { TooltipIndicatorProps } from './tooltip-indicator';

type TooltipIndicatorInnerProps = Omit<TooltipIndicatorProps, "visible">;

interface IndicatorSpringConfig {
  readonly damping: number;
  readonly stiffness: number;
}

interface IndicatorSpringParams {
  readonly animate: boolean;
  readonly effectiveSpring: IndicatorSpringConfig;
  readonly lineX: number;
  readonly rectX: number;
}

interface IndicatorSpringRefs {
  readonly lineRef: RefObject<SVGLineElement | null>;
  readonly rectRef: RefObject<SVGRectElement | null>;
}

interface IndicatorSpringSyncParams {
  readonly animate: boolean;
  readonly lineSpringRef: RefObject<Spring | undefined>;
  readonly lineX: number;
  readonly rectSpringRef: RefObject<Spring | undefined>;
  readonly rectX: number;
}

// Load-bearing: springs must receive this render's target before paint, not
// After — deferring to an effect would show a one-frame-stale position.
// Mirrors the identical pattern in TooltipDot.
const syncIndicatorSprings = (params: Readonly<IndicatorSpringSyncParams>): void => {
  const { animate, lineSpringRef, lineX, rectSpringRef, rectX } = params;
  if (animate && rectSpringRef.current && lineSpringRef.current) {
    rectSpringRef.current.set(rectX);
    lineSpringRef.current.set(lineX);
  }
};

// Owns the imperative WAAPI springs (rect x + line x1/x2) behind the indicator.
const useIndicatorSprings = (params: Readonly<IndicatorSpringParams>): IndicatorSpringRefs => {
  const { animate, effectiveSpring, lineX, rectX } = params;
  const rectRef = useRef<SVGRectElement | null>(null);
  const lineRef = useRef<SVGLineElement | null>(null);
  const rectSpringRef = useRef<Spring | undefined>(undefined);
  const lineSpringRef = useRef<Spring | undefined>(undefined);

  const ensureSprings = useCallback(() => {
    if (!animate) {return;}
    const rectSpring = rectSpringRef.current ?? createSpring({ damping: effectiveSpring.damping, initial: rectX, onUpdate: (nx) => { rectRef.current?.setAttribute("x", String(nx)); }, stiffness: effectiveSpring.stiffness });
    rectSpringRef.current = rectSpring;
    const lineSpring = lineSpringRef.current ?? createSpring({ damping: effectiveSpring.damping, initial: lineX, onUpdate: (nx) => { lineRef.current?.setAttribute("x1", String(nx)); lineRef.current?.setAttribute("x2", String(nx)); }, stiffness: effectiveSpring.stiffness });
    lineSpringRef.current = lineSpring;
  }, [animate, effectiveSpring, lineX, rectX]);

  // Pre-paint retarget in a layout effect (never during render), mirroring
  // TooltipDot's position effect: same frame, honest deps, springs stay live.
  useLayoutEffect(() => {
    syncIndicatorSprings({ animate, lineSpringRef, lineX, rectSpringRef, rectX });
  }, [animate, lineX, rectX]);

  useLayoutEffect(() => {
    if (!animate) {return;}
    ensureSprings();
    rectSpringRef.current?.jump(rectX);
    lineSpringRef.current?.jump(lineX);
  });

  return { lineRef, rectRef };
};

interface IndicatorElementParams {
  readonly animate: boolean;
  readonly fadeLength: number;
  readonly gradientId: string;
  readonly height: number;
  readonly indicatorFill: string;
  readonly lineRef: RefObject<SVGLineElement | null>;
  readonly lineX: number;
  readonly pixelWidth: number;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly rectX: number;
  readonly renderMode: Readonly<IndicatorRenderMode>;
}

// Selects the indicator variant: dashed line, solid rect, or edge-faded rect.
// Plain function (not a component), inlined into the caller's tree.
// Reconciliation is unchanged.
const renderIndicatorElement = (params: Readonly<IndicatorElementParams>): ReactElement => {
  const { animate, fadeLength, gradientId, height, indicatorFill, lineRef, lineX, pixelWidth, rectRef, rectX, renderMode } = params;
  const { fadeSides, resolvedDasharray } = renderMode;
  if (resolvedDasharray !== undefined) {
    return (
      <IndicatorDashedLine
        animate={animate}
        height={height}
        indicatorFill={indicatorFill}
        lineRef={lineRef}
        lineX={lineX}
        pixelWidth={pixelWidth}
        strokeDasharray={resolvedDasharray}
      />
    );
  }
  if (!fadeSides.any) {
    return (
      <IndicatorSolidRect
        animate={animate}
        height={height}
        indicatorFill={indicatorFill}
        pixelWidth={pixelWidth}
        rectRef={rectRef}
        rectX={rectX}
      />
    );
  }
  const fadeStops = indicatorFadeGradientStops(fadeSides, fadeLength);
  return (
    <IndicatorFadedRect
      animate={animate}
      fadeStops={fadeStops}
      gradientId={gradientId}
      height={height}
      indicatorFill={indicatorFill}
      pixelWidth={pixelWidth}
      rectRef={rectRef}
      rectX={rectX}
    />
  );
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
  fadeLength = 10,
  animate = true,
  gradientId = "tooltip-indicator-gradient",
  springConfig,
  strokeDasharray,
}: Readonly<TooltipIndicatorInnerProps>): ReactElement => {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;

  const { pixelWidth, rectX, lineX } = computeIndicatorGeometry({ columnWidth, span, width, x });

  const { lineRef, rectRef } = useIndicatorSprings({ animate, effectiveSpring, lineX, rectX });

  const indicatorFill = colorMid || colorEdge;
  const renderMode = computeIndicatorRenderMode(strokeDasharray, fadeEdges);

  return renderIndicatorElement({ animate, fadeLength, gradientId, height, indicatorFill, lineRef, lineX, pixelWidth, rectRef, rectX, renderMode });
};

export { TooltipIndicatorInner };
export type { TooltipIndicatorInnerProps };
