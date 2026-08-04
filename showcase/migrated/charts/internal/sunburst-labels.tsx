// SunburstLabels — config carrier + SVG label overlay for sunburst segments.
// Extracted from sunburst-chart.tsx (R6 module split).

import { type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Config carrier — returns null, classified by displayName in sunburst-chart
// ---------------------------------------------------------------------------

export interface SunburstLabelsProps {
  fontSize?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

export function SunburstLabels(_props: SunburstLabelsProps): null {
  return null;
}

SunburstLabels.displayName = "SunburstLabels";

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
// ---------------------------------------------------------------------------

export interface SunburstLabelsOverlayProps {
  items: LabelItem[];
  fullRadius: number;
  size: number;
}

export function SunburstLabelsOverlay({
  items,
  fullRadius,
  size,
}: SunburstLabelsOverlayProps) {
  if (items.length === 0) return null;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
      viewBox={`${-fullRadius} ${-fullRadius} ${size} ${size}`}
    >
      {items.map((item) => (
        <text
          key={item.id}
          dominantBaseline="middle"
          pointerEvents="none"
          textAnchor="middle"
          transform={`rotate(${item.deg} ${item.x} ${item.y})`}
          x={item.x}
          y={item.y}
          style={{
            fill: "var(--chart-label)",
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 600,
            opacity: 1,
            paintOrder: "stroke",
            stroke: "var(--chart-background)",
            strokeLinejoin: "round",
            strokeWidth: 2.5,
          }}
        >
          {item.label}
        </text>
      ))}
    </svg>
  );
}
