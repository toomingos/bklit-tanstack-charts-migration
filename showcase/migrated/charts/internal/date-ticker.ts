import { createSpring } from './spring';
import type { Spring } from './spring';
import { TICKER_ITEM_HEIGHT } from "./design-tokens";

// Date-ticker digit-roll spring (matches bklit's pill follow feel).
const DATE_TICKER_SPRING_STIFFNESS = 400;
const DATE_TICKER_SPRING_DAMPING = 35;
// Label counts above this use the single compact label instead of month/day rollers.
const COMPACT_LABEL_COUNT_THRESHOLD = 60;

interface MonthSegment {
  readonly month: string;
  readonly startIndex: number;
}

interface TickerScope {
  readonly doc: Document;
}

interface TickerState {
  isCompact: boolean;
  monthSegments: MonthSegment[];
  prevMonthIndex: number;
}

const collectMonthSegments = (labels: readonly string[]): MonthSegment[] => {
  const segments: MonthSegment[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const month = (labels[i] ?? "").split(" ")[0] ?? "";
    const prev = segments.at(-1);
    if (!prev || prev.month !== month) {segments.push({ month, startIndex: i });}
  }
  return segments;
};

const resolveMonthIndex = (monthSegments: readonly MonthSegment[], currentIndex: number): number => {
  let monthIndex = 0;
  for (let i = monthSegments.length - 1; i >= 0; i -= 1) {
    const seg = monthSegments.at(i);
    if ((seg?.startIndex ?? Number.POSITIVE_INFINITY) <= currentIndex) {monthIndex = i; break;}
  }
  return monthIndex;
};

const prepareCompactLabel = ({ doc }: TickerScope): HTMLSpanElement => {
  const compactLabel = doc.createElement("span");
  compactLabel.style.whiteSpace = "nowrap";
  compactLabel.style.fontWeight = "500";
  compactLabel.style.fontSize = "0.875rem";
  compactLabel.style.lineHeight = "1.25rem";
  return compactLabel;
};

const prepareStacksOuter = ({ doc }: TickerScope): HTMLDivElement => {
  const stacksOuter = doc.createElement("div");
  stacksOuter.style.display = "flex";
  stacksOuter.style.alignItems = "center";
  stacksOuter.style.justifyContent = "center";
  stacksOuter.style.gap = "0.25rem";
  stacksOuter.style.height = "1.5rem";
  stacksOuter.style.overflow = "hidden";
  return stacksOuter;
};

interface TickerColumn {
  readonly wrap: HTMLDivElement;
  readonly stack: HTMLDivElement;
}

const prepareTickerColumn = ({ doc }: TickerScope): TickerColumn => {
  const wrap = doc.createElement("div");
  wrap.style.position = "relative";
  wrap.style.height = "1.5rem";
  wrap.style.overflow = "hidden";
  const stack = doc.createElement("div");
  stack.style.display = "flex";
  stack.style.flexDirection = "column";
  wrap.append(stack);
  return { stack, wrap };
};

interface TickerStacks {
  readonly stacksOuter: HTMLDivElement;
  readonly monthStack: HTMLDivElement;
  readonly dayStack: HTMLDivElement;
}

const prepareTickerStacks = ({ doc }: TickerScope): TickerStacks => {
  const stacksOuter = prepareStacksOuter({ doc });
  const monthColumn = prepareTickerColumn({ doc });
  const dayColumn = prepareTickerColumn({ doc });
  stacksOuter.append(monthColumn.wrap, dayColumn.wrap);
  return { dayStack: dayColumn.stack, monthStack: monthColumn.stack, stacksOuter };
};

interface TickerSprings {
  readonly dayYSpring: Spring;
  readonly monthYSpring: Spring;
}

interface TickerSpringsScope {
  readonly dayStack: HTMLDivElement;
  readonly monthStack: HTMLDivElement;
}

const createTickerSprings = ({ dayStack, monthStack }: TickerSpringsScope): TickerSprings => {
  const dayYSpring = createSpring({ damping: DATE_TICKER_SPRING_DAMPING, initial: 0, onUpdate: (y) => { dayStack.style.transform = `translateY(${y}px)`; }, stiffness: DATE_TICKER_SPRING_STIFFNESS });
  const monthYSpring = createSpring({ damping: DATE_TICKER_SPRING_DAMPING, initial: 0, onUpdate: (y) => { monthStack.style.transform = `translateY(${y}px)`; }, stiffness: DATE_TICKER_SPRING_STIFFNESS });
  return { dayYSpring, monthYSpring };
};

interface TickerSpanScope extends TickerScope {
  readonly text: string;
}

const createTickerSpan = ({ doc, text }: TickerSpanScope): HTMLSpanElement => {
  const span = doc.createElement("span");
  span.style.whiteSpace = "nowrap";
  span.style.fontWeight = "500";
  span.style.fontSize = "0.875rem";
  span.style.lineHeight = "1.25rem";
  span.textContent = text;
  return span;
};

const styleTickerRow = (row: HTMLDivElement): void => {
  row.style.display = "flex";
  row.style.height = `${TICKER_ITEM_HEIGHT}px`;
  row.style.flexShrink = "0";
  row.style.alignItems = "center";
  row.style.justifyContent = "center";
};

interface MonthRowsScope extends TickerScope {
  readonly monthStack: HTMLDivElement;
  readonly monthSegments: readonly MonthSegment[];
}

const buildMonthRows = ({ doc, monthStack, monthSegments }: MonthRowsScope): void => {
  for (const seg of monthSegments) {
    const row = doc.createElement("div");
    styleTickerRow(row);
    row.append(createTickerSpan({ doc, text: seg.month }));
    monthStack.append(row);
  }
};

interface DayRowsScope extends TickerScope {
  readonly dayStack: HTMLDivElement;
  readonly labels: readonly string[];
}

const buildDayRows = ({ doc, dayStack, labels }: DayRowsScope): void => {
  for (const label of labels) {
    const day = label.split(" ")[1] ?? "";
    const row = doc.createElement("div");
    styleTickerRow(row);
    row.append(createTickerSpan({ doc, text: day }));
    dayStack.append(row);
  }
};

interface CompactInnerScope extends TickerScope {
  readonly compactLabel: HTMLSpanElement;
}

const createCompactInner = ({ doc, compactLabel }: CompactInnerScope): HTMLDivElement => {
  const inner = doc.createElement("div");
  inner.style.display = "flex";
  inner.style.height = "1.5rem";
  inner.style.alignItems = "center";
  inner.style.justifyContent = "center";
  inner.append(compactLabel);
  return inner;
};

interface TickerModeScope extends TickerScope {
  readonly compact: boolean;
  readonly isCompact: boolean;
  readonly root: HTMLDivElement;
  readonly stacksOuter: HTMLDivElement;
  readonly compactLabel: HTMLSpanElement;
  readonly rebuild: () => void;
}

const syncTickerCompactMode = ({ compact, compactLabel, doc, isCompact, rebuild, root, stacksOuter }: TickerModeScope): boolean => {
  if (compact === isCompact) {return isCompact;}
  root.textContent = "";
  if (compact) {
    root.append(createCompactInner({ compactLabel, doc }));
  } else {
    rebuild();
    root.append(stacksOuter);
  }
  return compact;
};

interface CompactLabelScope {
  readonly compactLabel: HTMLSpanElement;
  readonly labels: readonly string[];
  readonly currentIndex: number;
}

const applyCompactLabel = ({ compactLabel, labels, currentIndex }: CompactLabelScope): void => {
  const current: string | undefined = labels.at(currentIndex);
  const first: string | undefined = labels.at(0);
  compactLabel.textContent = current ?? first ?? "";
};

interface ApplyTickerSpringScope {
  readonly discrete: boolean;
  readonly spring: Spring;
  readonly target: number;
}

// Single spring hop shared by the day and month rollers so the driver stays small.
const applyTickerSpringTarget = ({ discrete, spring, target }: ApplyTickerSpringScope): void => {
  if (discrete) {spring.jump(target);} else {spring.set(target);}
};

interface TickerDriveScope {
  readonly currentIndex: number;
  readonly monthIndex: number;
  readonly discrete: boolean;
  readonly prevMonthIndex: number;
  readonly dayYSpring: Spring;
  readonly monthYSpring: Spring;
}

const driveTickerSprings = ({ currentIndex, discrete, monthIndex, monthYSpring, dayYSpring, prevMonthIndex }: TickerDriveScope): number => {
  const targetDayY = -currentIndex * TICKER_ITEM_HEIGHT;
  const targetMonthY = -monthIndex * TICKER_ITEM_HEIGHT;
  applyTickerSpringTarget({ discrete, spring: dayYSpring, target: targetDayY });
  if (prevMonthIndex === -1 || prevMonthIndex !== monthIndex) {
    applyTickerSpringTarget({ discrete, spring: monthYSpring, target: targetMonthY });
    return monthIndex;
  }
  return prevMonthIndex;
};

interface DateTicker {
  readonly compactLabel: HTMLSpanElement;
  readonly detach: () => void;
  readonly rebuild: () => void;
  readonly root: HTMLDivElement;
  readonly setCompactLabel: (label: string) => void;
  readonly update: (currentIndex: number, discrete: boolean) => void;
}

const createDateTicker = (doc: Document, getLabels: () => string[]): DateTicker => {
  const root = doc.createElement("div");
  const compactLabel = prepareCompactLabel({ doc });
  const { stacksOuter, monthStack, dayStack } = prepareTickerStacks({ doc });
  const tickerState: TickerState = { isCompact: false, monthSegments: [], prevMonthIndex: -1 };
  const { dayYSpring, monthYSpring } = createTickerSprings({ dayStack, monthStack });
  const rebuild = (): void => {
    const labels = getLabels();
    tickerState.monthSegments = collectMonthSegments(labels);
    monthStack.textContent = "";
    dayStack.textContent = "";
    buildMonthRows({ doc, monthSegments: tickerState.monthSegments, monthStack });
    buildDayRows({ dayStack, doc, labels });
    tickerState.prevMonthIndex = -1;
  };
  const update = (currentIndex: number, discrete: boolean): void => {
    const labels = getLabels();
    tickerState.isCompact = syncTickerCompactMode({ compact: labels.length > COMPACT_LABEL_COUNT_THRESHOLD, compactLabel, doc, isCompact: tickerState.isCompact, rebuild, root, stacksOuter });
    if (tickerState.isCompact) {
      applyCompactLabel({ compactLabel, currentIndex, labels });
      return;
    }
    if (tickerState.monthSegments.length === 0) {rebuild();}
    tickerState.prevMonthIndex = driveTickerSprings({ currentIndex, dayYSpring, discrete, monthIndex: resolveMonthIndex(tickerState.monthSegments, currentIndex), monthYSpring, prevMonthIndex: tickerState.prevMonthIndex });
  };
  const detach = (): void => { dayYSpring.stop(); monthYSpring.stop(); };
  const setCompactLabel = (label: string): void => {
    if (!tickerState.isCompact) {
      tickerState.isCompact = true;
      root.textContent = "";
      root.append(createCompactInner({ compactLabel, doc }));
    }
    compactLabel.textContent = label;
  };
  return { compactLabel, detach, rebuild, root, setCompactLabel, update };
};

export { createDateTicker };
export type { DateTicker };
