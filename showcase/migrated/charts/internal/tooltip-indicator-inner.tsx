import type { ReactElement } from 'react';
import { indicatorFadeGradientStops } from './fade-mask';
import { computeIndicatorGeometry, computeIndicatorRenderMode } from './tooltip-indicator-geometry';
import type { IndicatorRenderMode } from './tooltip-indicator-geometry';
import { IndicatorDashedLine } from './tooltip-indicator-dashed-line';
import { IndicatorSolidRect } from './tooltip-indicator-solid-rect';
import { IndicatorFadedRect } from './tooltip-indicator-faded-rect';
import type { TooltipIndicatorProps } from './tooltip-indicator';

type TooltipIndicatorInnerProps = Omit<TooltipIndicatorProps, "visible">;

interface IndicatorElementParams {
  readonly fadeLength: number;
  readonly gradientId: string;
  readonly height: number;
  readonly indicatorFill: string;
  readonly lineX: number;
  readonly pixelWidth: number;
  readonly rectX: number;
  readonly renderMode: Readonly<IndicatorRenderMode>;
}

// The package owns motion (V2.4): x arrives from the focus point.
// Legacy spring numbers map onto the package transition in focus-marks.ts.
const renderIndicatorElement = (params: Readonly<IndicatorElementParams>): ReactElement => {
  const { fadeLength, gradientId, height, indicatorFill, lineX, pixelWidth, rectX, renderMode } = params;
  const { fadeSides, resolvedDasharray } = renderMode;
  if (resolvedDasharray !== undefined) {
    return (
      <IndicatorDashedLine
        height={height}
        indicatorFill={indicatorFill}
        lineX={lineX}
        pixelWidth={pixelWidth}
        strokeDasharray={resolvedDasharray}
      />
    );
  }
  if (!fadeSides.any) {
    return (
      <IndicatorSolidRect
        height={height}
        indicatorFill={indicatorFill}
        pixelWidth={pixelWidth}
        rectX={rectX}
      />
    );
  }
  const fadeStops = indicatorFadeGradientStops(fadeSides, fadeLength);
  return (
    <IndicatorFadedRect
      fadeStops={fadeStops}
      gradientId={gradientId}
      height={height}
      indicatorFill={indicatorFill}
      pixelWidth={pixelWidth}
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
  gradientId = "tooltip-indicator-gradient",
  strokeDasharray,
}: Readonly<TooltipIndicatorInnerProps>): ReactElement => {
  const { pixelWidth, rectX, lineX } = computeIndicatorGeometry({ columnWidth, span, width, x });

  const indicatorFill = colorMid || colorEdge;
  const renderMode = computeIndicatorRenderMode(strokeDasharray, fadeEdges);

  return renderIndicatorElement({ fadeLength, gradientId, height, indicatorFill, lineX, pixelWidth, rectX, renderMode });
};

export { TooltipIndicatorInner };
export type { TooltipIndicatorInnerProps };
