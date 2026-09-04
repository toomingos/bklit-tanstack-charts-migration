// Hit paths use static base geometry so hover-grow never moves geometry under the pointer.
import type { ReactElement } from "react";
import { SunburstHitPath } from "./sunburst-hit-path";

interface SunburstHitItem {
  readonly arcIndex: number;
  readonly pathData: string;
  readonly hasChildren: boolean;
}

interface SunburstHitLayerProps {
  readonly items: readonly SunburstHitItem[];
  readonly fullRadius: number;
  readonly size: number;
  readonly onHitEnter: (arcIndex: number) => void;
  readonly onHitLeaveAll: () => void;
  readonly onHitClick: (arcIndex: number) => void;
}

const SUNBURST_HIT_SVG_STYLE = {
  height: "100%",
  left: 0,
  overflow: "visible",
  position: "absolute",
  top: 0,
  width: "100%",
} as const;

const SunburstHitLayer = ({
  items,
  fullRadius,
  size,
  onHitEnter,
  onHitLeaveAll,
  onHitClick,
}: Readonly<SunburstHitLayerProps>): ReactElement | undefined => {
  if (items.length === 0) {return undefined;}
  return (
    <svg
      aria-hidden="true"
      className="ts-bkm-sunburst-hit"
      onPointerLeave={onHitLeaveAll}
      style={SUNBURST_HIT_SVG_STYLE}
      viewBox={`${-fullRadius} ${-fullRadius} ${size} ${size}`}
    >
      {items.map((item) => (
        <SunburstHitPath
          arcIndex={item.arcIndex}
          hasChildren={item.hasChildren}
          key={item.arcIndex}
          onHitClick={onHitClick}
          onHitEnter={onHitEnter}
          pathData={item.pathData}
        />
      ))}
    </svg>
  );
}

export { SunburstHitLayer };
export type { SunburstHitItem, SunburstHitLayerProps };
