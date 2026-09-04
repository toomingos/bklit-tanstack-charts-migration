import { toDate } from "./coerce-date";
import { shortDateFmt } from "./formatters";
import { selectEvenlySpacedIndices } from "./tick-layout";
import type { ChartDatum } from "./types";

// Max tail ticks appended past the last data point when the domain projects forward.
const MAX_PROJECTION_TAIL_TICKS = 3;

interface XAxisTickValue {
  readonly value: Readonly<Date>;
  readonly label: string;
}

interface XAxisTickInput {
  data: readonly Readonly<ChartDatum>[];
  xDataKey: string;
  rangeStart: number;
  rangeEnd: number;
  numTicks: number;
  formatValue?: (value: Readonly<Date>) => string;
  domainMaxTime?: number;
  xDomain?: readonly [Readonly<Date>, Readonly<Date>] | null;
  /** `"data"` (default) snaps ticks to rendered rows; `"domain"` uses evenly interpolated timestamps. */
  tickMode?: "domain" | "data";
}

interface XAxisTimeRange {
  readonly startTime: number;
  readonly endTime: number;
  readonly timeRange: number;
  readonly lastTime: number;
  readonly projectionExtendsPastData: boolean;
}

const resolveXAxisTimeRange = (params: Readonly<{ data: readonly Readonly<ChartDatum>[]; xDataKey: string; domainMaxTime?: number }>): XAxisTimeRange | undefined => {
  const first = toDate(params.data[0]?.[params.xDataKey]);
  const last = toDate(params.data.at(-1)?.[params.xDataKey]);
  if (!first || !last) {return undefined;}
  const startTime = first.getTime();
  const endTime = params.domainMaxTime ?? last.getTime();
  return {
    endTime,
    lastTime: last.getTime(),
    projectionExtendsPastData: endTime > last.getTime(),
    startTime,
    timeRange: endTime - startTime,
  };
}

interface InterpolatedTickInput {
  readonly startTime: number;
  readonly timeRange: number;
  readonly numTicks: number;
  readonly fmt: (value: Readonly<Date>) => string;
}

const appendInterpolatedTick = (params: Readonly<{ date: Readonly<Date>; fmt: (value: Readonly<Date>) => string; seen: Set<string>; out: XAxisTickValue[] }>): void => {
  const label = params.fmt(params.date);
  if (params.seen.has(label)) {return;}
  params.seen.add(label);
  params.out.push({ label, value: params.date });
};

const buildInterpolatedDomainTicks = (params: Readonly<InterpolatedTickInput>): XAxisTickValue[] => {
  const tickCount = Math.max(2, params.numTicks);
  const seen = new Set<string>();
  const out: XAxisTickValue[] = [];
  for (let i = 0; i < tickCount; i += 1) {
    const fraction = i / (tickCount - 1);
    appendInterpolatedTick({ date: new Date(params.startTime + fraction * params.timeRange), fmt: params.fmt, out, seen });
  }
  return out;
}

const resolveTickDate = (params: Readonly<{ cache: Map<number, Date | null>; data: readonly Readonly<ChartDatum>[]; xDataKey: string; index: number }>): Date | null => {
  const cached = params.cache.get(params.index);
  if (cached !== undefined) {return cached;}
  const parsed = toDate(params.data[params.index]?.[params.xDataKey]);
  params.cache.set(params.index, parsed);
  return parsed;
}

interface DataSnappedTicksInput {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly numTicks: number;
  readonly fmt: (value: Readonly<Date>) => string;
  readonly startTime: number;
  readonly timeRange: number;
}

const collectDataSnappedTicks = (params: Readonly<{ indices: readonly number[]; resolveLabel: (index: number) => string | undefined; resolveDate: (index: number) => Date | null }>): XAxisTickValue[] => {
  const seen = new Set<string>();
  const out: XAxisTickValue[] = [];
  for (const index of params.indices) {
    const label = params.resolveLabel(index);
    const date = params.resolveDate(index);
    if (label !== undefined && date !== null && !seen.has(label)) {
      seen.add(label);
      out.push({ label, value: date });
    }
  }
  return out;
}

const buildDataSnappedTicks = (params: Readonly<DataSnappedTicksInput>): XAxisTickValue[] => {
  const dateCache = new Map<number, Date | null>();
  const dateAtCached = (index: number): Date | null => resolveTickDate({ cache: dateCache, data: params.data, index, xDataKey: params.xDataKey });
  const xAt = (index: number): number => {
    const date = dateAtCached(index);
    if (!date || params.timeRange <= 0) {return params.rangeStart;}
    return (
      params.rangeStart +
      ((date.getTime() - params.startTime) / params.timeRange) * (params.rangeEnd - params.rangeStart)
    );
  };
  const labelAt = (index: number): string | undefined => {
    const date = dateAtCached(index);
    return date ? params.fmt(date) : undefined;
  };
  const indices = selectEvenlySpacedIndices(params.data.length, params.numTicks, {
    labelForIndex: labelAt,
    resolveXPx: xAt,
  });
  return collectDataSnappedTicks({ indices, resolveDate: dateAtCached, resolveLabel: labelAt });
}

const appendTailTick = (params: Readonly<{ extraCount: number; i: number; lastTime: number; endTime: number; fmt: (value: Readonly<Date>) => string; seenTail: Set<string>; extras: XAxisTickValue[] }>): void => {
  const date = new Date(params.lastTime + (params.i / (params.extraCount + 1)) * (params.endTime - params.lastTime));
  const label = params.fmt(date);
  if (params.seenTail.has(label)) {return;}
  params.seenTail.add(label);
  params.extras.push({ label, value: date });
};

const appendDomainEndTick = (params: Readonly<{ endTime: number; fmt: (value: Readonly<Date>) => string; seenTail: Set<string>; extras: XAxisTickValue[] }>): void => {
  const domainEnd = new Date(params.endTime);
  const endLabel = params.fmt(domainEnd);
  if (params.seenTail.has(endLabel)) {return;}
  params.extras.push({ label: endLabel, value: domainEnd });
};

interface ProjectionTailInput {
  readonly out: readonly Readonly<XAxisTickValue>[];
  readonly lastTime: number;
  readonly endTime: number;
  readonly numTicks: number;
  readonly fmt: (value: Readonly<Date>) => string;
}

const resolveTailTickCount = (outLength: number, numTicks: number): number => Math.min(Math.max(1, numTicks - outLength + 1), MAX_PROJECTION_TAIL_TICKS);

// Brushed with domain past the last point: keep data ticks, append ≤3 tail ticks + domain end.
const appendProjectionTailTicks = (params: Readonly<ProjectionTailInput>): readonly Readonly<XAxisTickValue>[] => {
  const { out, lastTime, endTime, numTicks, fmt } = params;
  const seenTail = new Set(out.map((tick: Readonly<XAxisTickValue>) => tick.label));
  const extras: XAxisTickValue[] = [];
  const extraCount = resolveTailTickCount(out.length, numTicks);
  for (let i = 1; i <= extraCount; i += 1) {
    appendTailTick({ endTime, extraCount, extras, fmt, i, lastTime, seenTail });
  }
  appendDomainEndTick({ endTime, extras, fmt, seenTail });
  if (extras.length > 0) {
    return [...out, ...extras].toSorted(
      (left: Readonly<XAxisTickValue>, right: Readonly<XAxisTickValue>) => left.value.getTime() - right.value.getTime(),
    );
  }
  return out;
}

interface DomainPathInput {
  readonly tickMode: "domain" | "data";
  readonly projectionExtendsPastData: boolean;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | null | undefined;
  readonly timeRange: number;
  readonly startTime: number;
  readonly numTicks: number;
  readonly fmt: (value: Readonly<Date>) => string;
}

const resolveDomainPathTicks = (params: Readonly<DomainPathInput>): XAxisTickValue[] | undefined => {
  if (params.tickMode === "domain" && params.timeRange > 0) {
    return buildInterpolatedDomainTicks({ fmt: params.fmt, numTicks: params.numTicks, startTime: params.startTime, timeRange: params.timeRange });
  }
  // Projection horizon past the last point with no brush: domain timestamps.
  if (params.projectionExtendsPastData && !params.xDomain && params.timeRange > 0) {
    return buildInterpolatedDomainTicks({ fmt: params.fmt, numTicks: params.numTicks, startTime: params.startTime, timeRange: params.timeRange });
  }
  return undefined;
}

interface SnappedTailInput {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xDataKey: string;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly numTicks: number;
  readonly fmt: (value: Readonly<Date>) => string;
  readonly range: Readonly<XAxisTimeRange>;
  readonly xDomain: readonly [Readonly<Date>, Readonly<Date>] | null | undefined;
}

const buildSnappedTailTicks = (params: Readonly<SnappedTailInput>): readonly Readonly<XAxisTickValue>[] => {
  const out = buildDataSnappedTicks({ data: params.data, fmt: params.fmt, numTicks: params.numTicks, rangeEnd: params.rangeEnd, rangeStart: params.rangeStart, startTime: params.range.startTime, timeRange: params.range.timeRange, xDataKey: params.xDataKey });
  if (params.range.projectionExtendsPastData && params.range.timeRange > 0 && params.xDomain) {
    return appendProjectionTailTicks({ endTime: params.range.endTime, fmt: params.fmt, lastTime: params.range.lastTime, numTicks: params.numTicks, out });
  }
  return out;
}

const buildXAxisTickValues = ({
  data,
  xDataKey,
  rangeStart,
  rangeEnd,
  numTicks,
  formatValue,
  domainMaxTime,
  xDomain,
  tickMode = "data",
}: Readonly<XAxisTickInput>): readonly Readonly<XAxisTickValue>[] => {
  if (data.length === 0 || rangeEnd <= rangeStart) {return [];}
  const range = resolveXAxisTimeRange({ data, domainMaxTime, xDataKey });
  if (!range) {return [];}
  const fmt = formatValue ?? ((date: Readonly<Date>): string => shortDateFmt.format(date));
  const domainTicks = resolveDomainPathTicks({ fmt, numTicks, projectionExtendsPastData: range.projectionExtendsPastData, startTime: range.startTime, tickMode, timeRange: range.timeRange, xDomain });
  if (domainTicks) {return domainTicks;}
  return buildSnappedTailTicks({ data, fmt, numTicks, range, rangeEnd, rangeStart, xDataKey, xDomain });
}

export { buildXAxisTickValues };
export type { XAxisTickValue, XAxisTickInput };
