// bklit-ui XAxis parity: HTML overlay labels (not SVG text), positioned at
// `left: tickX, bottom: 12`, centered, 12px, color var(--chart-label).
// Tick selection replicates x-axis.tsx's default `tickMode="data"` path
// (`buildDataAlignedTicks`): ticks are real points of the RENDERED
// (decimated) data chosen for even on-screen spacing (internal/x-ticks.ts),
// deduped by formatted label — not interpolated domain timestamps. When the
// projection horizon extends the scale past the last data point and there is
// no brush (`xDomain == null`), bklit switches to `buildDomainTicks`
// (x-axis.tsx:433-476, 597-603): evenly interpolated DOMAIN timestamps.
// Brush tail variant `appendProjectionTailTicks` ported in this file per
// bklit x-axis.tsx:494-557,596-624 (keeps data-aligned ticks + tail extras).
import * as React from "react";
import { shortDateFmt } from "./formatters";
import { toDate } from "./coerce-date";
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
  /** Extended x-domain max (ms) — e.g. projection horizon; defaults to the last data point's time. */
  domainMaxTime?: number;
  /** Brushed domain — when present, bklit keeps data-aligned ticks and appends tail extras (x-axis.tsx:596-624). */
  xDomain?: [Date, Date] | null;
}

export function XAxisOverlay({
  data,
  xDataKey,
  rangeStart,
  rangeEnd,
  numTicks,
  formatValue,
  domainMaxTime,
  xDomain,
}: XAxisOverlayProps) {
  const ticks = React.useMemo(() => {
    if (data.length === 0 || rangeEnd <= rangeStart) return [];
    const first = toDate(data[0]?.[xDataKey]);
    const last = toDate(data[data.length - 1]?.[xDataKey]);
    if (!first || !last) return [];
    const startTime = first.getTime();
    const endTime = domainMaxTime ?? last.getTime();
    const timeRange = endTime - startTime;
    const fmt = formatValue ?? ((d: Date) => shortDateFmt.format(d));
    // bklit x-axis.tsx:596-624 — brushed vs un-brushed tail behavior.
    const projectionExtendsPastData = endTime > last.getTime();

    // bklit x-axis.tsx:597-603 — when the projection horizon extends the scale
    // past the last data point (and there is no brush), ticks are evenly
    // interpolated DOMAIN timestamps, not data-aligned picks.
    if (projectionExtendsPastData && xDomain == null && timeRange > 0) {
      const tickCount = Math.max(2, numTicks);
      const seen = new Set<string>();
      const out: Array<{ x: number; label: string }> = [];
      for (let i = 0; i < tickCount; i++) {
        const t = i / (tickCount - 1);
        const date = new Date(startTime + t * timeRange);
        const label = fmt(date);
        if (seen.has(label)) continue;
        seen.add(label);
        out.push({ x: rangeStart + t * (rangeEnd - rangeStart), label });
      }
      return out;
    }

    const dateCache = new Map<number, Date | null>();
    const dateAtCached = (index: number) => {
      if (!dateCache.has(index)) dateCache.set(index, toDate(data[index]?.[xDataKey]));
      return dateCache.get(index)!;
    };
    const xAt = (index: number) => {
      const date = dateAtCached(index);
      if (!date || timeRange <= 0) return rangeStart;
      return (
        rangeStart +
        ((date.getTime() - startTime) / timeRange) * (rangeEnd - rangeStart)
      );
    };
    const labelAt = (index: number) => {
      const date = dateAtCached(index);
      return date ? fmt(date) : undefined;
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
    // bklit x-axis.tsx:494-557,614-624 — when brushed and the domain extends
    // past the last data point, keep data-aligned ticks and append up to 3
    // evenly-spaced tail ticks between last data point and domainEnd, plus a
    // tick exactly at domainEnd (deduped by formatted label, sorted by x).
    if (projectionExtendsPastData && timeRange > 0 && xDomain != null) {
      const appended = appendProjectionTailTicksOverlay(out, data, xDataKey, endTime, startTime, rangeStart, rangeEnd, fmt, numTicks);
      if (appended) return appended;
    }
    return out;
  }, [data, xDataKey, rangeStart, rangeEnd, numTicks, formatValue, domainMaxTime, xDomain]);

function appendProjectionTailTicksOverlay(
  ticks: Array<{ x: number; label: string }>,
  data: ChartDatum[],
  xDataKey: string,
  endTime: number,
  startTime: number,
  rangeStart: number,
  rangeEnd: number,
  fmt: (d: Date) => string,
  numTicks: number,
): Array<{ x: number; label: string }> | null {
  // bklit x-axis.tsx:494-557 — tail between last datum and domainEnd.
  if (data.length === 0) return null;
  const last = toDate(data[data.length - 1]?.[xDataKey]);
  if (!last) return null;
  const lastTime = last.getTime();
  if (endTime <= lastTime) return null;
  const seen = new Set(ticks.map((t) => t.label));
  const extras: Array<{ x: number; label: string }> = [];
  // bklit :527-550, :596-624 — count = min(maxExtraTicks, 3), maxExtraTicks = max(1, numTicks - dataTicks.length + 1)
  const maxExtraTicks = Math.max(1, numTicks - ticks.length + 1);
  const extraCount = Math.min(maxExtraTicks, 3);
  const span = rangeEnd - rangeStart;
  const fullRange = endTime - startTime;
  if (fullRange <= 0 || span <= 0) return null;
  for (let i = 1; i <= extraCount; i++) {
    const date = new Date(lastTime + (i / (extraCount + 1)) * (endTime - lastTime));
    const label = fmt(date);
    if (seen.has(label)) continue;
    seen.add(label);
    const x = rangeStart + ((date.getTime() - startTime) / fullRange) * span;
    extras.push({ x, label });
  }
  const domainEnd = new Date(endTime);
  const endLabel = fmt(domainEnd);
  if (!seen.has(endLabel)) {
    const x = rangeStart + ((endTime - startTime) / fullRange) * span;
    extras.push({ x, label: endLabel });
  }
  if (extras.length === 0) return null;
  return [...ticks, ...extras].sort((a, b) => a.x - b.x);
}

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
