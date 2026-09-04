// Host slot for <Background>: sibling svg pinned to the plot-area origin, behind marks.
import * as React from "react";
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
}: Readonly<BackgroundLayerProps>): React.ReactElement | undefined => {
  if (!config || innerWidth <= 0 || innerHeight <= 0) {return undefined;}
  return (
    <svg
      aria-hidden="true"
      width={innerWidth}
      height={innerHeight}
      style={{
        left: marginLeft,
        overflow: "visible",
        pointerEvents: "none",
        position: "absolute",
        top: marginTop,
        zIndex: -2,
      }}
    >
      <Background {...config} width={innerWidth} height={innerHeight} isLoaded={isLoaded} />
    </svg>
  );
}
