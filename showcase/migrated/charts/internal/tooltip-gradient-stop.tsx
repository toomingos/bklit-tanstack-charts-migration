import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

interface TooltipGradientStopProps {
  readonly fill: string;
  readonly offset: string;
  readonly opacity: number;
}

const TooltipGradientStop = ({
  fill,
  offset,
  opacity,
}: Readonly<TooltipGradientStopProps>): ReactElement => {
  const stopStyle = useMemo((): CSSProperties => ({ stopColor: fill, stopOpacity: opacity }), [fill, opacity]);
  return (
    <stop
      offset={offset}
      style={stopStyle}
    />
  );
};

export { TooltipGradientStop };
export type { TooltipGradientStopProps };
