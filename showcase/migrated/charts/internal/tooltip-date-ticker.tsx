import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { TICKER_ITEM_HEIGHT } from "./design-tokens";

// Token positions inside a "Month Day" ticker label.
const MONTH_PART_INDEX = 0;
const DAY_PART_INDEX = 1;
// Offset of the last element when indexing from the end.
const LAST_ELEMENT_OFFSET = -1;
// Index of the first element in a zero-based list.
const FIRST_INDEX = 0;
// Offset from length to the last valid index.
const LAST_INDEX_OFFSET = 1;
// Step used when scanning month segments from newest to oldest.
const INDEX_STEP = 1;
// Count that represents an empty label list.
const EMPTY_COUNT = 0;

interface DateTickerProps {
  readonly currentIndex: number;
  readonly labels: readonly string[];
  readonly visible: boolean;
}

const COMPACT_TICKER_THRESHOLD = 60;

interface ParsedLabel {
  readonly month: string;
  readonly day: string;
  readonly full: string;
  readonly key: string;
}

interface MonthSegment {
  readonly month: string;
  readonly key: string;
  readonly startIndex: number;
}

const toParsedLabel = (label: string, index: number): ParsedLabel => {
  const parts = label.split(" ");
  return { day: parts[DAY_PART_INDEX] || "", full: label, key: `${label}::${index}`, month: parts[MONTH_PART_INDEX] || "" };
};

const buildMonthSegments = (parsedLabels: readonly ParsedLabel[]): MonthSegment[] => {
  const segments: MonthSegment[] = [];
  for (const [index, label] of parsedLabels.entries()) {
    const prev = segments.at(LAST_ELEMENT_OFFSET);
    if (!prev || prev.month !== label.month) {
      segments.push({
        key: `${label.month}-${index}`,
        month: label.month,
        startIndex: index,
      });
    }
  }
  return segments;
};

const resolveCurrentMonthIndex = (
  currentIndex: number,
  parsedLabels: readonly ParsedLabel[],
  monthSegments: readonly MonthSegment[],
): number => {
  if (currentIndex < FIRST_INDEX || currentIndex >= parsedLabels.length) {
    return FIRST_INDEX;
  }
  for (let segmentIndex = monthSegments.length - LAST_INDEX_OFFSET; segmentIndex >= FIRST_INDEX; segmentIndex -= INDEX_STEP) {
    const segment = monthSegments.at(segmentIndex);
    if (segment && segment.startIndex <= currentIndex) {
      return segmentIndex;
    }
  }
  return FIRST_INDEX;
};

const renderCompactTicker = (pillClassName: string, label: string): ReactNode => (
  <div className={pillClassName}>
    <div className="flex h-6 items-center justify-center">
      <span className="whitespace-nowrap font-medium text-sm">{label}</span>
    </div>
  </div>
);

interface TickerStacksOptions {
  readonly monthSegments: readonly MonthSegment[];
  readonly parsedLabels: readonly ParsedLabel[];
  readonly dayStyle: Readonly<CSSProperties>;
  readonly monthStyle: Readonly<CSSProperties>;
}

// The package owns motion (V2.4): stacks render at the focus-point offset.
// Travel timing lives in the native tooltip extension, not a hand spring.
const renderTickerStacks = (options: Readonly<TickerStacksOptions>): ReactNode => {
  const { monthSegments, parsedLabels, dayStyle, monthStyle } = options;
  const monthItems = monthSegments.map((segment) => (
    <div
      className="flex h-6 shrink-0 items-center justify-center"
      key={segment.key}
    >
      <span className="whitespace-nowrap font-medium text-sm">
        {segment.month}
      </span>
    </div>
  ));
  const dayItems = parsedLabels.map((label) => (
    <div
      className="flex h-6 shrink-0 items-center justify-center"
      key={label.key}
    >
      <span className="whitespace-nowrap font-medium text-sm">
        {label.day}
      </span>
    </div>
  ));
  const monthStack = (
    <div className="relative h-6 overflow-hidden">
      <div className="flex flex-col" style={monthStyle}>
        {monthItems}
      </div>
    </div>
  );
  const dayStack = (
    <div className="relative h-6 overflow-hidden">
      <div className="flex flex-col" style={dayStyle}>
        {dayItems}
      </div>
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-1">
      {monthStack}
      {dayStack}
    </div>
  );
};

interface FullTickerOptions {
  readonly monthSegments: readonly MonthSegment[];
  readonly parsedLabels: readonly ParsedLabel[];
  readonly pillClassName: string;
  readonly dayStyle: Readonly<CSSProperties>;
  readonly monthStyle: Readonly<CSSProperties>;
  readonly visible: boolean;
}

const renderFullTicker = (options: Readonly<FullTickerOptions>): ReactNode => {
  const { monthSegments, parsedLabels, pillClassName, dayStyle, monthStyle, visible } = options;
  if (!visible || parsedLabels.length === EMPTY_COUNT) {return undefined;}
  const stacks = renderTickerStacks({ dayStyle, monthSegments, monthStyle, parsedLabels });
  return (
    <div className={pillClassName}>
      <div className="relative h-6 overflow-hidden">
        {stacks}
      </div>
    </div>
  );
};

const DateTicker = ({ currentIndex, labels, visible }: Readonly<DateTickerProps>): ReactNode => {
  const compact = useMemo(
    () => visible && labels.length > COMPACT_TICKER_THRESHOLD,
    [visible, labels.length],
  );

  const parsedLabels = useMemo<ParsedLabel[]>(() => labels.map((label, index) => toParsedLabel(label, index)), [labels]);

  const monthSegments = useMemo<MonthSegment[]>(() => buildMonthSegments(parsedLabels), [parsedLabels]);

  const currentMonthIndex = useMemo(() => resolveCurrentMonthIndex(currentIndex, parsedLabels, monthSegments), [currentIndex, parsedLabels, monthSegments]);

  const dayStyle = useMemo((): CSSProperties => ({ transform: `translateY(${-currentIndex * TICKER_ITEM_HEIGHT}px)` }), [currentIndex]);
  const monthStyle = useMemo((): CSSProperties => ({ transform: `translateY(${-currentMonthIndex * TICKER_ITEM_HEIGHT}px)` }), [currentMonthIndex]);

  const pillClassName =
    "overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900";

  if (compact) {
    return renderCompactTicker(pillClassName, labels.at(currentIndex) ?? labels.at(FIRST_INDEX) ?? "");
  }

  return renderFullTicker({ dayStyle, monthSegments, monthStyle, parsedLabels, pillClassName, visible });
}

export { DateTicker };
export type { DateTickerProps };
