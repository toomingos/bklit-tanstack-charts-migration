// Hit paths use static base geometry so hover-grow never moves geometry under the pointer.
import type { ReactElement } from "react";

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
      style={{
        height: "100%",
        left: 0,
        overflow: "visible",
        position: "absolute",
        top: 0,
        width: "100%",
      }}
      viewBox={`${-fullRadius} ${-fullRadius} ${size} ${size}`}
    >
      {items.map((item) => (
        <path
          key={item.arcIndex}
          data-bkm-sunburst-hit={item.arcIndex}
          d={item.pathData}
          fill="transparent"
          onClick={() =>{  onHitClick(item.arcIndex); }}
          onPointerEnter={() =>{  onHitEnter(item.arcIndex); }}
          style={{
            cursor: item.hasChildren ? "pointer" : "default",
          }}
        />
      ))}
    </svg>
  );
}

export { SunburstHitLayer };
export type { SunburstHitItem, SunburstHitLayerProps };
