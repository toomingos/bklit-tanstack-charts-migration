// bklit-ui YAxis parity: HTML overlay labels (not SVG text, not a React
// portal — plain absolutely-positioned div sibling, same convention as
// `x-axis-overlay.tsx`), positioned at each tick's own y pixel.
import * as React from "react";
import { scaleLinear } from "d3-scale";

export interface YAxisOverlayProps {
  // --- Pre-computed ticks (candlestick-chart.tsx backward compat) ---
  /** Tick values in DOMAIN space (already resolved via the stashed y scale). */
  ticks?: Array<{ value: number; y: number }>;
  /** Width of the left margin gutter this overlay occupies. */
  marginLeft?: number;

  // --- Auto-computed ticks (line-chart.tsx — takes domain, computes ticks) ---
  yDomain?: [number, number];
  chartTop?: number;
  chartBottom?: number;
  chartLeft?: number;
  chartRight?: number;
  orientation?: "left" | "right";
  numTicks?: number;
  formatLargeNumbers?: boolean;
  formatValue?: (value: number) => string;
}

function formatTick(
  value: number,
  formatValue: ((value: number) => string) | undefined,
  formatLargeNumbers: boolean,
): string {
  if (formatValue) return formatValue(value);
  if (formatLargeNumbers) {
    if (value >= 1_000_000) {
      const scaled = value / 1_000_000;
      return scaled % 1 === 0 ? `${scaled}M` : `${scaled.toFixed(1)}M`;
    }
    if (value >= 1000) {
      const scaled = value / 1000;
      return scaled % 1 === 0 ? `${scaled}k` : `${scaled.toFixed(1)}k`;
    }
  }
  return String(value);
}

export function YAxisOverlay({
  ticks: precomputedTicks,
  marginLeft,
  yDomain,
  chartTop = 0,
  chartBottom = 0,
  chartLeft = 0,
  chartRight = 0,
  orientation = "left",
  numTicks = 5,
  formatLargeNumbers = true,
  formatValue,
}: YAxisOverlayProps) {
  // If pre-computed ticks are provided, use those (candlestick backward compat).
  // Otherwise compute them from yDomain and chart dimensions (line-chart path).
  const ticks: Array<{ value: number; y: number }> = React.useMemo(() => {
    if (precomputedTicks) return precomputedTicks;
    if (!yDomain || chartBottom <= chartTop) return [];
    const scale = scaleLinear()
      .domain(yDomain)
      .range([chartBottom, chartTop])
      .nice();
    return scale.ticks(numTicks).map((value) => ({
      value,
      y: scale(value) ?? 0,
    }));
  }, [precomputedTicks, yDomain, chartTop, chartBottom, numTicks]);

  const isLeft = orientation === "left";

  // Left orientation: overlay sits in left margin gutter, labels right-aligned.
  // Right orientation: overlay sits in right margin gutter, labels left-aligned.
  const containerStyle: React.CSSProperties = isLeft
    ? {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width: chartLeft,
        pointerEvents: "none",
      }
    : {
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        width: chartRight,
        pointerEvents: "none",
      };

  const labelWrapperStyle = (
    tickY: number,
  ): React.CSSProperties => ({
    position: "absolute",
    top: tickY,
    left: 0,
    right: 0,
    transform: "translateY(-50%)",
    display: "flex",
    justifyContent: isLeft ? "flex-end" : "flex-start",
    paddingRight: isLeft ? 8 : 0,
    paddingLeft: isLeft ? 0 : 8,
  });

  return (
    <div style={containerStyle}>
      {ticks.map((tick) => (
        <div key={tick.value} style={labelWrapperStyle(tick.y)}>
          <span
            style={{
              fontSize: 12,
              lineHeight: "1rem",
              color: "var(--color-chart-label, var(--chart-label))",
              whiteSpace: "nowrap",
            }}
          >
            {formatTick(tick.value, formatValue, formatLargeNumbers)}
          </span>
        </div>
      ))}
    </div>
  );
}
