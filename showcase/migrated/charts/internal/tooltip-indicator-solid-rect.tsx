import type { ReactElement, RefObject } from 'react';

interface IndicatorSolidRectProps {
  readonly animate: boolean;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly indicatorFill: string;
  readonly pixelWidth: number;
  readonly rectX: number;
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
