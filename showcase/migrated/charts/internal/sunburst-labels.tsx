// SunburstLabels — config carrier + SVG label overlay for sunburst segments.
// Extracted from sunburst-chart.tsx (R6 module split).

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
  dimmed?: boolean;
}

// ---------------------------------------------------------------------------
// Labels overlay — SVG layer with rotated <text> elements
// Matches bklit: labels reveal with opacity 0→1 at delay = maxDelay + duration*0.85
// (duration=1.1s, maxDelay from ring-staggered segment delays). Labels also
// cull when !isRelated (unrelated arc) exactly like bklit's !isRelated guard.
// ---------------------------------------------------------------------------

export interface SunburstLabelsOverlayProps {
  items: LabelItem[];
  fullRadius: number;
  size: number;
}

export function SunburstLabelsOverlay({
  items,
  fullRadius: _fullRadius,
  size: _size,
}: SunburstLabelsOverlayProps) {
  if (items.length === 0) return null;

  return (
    <svg
      className="ts-bkm-sunburst-labels"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
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
          style={{
            fill: "var(--chart-label)",
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 600,
            opacity: item.dimmed ? 0.25 : 1,
            transition: "opacity 160ms ease-out",
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
