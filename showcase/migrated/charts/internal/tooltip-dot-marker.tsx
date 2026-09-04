// Static and animated dot-versus-ring marker for the chart tooltip.
// This module keeps one component per file.
// Sizer refs attach directly in JSX instead of crossing a plain helper.
import type { ReactElement, RefObject } from "react";

// Ring corner radius never exceeds half the ring's side length (a full stadium/circle shape).
const RING_CORNER_RADIUS_MAX_FRACTION = 0.5;

const ringCornerRadius = (halfExtent: number, cornerRadiusFraction: number): number => {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(RING_CORNER_RADIUS_MAX_FRACTION, cornerRadiusFraction));
};

interface TooltipDotMarkerProps {
  readonly animate: boolean;
  readonly circleRef: RefObject<SVGCircleElement | null>;
  readonly cornerRadiusFraction: number;
  readonly fill: string;
  readonly isRing: boolean;
  readonly rectRef: RefObject<SVGRectElement | null>;
  readonly size: number;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly x: number;
  readonly y: number;
}

// Springs own the animated attrs exclusively.
// Animated branches bind only the ref and leave position to the spring callbacks.
// Static branches set position directly through React.
const TooltipDotMarker = ({
  animate,
  circleRef,
  cornerRadiusFraction,
  fill,
  isRing,
  rectRef,
  size,
  stroke,
  strokeWidth,
  x,
  y,
}: Readonly<TooltipDotMarkerProps>): ReactElement => {
  if (isRing) {
    const side = size * 2;
    const rx = ringCornerRadius(size, cornerRadiusFraction);
    if (animate) {
      return (
        <rect
          ref={rectRef}
          height={side}
          rx={rx}
          ry={rx}
          width={side}
        />
      );
    }
    return (
      <rect
        height={side}
        rx={rx}
        ry={rx}
        width={side}
        x={x - size}
        y={y - size}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (animate) {
    return <circle ref={circleRef} fill={fill} r={size} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  return <circle cx={x} cy={y} fill={fill} r={size} stroke={stroke} strokeWidth={strokeWidth} />;
};

export { TooltipDotMarker };
export type { TooltipDotMarkerProps };
