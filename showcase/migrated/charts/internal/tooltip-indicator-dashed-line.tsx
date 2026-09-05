import type { ReactElement } from 'react';

// The package owns motion (V2.4): x comes from the focus point.
// Timing comes from resolveTooltipSpringTransition; `animate` stays for props.
interface IndicatorDashedLineProps {
  readonly animate: boolean;
  readonly indicatorFill: string;
  readonly strokeDasharray: string;
  readonly pixelWidth: number;
  readonly lineX: number;
  height: number;
}

const IndicatorDashedLine = ({
  indicatorFill,
  strokeDasharray,
  pixelWidth,
  lineX,
  height,
}: Readonly<IndicatorDashedLineProps>): ReactElement => {
  const strokeWidth = Math.max(1, pixelWidth);
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

export { IndicatorDashedLine };
