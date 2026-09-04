// Host slot for <Background>: sibling svg pinned to the plot-area origin, behind marks.
import { useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Background } from "./background";
import type { BackgroundConfig } from "./types";

export interface BackgroundLayerProps {
  readonly config: Readonly<BackgroundConfig> | null;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly isLoaded?: boolean;
}

export const BackgroundLayer = ({
  config,
  innerWidth,
  innerHeight,
  marginLeft,
  marginTop,
  isLoaded = true,
}: Readonly<BackgroundLayerProps>): ReactElement | undefined => {
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
      <Background {...config} width={innerWidth} height={innerHeight} isLoaded={isLoaded} />
    </svg>
  );
}
