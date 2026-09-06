// Host slot for <Background>: sibling svg pinned to the plot-area origin, behind marks.
import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Background } from "./background";
import type { BackgroundConfig } from "./types";
import { useChartStable } from "./chart-context";

export interface BackgroundLayerProps {
  readonly config: Readonly<BackgroundConfig> | null;
  readonly isLoaded?: boolean;
}

export const BackgroundLayer = ({
  config,
  isLoaded = true,
}: Readonly<BackgroundLayerProps>): ReactElement | undefined => {
  // Plot bounds come from the host scene, never from margin props (V1.2/G6).
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  const innerWidth = plot.width;
  const innerHeight = plot.height;
  const { left: marginLeft, top: marginTop } = margin;
  const layerStyle = useMemo((): CSSProperties => ({
    left: marginLeft,
    overflow: "visible",
    pointerEvents: "none",
    position: "absolute",
    top: marginTop,
    zIndex: -2,
  }), [marginLeft, marginTop]);
  if (!config || innerWidth <= 0 || innerHeight <= 0) {return undefined;}
  return (
    <svg
      aria-hidden="true"
      width={innerWidth}
      height={innerHeight}
      style={layerStyle}
    >
      <Background
        color={config.color}
        complement={config.complement}
        dotFill={config.dotFill}
        fadeHorizontal={config.fadeHorizontal}
        fadeHorizontalLength={config.fadeHorizontalLength}
        fadeVertical={config.fadeVertical}
        fadeVerticalLength={config.fadeVerticalLength}
        fill={config.fill}
        isLoaded={isLoaded}
        opacity={config.opacity}
        pattern={config.pattern}
        radius={config.radius}
        scale={config.scale}
        showFill={config.showFill}
        strokeWidth={config.strokeWidth}
        tileBackground={config.tileBackground}
      />
    </svg>
  );
}
