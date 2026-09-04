// SunburstLabelsOverlay — SVG label overlay for sunburst segments.
// Split from ./sunburst-labels (react/no-multi-comp): one component per file.

import type { CSSProperties, ReactElement } from "react";

// ---------------------------------------------------------------------------
// Label item (pre-computed by sunburst-chart's layout engine)
// ---------------------------------------------------------------------------

export interface LabelItem {
  x: number;
  y: number;
  deg: number;
  label: string;
  id: string;
}

// ---------------------------------------------------------------------------
// Labels overlay — SVG layer with rotated <text> elements
// Matches bklit: labels reveal with opacity 0→1 at delay = maxDelay + duration*0.85
// (duration=1.1s, maxDelay from ring-staggered segment delays). Unrelated arcs'
// Labels are culled on hover exactly like bklit's !isRelated guard.
// Culling happens in sunburst-chart's labelItems builder, before items reach here.
// ---------------------------------------------------------------------------

export interface SunburstLabelsOverlayProps {
  items: LabelItem[];
  fullRadius: number;
  size: number;
}

// Shared label text paint — one identity for every <text>, not rebuilt per render.
const SUNBURST_LABEL_TEXT_STYLE: Readonly<CSSProperties> = {
  fill: "var(--chart-label)",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 600,
  opacity: 1,
  paintOrder: "stroke",
  stroke: "var(--chart-background)",
  strokeLinejoin: "round",
  strokeWidth: 2.5,
};

export const SunburstLabelsOverlay = ({
  items,
  fullRadius: _fullRadius,
  size: _size,
}: SunburstLabelsOverlayProps): ReactElement | null => {
  if (items.length === 0) {return null;}

  return (
    <svg
      aria-label="Sunburst segment labels"
      className="ts-bkm-sunburst-labels"
      style={{
        height: "100%",
        left: 0,
        overflow: "visible",
        pointerEvents: "none",
        position: "absolute",
        top: 0,
        width: "100%",
      }}
      viewBox={`${-_fullRadius} ${-_fullRadius} ${_size} ${_size}`}
    >
      {items.map((item) => (
        <text
          key={item.id}
          className="ts-bkm-sunburst-label"
          data-label-id={item.id}
          dominantBaseline="middle"
          pointerEvents="none"
          textAnchor="middle"
          transform={`rotate(${item.deg} ${item.x} ${item.y})`}
          x={item.x}
          y={item.y}
          style={SUNBURST_LABEL_TEXT_STYLE}
        >
          {item.label}
        </text>
      ))}
    </svg>
  );
};
