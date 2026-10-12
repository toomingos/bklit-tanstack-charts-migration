// The x scale of the cartesian definition: tick placement (data rows or evenly over the domain), labels and the tick times the
// date pill's tick-blanking CSS reads.
import { scaleUtc } from "../scales";
import { shortDateFmt } from "../format";
import { X_TICK_PADDING } from "../theme";
import { strictRows } from "./domains";
import type { CartesianInput } from "./input";
import { toDate } from "./series";
import type { Row } from "./series";
import { withPillGeometry } from "./date-pill";
import type { PillTicks } from "./date-pill";
import { selectEvenlySpacedIndices } from "./tick-layout";

export interface XAxisProps {
  numTicks?: number;
  tickMode?: "domain" | "data";
  tickerHalfWidth?: number;
  formatValue?: (value: Date) => string;
}

/** Evenly spaced data-row indices, first and last included (bklit `tickMode="data"`). */
export function dataTickValues(rows: readonly Row[], xKey: string, count: number, brushed?: readonly [Date, Date]): Date[] {
  if (rows.length === 0) {
    return [];
  }
  // bklit buildDataAlignedTicks: the even-spacing search over the rows (the brushed window's rows when brushed).
  const times = rows.map((row) => toDate(row[xKey]).getTime());
  const labels = times.map((t) => shortDateFmt.format(new Date(t)));
  const picked = selectEvenlySpacedIndices(rows.length, count, labels, (i) => times[i] ?? 0);
  const seen = new Set<string>();
  const out: Date[] = [];
  for (const index of picked) {
    const label = labels[index];
    if (!seen.has(label)) {
      seen.add(label);
      out.push(new Date(times[index]));
    }
  }
  if (brushed) {
    // bklit appendProjectionTailTicks: a window ending past its last row gets labels in that tail (mid-points, then the end).
    const lastTime = times.at(-1);
    const endTime = Math.max(brushed[0].getTime(), brushed[1].getTime());
    if (lastTime !== undefined && endTime > lastTime) {
      const extraCount = Math.min(Math.max(1, count - out.length + 1), 3);
      for (let i = 1; i <= extraCount; i += 1) {
        const date = new Date(lastTime + (i / (extraCount + 1)) * (endTime - lastTime));
        const label = shortDateFmt.format(date);
        if (!seen.has(label)) {
          seen.add(label);
          out.push(date);
        }
      }
      const endLabel = shortDateFmt.format(new Date(endTime));
      if (!seen.has(endLabel)) {
        out.push(new Date(endTime));
      }
    }
  }
  return out;
}

type XTicks = { values: Date[]; count?: undefined } | { count: number; values?: undefined };

function evenDomainTicks(domain: readonly [Date, Date], tickCount: number): Date[] {
  const [d0, d1] = domain;
  const steps = Math.max(1, tickCount - 1);
  return Array.from({ length: tickCount }, (_unused, i) => new Date(d0.getTime() + ((d1.getTime() - d0.getTime()) * i) / steps));
}

interface XScaleInput {
  readonly input: CartesianInput;
  readonly rows: readonly Row[];
  readonly xAxis: XAxisProps | undefined;
  /** The resolved x domain (the brushed window, else the data and overlay extent). */
  readonly xDomain: [Date, Date] | undefined;
  /** An overlay (projection, ...) widens the domain past the data: bklit then spaces ticks evenly over the domain. */
  readonly overlaysWidenX: boolean;
  /** The date pill hides the tick labels it would cover, so the tick times are needed. */
  readonly pillActive: boolean;
}

function xTickSpec(args: XScaleInput, tickCount: number): XTicks {
  const { input, rows, xAxis, xDomain } = args;
  if (args.overlaysWidenX && xDomain) {
    return { values: evenDomainTicks(xDomain, tickCount) };
  }
  if (xAxis?.tickMode === "domain") {
    return { count: tickCount };
  }
  return { values: dataTickValues(input.xDomain ? strictRows(rows, input.xKey, input.xDomain) : rows, input.xKey, tickCount, input.xDomain) };
}

function tickTimesOf(ticks: XTicks, xDomain: [Date, Date] | undefined): number[] {
  if (ticks.values) {
    return ticks.values.map((d) => d.getTime());
  }
  return xDomain ? scaleUtc().domain(xDomain).ticks(ticks.count ?? 5).map((d) => d.getTime()) : [];
}

interface XScale {
  readonly scale: Record<string, unknown>;
  readonly tickTimes: PillTicks;
}

/** The `scales.x` option and the tick times (ms) the pill's blanking CSS reads (empty unless the pill is active). */
export function buildXScale(args: XScaleInput): XScale {
  const { input, xAxis, xDomain } = args;
  const tickCount = xAxis?.numTicks ?? 5;
  const xTicks = xTickSpec(args, tickCount);
  // bklit's labels hang a fixed 12px above the host's bottom edge whatever the plot is; the renderer floors the plot at 1px,
  // so a host shorter than its margins would push them below it. Pull them back by the lost height.
  const xLabelLift = Math.min(0, (input.plotHeight ?? 1) - 1);
  const formatX = xAxis?.formatValue ?? ((d: Date): string => shortDateFmt.format(d));
  const times = args.pillActive ? tickTimesOf(xTicks, xDomain) : [];
  // x layout for the pill's tick-opacity ramp (date-pill.ts pillTickStaticCss reads it off the array).
  const tickTimes: PillTicks = args.pillActive && xDomain ? withPillGeometry(times, { plotLeft: input.margin.left, domainStart: xDomain[0].getTime() }) : times;
  const scale = {
    scale: scaleUtc().domain(xDomain ?? [new Date(0), new Date(1)]),
    grid: false,
    axis: xAxis === undefined
      ? false
      : { line: false, ticks: { ...xTicks, size: 0, padding: X_TICK_PADDING, format: formatX }, tickLabels: { fontSize: 12, opacity: 1, thin: false, ...(xLabelLift < 0 ? { dy: xLabelLift } : null), ...(input.xDomain ? { motion: false } : null) } },
  };
  return { scale, tickTimes };
}
