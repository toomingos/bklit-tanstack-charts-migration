import type { ReactElement, RefObject } from 'react';
import { IndicatorFadeGradientDef } from './tooltip-indicator-gradient';
import type { IndicatorFadeGradientStop } from './fade-mask';

interface IndicatorFadedRectProps {
  readonly animate: boolean;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly gradientId: string;
  readonly fadeStops: readonly IndicatorFadeGradientStop[];
  readonly indicatorFill: string;
  readonly pixelWidth: number;
  readonly rectX: number;
  height: number;
}

const IndicatorFadedRect = ({
  animate,
  rectRef,
  gradientId,
  fadeStops,
  indicatorFill,
  pixelWidth,
  rectX,
  height,
}: Readonly<IndicatorFadedRectProps>): ReactElement => {
  const fill = `url(#${gradientId})`;
  const gradientDef = (
    <defs>
      <IndicatorFadeGradientDef fadeStops={fadeStops} gradientId={gradientId} indicatorFill={indicatorFill} />
    </defs>
  );
  if (animate) {
    return (
      <g>
        {gradientDef}
        <rect ref={rectRef} fill={fill} height={height} width={pixelWidth} y={0} />
      </g>
    );
  }
  return (
    <g>
      {gradientDef}
      <rect fill={fill} height={height} width={pixelWidth} x={rectX} y={0} />
    </g>
  );
};

export { IndicatorFadedRect };
