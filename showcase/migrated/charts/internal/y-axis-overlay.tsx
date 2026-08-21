// bklit-ui YAxis parity: HTML overlay labels (not SVG text, not a React
// portal — plain absolutely-positioned div sibling, same convention as
// `x-axis-overlay.tsx`), positioned at each tick's own y pixel.
import * as React from "react";
import { scaleLinear } from "d3-scale";
import { resolveYAxisTickCount } from "./y-axis-ticks";

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
  tickColorForValue?: (value: number) => string | undefined;
}

function formatTick(
  value: number,
  formatValue: ((value: number) => string) | undefined,
  formatLargeNumbers: boolean,
): string {
  // bklit y-axis.tsx `formatLabel` verbatim: formatValue overrides, else
  // large numbers compact to `${(v/1000).toFixed(0)}k`. (The previous
  // migrated `formatTick` added an "M" branch and `toFixed(1)` decimals that
  // bklit does not have — removed for parity.)
  if (formatValue) return formatValue(value);
  if (formatLargeNumbers && value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return String(value);
}

export function YAxisOverlay({
  ticks: precomputedTicks,
  marginLeft: _marginLeft,
  yDomain,
  chartTop = 0,
  chartBottom = 0,
  chartLeft = 0,
  chartRight = 0,
  orientation = "left",
  numTicks = 5,
  formatLargeNumbers = true,
  formatValue,
  tickColorForValue,
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
    // bklit y-axis.tsx: `yScale.ticks(resolveYAxisTickCount(numTicks))` — the
    // tick-count hint is clamped to 1–10 before d3's own nicening.
    return scale.ticks(resolveYAxisTickCount(numTicks)).map((value) => ({
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
              color: tickColorForValue?.(tick.value) ?? "var(--color-chart-label, var(--chart-label))",
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
