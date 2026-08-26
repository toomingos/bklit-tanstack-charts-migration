// bklit-ui BarXAxis parity: HTML overlay labels (not SVG text), positioned at
// `left: bandCenterX, bottom: 12`, centered, 12px, color var(--chart-label).
// Tick selection is bklit bar-x-axis.tsx's OWN algorithm — modulo thinning
// over the category list (`step = ceil(count / maxLabels)`, keep `i % step
// === 0`) — deliberately NOT `x-ticks.ts`'s even-on-screen-spacing/dedupe-by-
// label optimizer that line/scatter's XAxisOverlay uses: bklit's bar chart
// has its own bespoke, much simpler thinning rule (bar-x-axis.tsx
// `labelsToShow`), and every category here already has a distinct rendered
// bar, so there is nothing to dedupe by label the way decimated line/scatter
// data can produce repeated formatted dates.
import * as React from "react";
import { shortDateFmt } from "./formatters";
import { XAxisLabel } from "./x-axis-overlay";
import type { ChartDatum } from "./types";

export interface BarXAxisOverlayProps {
  data: ChartDatum[];
  xDataKey: string;
  /** Category band scale (d3 scaleBand instance, already ranged). */
  categoryScale: (category: string) => number | undefined;
  bandWidth: number;
  /** categoryAccessor — Date -> shortDateFmt, else String(value). */
  categoryAccessor: (d: ChartDatum) => string;
  marginLeft: number;
  showAllLabels?: boolean;
  maxLabels?: number;
}

export function BarXAxisOverlay({
  data,
  categoryScale,
  bandWidth,
  categoryAccessor,
  marginLeft,
  showAllLabels = false,
  maxLabels = 12,
}: BarXAxisOverlayProps) {
  const labels = React.useMemo(() => {
    const all = data.map((d) => {
      const label = categoryAccessor(d);
      const bandX = categoryScale(label) ?? 0;
      return { label, x: bandX + bandWidth / 2 + marginLeft };
    });
    if (showAllLabels || all.length <= maxLabels) return all;
    const step = Math.ceil(all.length / maxLabels);
    return all.filter((_, i) => i % step === 0);
  }, [data, categoryScale, bandWidth, categoryAccessor, marginLeft, showAllLabels, maxLabels]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {labels.map((item, i) => (
        <XAxisLabel key={`${item.label}-${i}`} x={item.x}>
          {item.label}
        </XAxisLabel>
      ))}
    </div>
  );
}

/** bklit bar-chart.tsx categoryAccessor: shortDateFmt for Date, else String. */
export function barCategoryAccessor(xDataKey: string) {
  return (d: ChartDatum): string => {
    const value = d[xDataKey];
    if (value instanceof Date) return shortDateFmt.format(value);
    return String(value ?? "");
  };
}
