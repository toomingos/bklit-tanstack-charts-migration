import type { ReactElement, RefObject } from 'react';

interface IndicatorSolidRectProps {
  animate: boolean;
  rectRef: RefObject<SVGRectElement | null>;
  indicatorFill: string;
  pixelWidth: number;
  rectX: number;
  height: number;
}

const IndicatorSolidRect = ({
  animate,
  rectRef,
  indicatorFill,
  pixelWidth,
  rectX,
  height,
}: Readonly<IndicatorSolidRectProps>): ReactElement => {
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

export { IndicatorSolidRect };
