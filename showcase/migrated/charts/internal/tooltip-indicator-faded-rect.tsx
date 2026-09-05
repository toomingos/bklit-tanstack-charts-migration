import type { ReactElement } from 'react';
import { IndicatorFadeGradientDef } from './tooltip-indicator-gradient';
import type { IndicatorFadeGradientStop } from './fade-mask';

// The package owns motion (V2.4): x comes from the focus point.
// Timing comes from resolveTooltipSpringTransition; `animate` stays for props.
interface IndicatorFadedRectProps {
  readonly animate: boolean;
  readonly gradientId: string;
  readonly fadeStops: readonly IndicatorFadeGradientStop[];
  readonly indicatorFill: string;
  readonly pixelWidth: number;
  readonly rectX: number;
  height: number;
}

const IndicatorFadedRect = ({
  gradientId,
  fadeStops,
  indicatorFill,
  pixelWidth,
  rectX,
  height,
}: Readonly<IndicatorFadedRectProps>): ReactElement => (
  <g>
    <defs>
      <IndicatorFadeGradientDef fadeStops={fadeStops} gradientId={gradientId} indicatorFill={indicatorFill} />
    </defs>
    <rect fill={`url(#${gradientId})`} height={height} width={pixelWidth} x={rectX} y={0} />
  </g>
);

export { IndicatorFadedRect };
