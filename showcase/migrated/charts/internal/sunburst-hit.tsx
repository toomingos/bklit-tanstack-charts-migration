// SunburstHitLayer — bklit-parity hit-testing layer for the sunburst.
//
// bklit's SunburstSegment renders TWO paths per arc: a transparent fill-only
// hit path at BASE (ungrown) geometry that carries the pointer handlers, and
// the visual path with pointer-events:none. Hover therefore resolves against
// static geometry — hover-grow never moves geometry under the pointer — and
// the missing stroke means Chrome's hit test misses the exact shared-boundary
// ray exactly like bklit's does.
//
// The migrated chart's visual arcs are TanStack-rendered (hover grow baked
// into the pipeline, 1px stroke), so they can't carry the hit role. This
// overlay reproduces bklit's hit layer instead: transparent paths, no stroke,
// base geometry (zoom-morphed during zoom, like bklit's transitionGeometry
// base), depth-descending DOM order so parent segments win boundary
// hit-testing (bklit's sortSunburstSegments comment).

import type { PointerEvent as ReactPointerEvent } from "react";

export interface SunburstHitItem {
  arcIndex: number;
  d: string;
  hasChildren: boolean;
}

export interface SunburstHitLayerProps {
  items: SunburstHitItem[];
  fullRadius: number;
  size: number;
  onHitEnter: (arcIndex: number) => void;
  onHitLeaveAll: () => void;
  onHitClick: (arcIndex: number) => void;
}

export function SunburstHitLayer({
  items,
  fullRadius,
  size,
  onHitEnter,
  onHitLeaveAll,
  onHitClick,
}: SunburstHitLayerProps) {
  if (items.length === 0) return null;
  return (
    <svg
      className="ts-bkm-sunburst-hit"
      onPointerLeave={onHitLeaveAll}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
      }}
      viewBox={`${-fullRadius} ${-fullRadius} ${size} ${size}`}
    >
      {items.map((item) => (
        <path
          key={item.arcIndex}
          data-bkm-sunburst-hit={item.arcIndex}
          d={item.d}
          fill="transparent"
          onClick={() => onHitClick(item.arcIndex)}
          onPointerEnter={(e: ReactPointerEvent<SVGPathElement>) =>
            onHitEnter(item.arcIndex)
          }
          style={{
            cursor: item.hasChildren ? "pointer" : "default",
          }}
        />
      ))}
    </svg>
  );
}
