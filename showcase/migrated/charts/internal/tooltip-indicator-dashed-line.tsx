import type { ReactElement, RefObject } from 'react';

interface IndicatorDashedLineProps {
  animate: boolean;
  lineRef: RefObject<SVGLineElement | null>;
  indicatorFill: string;
  strokeDasharray: string;
  pixelWidth: number;
  lineX: number;
  height: number;
}

const IndicatorDashedLine = ({
  animate,
  lineRef,
  indicatorFill,
  strokeDasharray,
  pixelWidth,
  lineX,
  height,
}: Readonly<IndicatorDashedLineProps>): ReactElement => {
  const strokeWidth = Math.max(1, pixelWidth);
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

export { IndicatorDashedLine };
