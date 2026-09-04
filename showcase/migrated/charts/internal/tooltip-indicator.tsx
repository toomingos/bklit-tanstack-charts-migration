import type { ReactElement } from 'react';
import type { SpringConfig } from './chart-config-context';
import type { IndicatorFadeEdges } from './fade-mask';
import type { IndicatorWidth } from "./types";
import { TooltipIndicatorInner } from './tooltip-indicator-inner';

interface TooltipIndicatorProps {
  x: number;
  height: number;
  visible: boolean;
  width?: IndicatorWidth;
  span?: number;
  columnWidth?: number;
  colorEdge?: string;
  colorMid?: string;
  fadeEdges?: IndicatorFadeEdges | boolean;
  fadeLength?: number;
  animate?: boolean;
  gradientId?: string;
  springConfig?: SpringConfig;
  strokeDasharray?: string;
}

const TooltipIndicator = ({
  visible,
  x,
  height,
  width,
  span,
  columnWidth,
  colorEdge,
  colorMid,
  fadeEdges,
  fadeLength,
  animate,
  gradientId,
  springConfig,
  strokeDasharray,
}: Readonly<TooltipIndicatorProps>): ReactElement | undefined => {
  if (!visible) {
    return undefined;
  }
  return (
    <TooltipIndicatorInner
      animate={animate}
      colorEdge={colorEdge}
      colorMid={colorMid}
      columnWidth={columnWidth}
      fadeEdges={fadeEdges}
      fadeLength={fadeLength}
      gradientId={gradientId}
      height={height}
      span={span}
      springConfig={springConfig}
      strokeDasharray={strokeDasharray}
      width={width}
      x={x}
    />
  );
};

export { TooltipIndicator };
export type { TooltipIndicatorProps };
