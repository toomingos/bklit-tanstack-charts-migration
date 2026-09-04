import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createSpring } from './spring';
import type { Spring } from './spring';
import { TICKER_ITEM_HEIGHT } from "./design-tokens";

// Ticker digit-roll spring params (stiffness, damping).
const TICKER_SPRING_STIFFNESS = 400;
const TICKER_SPRING_DAMPING = 35;
// Token positions inside a "Month Day" ticker label.
const MONTH_PART_INDEX = 0;
const DAY_PART_INDEX = 1;
// Offset of the last element when indexing from the end.
const LAST_ELEMENT_OFFSET = -1;
// Sentinel for "no month selected yet" in the ticker month tracker.
const UNSET_MONTH_INDEX = -1;
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

interface DateTickerSprings {
  readonly daySpringRef: RefObject<Spring | undefined>;
  readonly dayStackRef: RefObject<HTMLDivElement | null>;
  readonly monthSpringRef: RefObject<Spring | undefined>;
  readonly monthStackRef: RefObject<HTMLDivElement | null>;
  readonly prevMonthRef: RefObject<number>;
}

interface DateTickerAnimationOptions {
  readonly compact: boolean;
  readonly currentIndex: number;
  readonly currentMonthIndex: number;
}

// Date-ticker rolling animation: digit/month stacks are translated imperatively by
// Springs; compact mode skips springs entirely and renders the current label.
const useDateTickerAnimation = (options: Readonly<DateTickerAnimationOptions>): DateTickerSprings => {
  const { compact, currentIndex, currentMonthIndex } = options;
  const dayStackRef = useRef<HTMLDivElement | null>(null);
  const monthStackRef = useRef<HTMLDivElement | null>(null);
  const daySpringRef = useRef<Spring | undefined>(undefined);
  const monthSpringRef = useRef<Spring | undefined>(undefined);
  const prevMonthRef = useRef(UNSET_MONTH_INDEX);
  useEffect((): (() => void) | undefined => {
    if (compact) {return undefined;}
    daySpringRef.current ??= createSpring({ damping: TICKER_SPRING_DAMPING, initial: 0, onUpdate: (offsetY) => { if (dayStackRef.current) {dayStackRef.current.style.transform = `translateY(${offsetY}px)`;} }, stiffness: TICKER_SPRING_STIFFNESS });
    monthSpringRef.current ??= createSpring({ damping: TICKER_SPRING_DAMPING, initial: 0, onUpdate: (offsetY) => { if (monthStackRef.current) {monthStackRef.current.style.transform = `translateY(${offsetY}px)`;} }, stiffness: TICKER_SPRING_STIFFNESS });
    return (): void => {
      daySpringRef.current?.stop();
      monthSpringRef.current?.stop();
      daySpringRef.current = undefined;
      monthSpringRef.current = undefined;
    };
  }, [compact]);
  useEffect(() => {
    if (compact) {return;}
    const targetDayY = -currentIndex * TICKER_ITEM_HEIGHT;
    const targetMonthY = -currentMonthIndex * TICKER_ITEM_HEIGHT;
    daySpringRef.current?.set(targetDayY);
    if (prevMonthRef.current === UNSET_MONTH_INDEX || prevMonthRef.current !== currentMonthIndex) {
      prevMonthRef.current = currentMonthIndex;
      monthSpringRef.current?.set(targetMonthY);
    }
  }, [compact, currentIndex, currentMonthIndex]);
  return { daySpringRef, dayStackRef, monthSpringRef, monthStackRef, prevMonthRef };
};

const renderCompactTicker = (pillClassName: string, label: string): ReactNode => (
  <div className={pillClassName}>
    <div className="flex h-6 items-center justify-center">
      <span className="whitespace-nowrap font-medium text-sm">{label}</span>
    </div>
  </div>
);

interface FullTickerOptions {
  readonly monthSegments: readonly MonthSegment[];
  readonly parsedLabels: readonly ParsedLabel[];
  readonly pillClassName: string;
  readonly springs: Readonly<DateTickerSprings>;
  readonly visible: boolean;
}

interface TickerStacksOptions {
  readonly monthSegments: readonly MonthSegment[];
  readonly parsedLabels: readonly ParsedLabel[];
  readonly springs: Readonly<DateTickerSprings>;
}

const renderTickerStacks = (options: Readonly<TickerStacksOptions>): ReactNode => {
  const { monthSegments, parsedLabels, springs } = options;
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
      <div className="flex flex-col" ref={springs.monthStackRef}>
        {monthItems}
      </div>
    </div>
  );
  const dayStack = (
    <div className="relative h-6 overflow-hidden">
      <div className="flex flex-col" ref={springs.dayStackRef}>
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

const renderFullTicker = (options: Readonly<FullTickerOptions>): ReactNode => {
  const { monthSegments, parsedLabels, pillClassName, springs, visible } = options;
  if (!visible || parsedLabels.length === EMPTY_COUNT) {return undefined;}
  const stacks = renderTickerStacks({ monthSegments, parsedLabels, springs });
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

  const springs = useDateTickerAnimation({ compact, currentIndex, currentMonthIndex });

  const pillClassName =
    "overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900";

  if (compact) {
    return renderCompactTicker(pillClassName, labels.at(currentIndex) ?? labels.at(FIRST_INDEX) ?? "");
  }

  return renderFullTicker({ monthSegments, parsedLabels, pillClassName, springs, visible });
}

export { DateTicker };
export type { DateTickerProps };
