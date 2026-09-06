import type { ReactElement } from 'react';

// The package owns motion (V2.4): x comes from the focus point.
// Timing comes from resolveTooltipSpringTransition; `animate` stays for props.
interface IndicatorSolidRectProps {
  readonly indicatorFill: string;
  readonly pixelWidth: number;
  readonly rectX: number;
  height: number;
}

const IndicatorSolidRect = ({
  indicatorFill,
  pixelWidth,
  rectX,
  height,
}: Readonly<IndicatorSolidRectProps>): ReactElement => (
  <rect
    fill={indicatorFill}
    height={height}
    width={pixelWidth}
    x={rectX}
    y={0}
  />
);

export { IndicatorSolidRect };
