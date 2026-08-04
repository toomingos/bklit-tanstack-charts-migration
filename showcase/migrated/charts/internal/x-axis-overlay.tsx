// bklit-ui XAxis parity: HTML overlay labels (not SVG text), positioned at
// `left: tickX, bottom: 12`, centered, 12px, color var(--chart-label).
// Tick selection replicates x-axis.tsx's default `tickMode="data"` path
// (`buildDataAlignedTicks`): ticks are real points of the RENDERED
// (decimated) data chosen for even on-screen spacing (internal/x-ticks.ts),
// deduped by formatted label — not interpolated domain timestamps.
import * as React from "react";
import { shortDateFmt } from "./formatters";
import type { ChartDatum } from "./types";
import { selectEvenlySpacedIndices } from "./x-ticks";

export interface XAxisOverlayProps {
  /** Rendered (decimated) data — ticks land on real points of this array. */
  data: ChartDatum[];
  xDataKey: string;
  rangeStart: number; // margin.left
  rangeEnd: number; // width - margin.right
  numTicks: number;
  formatValue?: (value: Date) => string;
}

export function XAxisOverlay({
  data,
  xDataKey,
  rangeStart,
  rangeEnd,
  numTicks,
  formatValue,
}: XAxisOverlayProps) {
  const ticks = React.useMemo(() => {
    if (data.length === 0 || rangeEnd <= rangeStart) return [];
    const first = data[0]?.[xDataKey];
    const last = data[data.length - 1]?.[xDataKey];
    if (!(first instanceof Date && last instanceof Date)) return [];
    const startTime = first.getTime();
    const timeRange = last.getTime() - startTime;
    const fmt = formatValue ?? ((d: Date) => shortDateFmt.format(d));

    const dateAt = (index: number) => {
      const value = data[index]?.[xDataKey];
      return value instanceof Date ? value : null;
    };
    const xAt = (index: number) => {
      const date = dateAt(index);
      if (!date || timeRange <= 0) return rangeStart;
      return (
        rangeStart +
        ((date.getTime() - startTime) / timeRange) * (rangeEnd - rangeStart)
      );
    };
    const labelCache = new Map<number, string | undefined>();
    const labelAt = (index: number) => {
      if (!labelCache.has(index)) {
        const date = dateAt(index);
        labelCache.set(index, date ? fmt(date) : undefined);
      }
      return labelCache.get(index);
    };

    const indices = selectEvenlySpacedIndices(data.length, numTicks, {
      labelForIndex: labelAt,
      resolveXPx: xAt,
    });

    // buildDataAlignedTicks: final pass dedupes by label again.
    const seen = new Set<string>();
    const out: Array<{ x: number; label: string }> = [];
    for (const index of indices) {
      const label = labelAt(index);
      if (label === undefined || seen.has(label)) continue;
      seen.add(label);
      out.push({ x: xAt(index), label });
    }
    return out;
  }, [data, xDataKey, rangeStart, rangeEnd, numTicks, formatValue]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {ticks.map((tick) => (
        <div
          key={tick.label}
          style={{
            position: "absolute",
            left: tick.x,
            bottom: 12,
            width: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <span
            // Read by hover-chrome.ts to fade labels near the date pill
            // (bklit XAxisLabel: opacity transition 0.4s ease-in-out).
            data-bkm-xlabel=""
            data-bkm-x={tick.x}
            style={{
              whiteSpace: "nowrap",
              fontSize: 12,
              lineHeight: "1rem",
              color: "var(--color-chart-label, var(--chart-label))",
              transition: "opacity 0.4s ease-in-out",
            }}
          >
            {tick.label}
          </span>
        </div>
      ))}
    </div>
  );
}
