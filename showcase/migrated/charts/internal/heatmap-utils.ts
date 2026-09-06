
import type { HeatmapLevelStyles } from "./heatmap-colors";

interface HeatmapBin {
  readonly count: number;
  readonly bin: number;
  readonly date: Readonly<Date>;
}

interface HeatmapColumn {
  readonly bin: number;
  readonly bins: HeatmapBin[];
}

/** Calendar months shown in default one-year contribution grids. */
const HEATMAP_MONTHS_ONE_YEAR = 12;

/** Half-year contribution grids (gallery card demos). */
const HEATMAP_MONTHS_SIX = 6;

/** Nominal week count for one year (~52). Default data uses calendar-month math instead. */
const HEATMAP_WEEKS_ONE_YEAR = 52;

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const DAYS_PER_WEEK = 7;
const MS_PER_WEEK = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND * DAYS_PER_WEEK;

/** Default minimum days a lead week must contain on/after `rangeStart` to avoid being skipped. */
const DEFAULT_MIN_DAYS_IN_FIRST_WEEK = 4;

const getHeatmapCalendarRangeStart = (today: Readonly<Date>, months: number): Date => {
  const monthOffset = months === HEATMAP_MONTHS_SIX ? months : months - 1;
  const start = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

const getHeatmapYearStartMonth = (today: Readonly<Date>): Date => getHeatmapCalendarRangeStart(today, HEATMAP_MONTHS_ONE_YEAR);


const getHeatmapWeekStartSunday = (date: Readonly<Date>): Date => {
  const sunday = new Date(date);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

const getHeatmapWeekCount = (startSunday: Readonly<Date>, endDate: Readonly<Date>): number => {
  const endSunday = getHeatmapWeekStartSunday(endDate);
  return Math.floor((endSunday.getTime() - startSunday.getTime()) / MS_PER_WEEK) + 1;
}

/**
 * Days in a Sun-Sat column on or after `threshold` (for trimming partial lead weeks).
 * @param {Readonly<Date>} weekStart - Start of the Sun-Sat week column.
 * @param {Readonly<Date>} threshold - Cutoff date; days before this are not counted.
 * @returns {number} Count of days in the week on or after `threshold`.
 */
const countHeatmapWeekDaysOnOrAfter = (weekStart: Readonly<Date>, threshold: Readonly<Date>): number => {
  const day = new Date(weekStart);
  day.setHours(0, 0, 0, 0);
  const cutoff = new Date(threshold);
  cutoff.setHours(0, 0, 0, 0);
  let count = 0;
  for (let i = 0; i < DAYS_PER_WEEK; i += 1) {
    if (day >= cutoff) {count += 1;}
    day.setDate(day.getDate() + 1);
  }
  return count;
}

/**
 * First Sunday week column with enough days on/after `rangeStart` — skips a lead week mostly before the range.
 * @param {Readonly<Date>} rangeStart - Start of the desired calendar range.
 * @param {number} [minDaysInFirstWeek] - Minimum days required in the first week to avoid skipping it.
 * @returns {Date} The aligned week-start Sunday date.
 */
const getHeatmapWeekStartAlignedToRange = (rangeStart: Readonly<Date>, minDaysInFirstWeek: number = DEFAULT_MIN_DAYS_IN_FIRST_WEEK): Date => {
  const startDate = getHeatmapWeekStartSunday(rangeStart);
  const weekEnd = new Date(startDate);
  weekEnd.setDate(weekEnd.getDate() + (DAYS_PER_WEEK - 1));

  // Keep the Sun-Sat column that contains the 1st (e.g. Jan 1 in a partial lead week).
  if (rangeStart >= startDate && rangeStart <= weekEnd) {
    return startDate;
  }

  while (countHeatmapWeekDaysOnOrAfter(startDate, rangeStart) < minDaysInFirstWeek) {
    startDate.setDate(startDate.getDate() + DAYS_PER_WEEK);
  }

  return startDate;
}

interface HeatmapWeekRange {
  readonly startDate: Date;
  readonly weekCount: number;
  /** First in-range calendar day; bins before this are empty in default year grids. */
  readonly rangeStart: Date | null;
}

/**
 * Rolling-week fallback for a non-default `weeks` window ending at `endDate`.
 * @param {Readonly<Date>} endDate - Anchored end date the rolling window counts back from.
 * @param {number} weeks - Number of Sunday-aligned weeks in the grid.
 * @returns {HeatmapWeekRange} The resolved week range.
 */
// Rolling-week fallback for the non-default `weeks` window.
const resolveRollingHeatmapWeekRange = (endDate: Readonly<Date>, weeks: number): HeatmapWeekRange => {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (weeks - 1) * DAYS_PER_WEEK);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  startDate.setHours(0, 0, 0, 0);
  return { rangeStart: null, startDate, weekCount: weeks };
}

const resolveHeatmapWeekRange = (today: Readonly<Date>, weeks: number = HEATMAP_WEEKS_ONE_YEAR): HeatmapWeekRange => {
  const endDate = new Date(today);
  endDate.setHours(0, 0, 0, 0);

  if (weeks === HEATMAP_WEEKS_ONE_YEAR) {
    const rangeStart = getHeatmapYearStartMonth(endDate);
    const startDate = getHeatmapWeekStartAlignedToRange(rangeStart);
    return { rangeStart, startDate, weekCount: getHeatmapWeekCount(startDate, endDate) };
  }

  return resolveRollingHeatmapWeekRange(endDate, weeks);
}

const CONTRIBUTION_LEVEL_1_MAX = 1;
const CONTRIBUTION_LEVEL_2_MAX = 2;
const CONTRIBUTION_LEVEL_3_MAX = 3;
const CONTRIBUTION_LEVEL_4_MAX = 4;

/**
 * Discrete 5-level threshold scale — not a continuous interpolation.
 * @param {number} count - Contribution count for the cell.
 * @returns {number} The discrete contribution level (0-4).
 */
const getHeatmapContributionLevel = (count: number): number => {
  if (count <= 0) {return 0;}
  if (count === CONTRIBUTION_LEVEL_1_MAX) {return CONTRIBUTION_LEVEL_1_MAX;}
  if (count === CONTRIBUTION_LEVEL_2_MAX) {return CONTRIBUTION_LEVEL_2_MAX;}
  if (count === CONTRIBUTION_LEVEL_3_MAX) {return CONTRIBUTION_LEVEL_3_MAX;}
  return CONTRIBUTION_LEVEL_4_MAX;
}

const HEATMAP_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** First row of the grid — `0` = Sunday (GitHub default). */
const WEEKDAY_SUNDAY = 0;
const WEEKDAY_MONDAY = 1;
const WEEKDAY_TUESDAY = 2;
const WEEKDAY_WEDNESDAY = 3;
const WEEKDAY_THURSDAY = 4;
const WEEKDAY_FRIDAY = 5;
const WEEKDAY_SATURDAY = 6;

type HeatmapWeekStartDay =
  | typeof WEEKDAY_SUNDAY
  | typeof WEEKDAY_MONDAY
  | typeof WEEKDAY_TUESDAY
  | typeof WEEKDAY_WEDNESDAY
  | typeof WEEKDAY_THURSDAY
  | typeof WEEKDAY_FRIDAY
  | typeof WEEKDAY_SATURDAY;

/**
 * Day labels with row 0 aligned to `weekStartDay`.
 * @param {HeatmapWeekStartDay} [weekStartDay] - First row of the grid.
 * @returns {readonly string[]} Day labels ordered starting at `weekStartDay`.
 */
const getHeatmapDayLabels = (weekStartDay: HeatmapWeekStartDay = 0): readonly string[] => {
  if (weekStartDay === 0) {return HEATMAP_DAY_LABELS;}
  return [...HEATMAP_DAY_LABELS.slice(weekStartDay), ...HEATMAP_DAY_LABELS.slice(0, weekStartDay)];
}

type HeatmapYAxisLabelFormat = "full" | "initial";

const formatHeatmapYAxisLabel = (label: string, labelFormat: HeatmapYAxisLabelFormat): string => labelFormat === "initial" ? label.charAt(0) : label;


type HeatmapYAxisTickFilter = "all" | "odd" | "even";

const shouldShowHeatmapYAxisTick = (row: number, tickFilter: HeatmapYAxisTickFilter): boolean => {
  switch (tickFilter) {
    case "all": {
      return true;
    }
    case "odd": {
      return row % 2 === 1;
    }
    case "even": {
      return row % 2 === 0;
    }
    default: {
      return row % 2 === 1;
    }
  }
}

/**
 * Rotates Sun-first column bins so display row 0 starts on `weekStartDay`.
 *
 * `columns` is intentionally NOT `readonly`: the `weekStartDay === 0` fast path
 * returns it unchanged, and this function's return type (`HeatmapColumn[]`) is a
 * stability boundary for `heatmap-chart-core.tsx`, which
 * assigns the result straight into a `columns: HeatmapColumn[]` field consumed
 * further by `HeatmapContextValue.data`. Accepting `readonly HeatmapColumn[]`
 * while returning `HeatmapColumn[]` on that path is a type error; widening the
 * return type would ripple into that file, and copying the array on every call
 * to satisfy `readonly` would add an allocation to a benchmarked render path for
 * no behavioural benefit. Left mutable — see report.
 * @param {HeatmapColumn[]} columns - Week columns whose bins are rotated.
 * @param {HeatmapWeekStartDay} [weekStartDay] - Display row the rotation starts on; `0` returns `columns` unchanged.
 * @returns {HeatmapColumn[]} The rotated columns, or `columns` unchanged when `weekStartDay` is `0`.
 */
const rotateHeatmapColumnBins = (columns: HeatmapColumn[], weekStartDay: HeatmapWeekStartDay = 0): HeatmapColumn[] => {
  if (weekStartDay === 0) {return columns;}
  return columns.map((column: Readonly<HeatmapColumn>) => ({
    ...column,
    bins: [...column.bins.slice(weekStartDay), ...column.bins.slice(0, weekStartDay)],
  }));
}

/**
 * Month label anchor for a week column — prefers the 1st, else the 1st of the first bin's month.
 * @param {Readonly<HeatmapColumn>} column - Week column whose bins are scanned for a month anchor.
 * @returns {Date | undefined} The 1st of the anchor month, or `undefined` when `column.bins` is empty.
  */
const getHeatmapColumnMonthAnchor = (column: HeatmapColumn): Date | null => {
  for (const bin of column.bins) {
    if (bin.date.getDate() === 1) {return bin.date;}
  }
  // First bin via array destructuring; the empty-bins guard below stays load-bearing.
  // Empty bins arrays are a real runtime case this function must handle.
  if (column.bins.length === 0) {return null;}
  const [firstBin] = column.bins;
  const firstDate = firstBin.date;
  return new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
}

const ORDINAL_TEEN_START = 11;
const ORDINAL_TEEN_END = 13;
const ORDINAL_SUFFIX_MOD = 10;
const ORDINAL_RD_SUFFIX_DIGIT = 3;

const formatHeatmapOrdinalDay = (day: number): string => {
  if (day >= ORDINAL_TEEN_START && day <= ORDINAL_TEEN_END) {return `${day}th`;}
  switch (day % ORDINAL_SUFFIX_MOD) {
    case 1: {
      return `${day}st`;
    }
    case 2: {
      return `${day}nd`;
    }
    case ORDINAL_RD_SUFFIX_DIGIT: {
      return `${day}rd`;
    }
    default: {
      return `${day}th`;
    }
  }
}

const heatmapTooltipMonthFmt = new Intl.DateTimeFormat("en-US", { month: "long" });
const heatmapTooltipWeekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const heatmapMonthShortFmt = new Intl.DateTimeFormat("en-US", { month: "short" });

const formatHeatmapMonthShort = (date: Readonly<Date>): string => heatmapMonthShortFmt.format(date);


/**
 * Tooltip header date — e.g. `January 20th 2026`.
 * @param {Readonly<Date>} date - Date to format.
 * @returns {string} The formatted tooltip header string.
 */
const formatHeatmapTooltipDate = (date: Readonly<Date>): string => {
  const month = heatmapTooltipMonthFmt.format(date);
  const day = formatHeatmapOrdinalDay(date.getDate());
  return `${month} ${day} ${date.getFullYear()}`;
}

/**
 * Tooltip weekday line — e.g. `Monday`.
 * @param {Readonly<Date>} date - Date whose weekday name is shown.
 * @returns {string} The full weekday name.
 */
const formatHeatmapTooltipWeekday = (date: Readonly<Date>): string => heatmapTooltipWeekdayFmt.format(date);


/**
 * Tooltip contribution line — e.g. `3 contributions`.
 * @param {number} count - Contribution count for the cell.
 * @param {Readonly<Date>} [_secondaryDate] - Unused; kept for call-site symmetry with other tooltip formatters that take a date.
 * @returns {string} The formatted contribution label string.
 */
const formatHeatmapContributionLabel = (count: number, _secondaryDate?: Readonly<Date>): string => {
  const word = count === 1 ? "contribution" : "contributions";
  return `${count} ${word}`;
}

/**
 * Purely internal helper (not re-exported from the package barrel), so its `Date | undefined`
 * return uses `undefined` rather than `null` — there is no external consumer relying on `null`.
 * @param {Readonly<HeatmapColumn>} column - Week column to read the first bin's date from.
 * @returns {Date | undefined} The first bin's date, or `undefined` when `column.bins` is empty.
 */
const getHeatmapColumnStartDate = (column: Readonly<HeatmapColumn>): Date | undefined => column.bins[0]?.date;


/**
 * Purely internal helper (not re-exported from the package barrel) — see
 * `getHeatmapColumnStartDate` above for why this returns `undefined`, not `null`.
 * @param {Readonly<HeatmapColumn>} column - Week column to read the last bin's date from.
 * @returns {Date | undefined} The last bin's date, or `undefined` when `column.bins` is empty.
 */
const getHeatmapColumnEndDate = (column: Readonly<HeatmapColumn>): Date | undefined => {
  const lastBin = column.bins.at(-1);
  return lastBin?.date;
}

/**
 * @param {readonly HeatmapColumn[]} columns - Week columns to derive the overall time span from.
 * @returns {Date | undefined} The last column's end date, or `undefined` when `columns` is empty or dates are unavailable.
  */
 // Last bin date across all columns; undefined when no column has bins.
const readHeatmapLastColumnEnd = (columns: readonly HeatmapColumn[]): Date | undefined => {
  const lastColumn = columns.at(-1);
  if (!lastColumn) { return undefined; }
  return getHeatmapColumnEndDate(lastColumn);
}

const getHeatmapTimeExtent = (columns: HeatmapColumn[]): [Date, Date] | null => {
  if (columns.length === 0) {return null;}
  // Non-empty per the length check above, so destructuring always yields a column.
  const [firstColumn] = columns;
  const start = getHeatmapColumnStartDate(firstColumn);
  const end = readHeatmapLastColumnEnd(columns);
  if (!(start && end)) {return null;}
  return [start, end];
}

// Position helpers removed: V3.3 moved cells to package band scales;
// Time/brush linear maps and column-offset math deleted.)


/**
 * `columns` is intentionally NOT `readonly`: the `!xDomain` fast path returns it
 * unchanged, and this function is re-exported from the package barrel
 * (`migrated/charts/index.ts`) as public API — widening its parameter to
 * `readonly` would require either changing the declared `HeatmapColumn[]` return
 * type (a public signature change with unknown external callers) or copying the
 * array on every call with no domain filter (an allocation on a benchmarked
 * render path). Left mutable — see report.
 * @param {HeatmapColumn[]} columns - Week columns to filter.
 * @param {readonly [Readonly<Date>, Readonly<Date>]} [xDomain] - Inclusive `[start, end]` date domain; when omitted, all columns are returned.
 * @returns {HeatmapColumn[]} The columns overlapping `xDomain`, or all `columns` when `xDomain` is omitted.
 */
const filterHeatmapColumns = (columns: HeatmapColumn[], xDomain?: [Date, Date]): HeatmapColumn[] => {
  if (!xDomain) {return columns;}
  const start = Math.min(xDomain[0].getTime(), xDomain[1].getTime());
  const end = Math.max(xDomain[0].getTime(), xDomain[1].getTime());
  return columns.filter((column: Readonly<HeatmapColumn>) => {
    const weekStartDate = getHeatmapColumnStartDate(column);
    const weekEndDate = getHeatmapColumnEndDate(column);
    if (!weekStartDate || !weekEndDate) {return false;}
    const weekStart = weekStartDate.getTime();
    const weekEnd = weekEndDate.getTime();
    return weekEnd >= start && weekStart <= end;
  });
}

interface HeatmapDisplayRange {
  readonly start: Readonly<Date> | null;
  readonly end: Readonly<Date> | null;
}

/**
 * Whether a bin falls outside the contribution display window (not merely inactive).
 * @param {Readonly<HeatmapBin>} bin - Bin to test.
 * @param {Readonly<HeatmapDisplayRange>} range - Display window bounds.
 * @returns {boolean} `true` when `bin.date` falls outside `range`.
 */
const isHeatmapGhostBin = (bin: Readonly<HeatmapBin>, range: Readonly<HeatmapDisplayRange>): boolean => {
  const time = bin.date.getTime();
  if (range.end && time > range.end.getTime()) {return true;}
  if (range.start && time < range.start.getTime()) {return true;}
  return false;
}

/**
 * Resolves the calendar range start whose aligned week start matches `gridStart`.
 * @param {Readonly<Date>} gridStart - Aligned grid start to match against the recognized calendar shapes.
 * @param {Readonly<Date>} today - Reference "today" date the candidate ranges are computed from.
 * @returns {Date | undefined} The matching calendar range start, or `undefined` when the grid shape isn't recognized.
 */
 // Scans the recognized calendar shapes for one whose aligned start matches the grid.
const matchHeatmapCalendarRangeStart = (gridStart: Readonly<Date>, today: Readonly<Date>): Date | undefined => {
  for (const months of [HEATMAP_MONTHS_SIX, HEATMAP_MONTHS_ONE_YEAR]) {
    const rangeStart = getHeatmapCalendarRangeStart(today, months);
    const alignedStart = getHeatmapWeekStartAlignedToRange(rangeStart);
    if (gridStart.getTime() === alignedStart.getTime()) {return rangeStart;}
  }
  return undefined;
}

// Destructuring types `firstColumn` as always-defined without `noUncheckedIndexedAccess`.
// Exported callers give no guarantee `columns` is non-empty, so the guard stays.
const inferHeatmapCalendarRangeStart = (columns: HeatmapColumn[]): Date | null => {
  if (columns.length === 0) {return null;}
  const [firstColumn] = columns;

  const gridStart = getHeatmapColumnStartDate(firstColumn);
  if (!gridStart) {return null;}

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return matchHeatmapCalendarRangeStart(gridStart, today) ?? null;
}

/**
 * Grid base values shared by display-range resolution; `undefined` when the grid has no usable dates.
 * @param {readonly HeatmapColumn[]} columns - Week columns to read the grid base values from.
 * @returns {{ extent: [Date, Date]; today: Date; gridStart: Date } | undefined} The grid base values, or `undefined` when the grid has no usable dates.
 */
// Grid base values shared by display-range resolution; undefined when the grid has no usable dates.
const readHeatmapDisplayGridBase = (columns: HeatmapColumn[]): { extent: [Date, Date]; today: Date; gridStart: Date } | undefined => {
  const extent = getHeatmapTimeExtent(columns);
  if (!extent) {return undefined;}

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Non-empty per the `columns.length === 0` check above.
  const [firstColumn] = columns;

  const gridStart = getHeatmapColumnStartDate(firstColumn);
  if (!gridStart) {return undefined;}

  return { extent, gridStart, today };
}

// GitHub-style window for a recognized calendar grid; undefined bounds (show all) otherwise.
const resolveInferredHeatmapDisplayRange = (inferredStart: Readonly<Date> | undefined, extentEnd: Readonly<Date>, today: Readonly<Date>): HeatmapDisplayRange => {
  if (inferredStart && extentEnd.getTime() >= today.getTime()) {
    return { end: today, start: inferredStart };
  }
  return { end: null, start: null };
}

const resolveHeatmapDisplayRange = (columns: HeatmapColumn[]): HeatmapDisplayRange => {
  if (columns.length === 0) {return { end: null, start: null };}

  const base = readHeatmapDisplayGridBase(columns);
  if (!base) {return { end: null, start: null };}

  const inferredStart = inferHeatmapCalendarRangeStart(columns);
  return resolveInferredHeatmapDisplayRange(inferredStart ?? undefined, base.extent[1], base.today);
}

type HeatmapSeparatorGroupBy = "every" | "quarter";

interface HeatmapSeparatorParsedConfig {
  readonly groupBy: HeatmapSeparatorGroupBy;
  readonly every?: number;
  readonly spacing: number;
}

interface HeatmapSeparatorGroup {
  readonly startColumnIndex: number;
  readonly quarter: number;
  readonly year: number;
  readonly startDate: Readonly<Date>;
  readonly label: string;
}

interface HeatmapSeparatorLayout {
  readonly spacing: number;
  readonly atColumns: readonly number[];
  readonly groups: readonly HeatmapSeparatorGroup[];
}

interface HeatmapColumnSeparatorsConfig {
  readonly every?: number;
  readonly groupBy?: HeatmapSeparatorGroupBy;
  readonly spacing?: number;
}

/**
 * @param {Readonly<HeatmapColumnSeparatorsConfig> | undefined} config - Raw separator config prop.
 * @returns {HeatmapSeparatorParsedConfig | null} The parsed separator config, or `null` when `config` is absent or invalid.
 */
const normalizeHeatmapSeparatorConfig = (config: Readonly<HeatmapColumnSeparatorsConfig> | undefined): HeatmapSeparatorParsedConfig | null => {
  if (!config) {return null;}
  const groupBy = config.groupBy ?? "every";
  if (groupBy === "quarter") {return { groupBy: "quarter", spacing: config.spacing ?? 0 };}
  if ((config.every ?? 0) <= 0) {return null;}
  return { every: config.every, groupBy: "every", spacing: config.spacing ?? 0 };
}

/**
 * Column indices (0-based) where a vertical separator is drawn (fixed interval).
 * @param {number} columnCount - Total number of columns in the grid.
 * @param {number} every - Interval (in columns) between separators.
 * @returns {number[]} The 0-based column indices where a separator is drawn.
 */
const getHeatmapSeparatorColumnIndices = (columnCount: number, every: number): number[] => {
  if (every <= 0 || columnCount <= every) {return [];}
  const indices: number[] = [];
  for (let columnIndex = every; columnIndex < columnCount; columnIndex += every) {
    indices.push(columnIndex);
  }
  return indices;
}

const MONTHS_PER_QUARTER = 3;

/**
 * Calendar quarter (1-4) for Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec.
 * @param {Readonly<Date>} date - Date to resolve a quarter for.
 * @returns {number} The 1-based calendar quarter.
 */
const getCalendarQuarter = (date: Readonly<Date>): number => Math.floor(date.getMonth() / MONTHS_PER_QUARTER) + 1;


const QUARTER_1_START_MONTH = 0;
const QUARTER_2_START_MONTH = MONTHS_PER_QUARTER;
const QUARTER_3_START_MONTH = QUARTER_2_START_MONTH + MONTHS_PER_QUARTER;
const QUARTER_4_START_MONTH = QUARTER_3_START_MONTH + MONTHS_PER_QUARTER;
const CALENDAR_QUARTER_START_MONTHS = [QUARTER_1_START_MONTH, QUARTER_2_START_MONTH, QUARTER_3_START_MONTH, QUARTER_4_START_MONTH] as const;

/**
 * Quarter starts for one calendar year inside a millisecond time window.
 * @param {number} year - Calendar year whose quarter starts are collected.
 * @param {number} startTime - Exclusive lower bound in milliseconds since the epoch.
 * @param {number} endTime - Inclusive upper bound in milliseconds since the epoch.
 * @returns {Date[]} The quarter-start dates within `(startTime, endTime]`.
 */
// Quarter starts for one calendar year inside `(gridStart, gridEnd]`.
const collectQuarterStartDatesForYear = (year: number, startTime: number, endTime: number): Date[] => {
  const dates: Date[] = [];
  for (const month of CALENDAR_QUARTER_START_MONTHS) {
    const date = new Date(year, month, 1);
    date.setHours(0, 0, 0, 0);
    if (date.getTime() > startTime && date.getTime() <= endTime) {dates.push(date);}
  }
  return dates;
}

const getCalendarQuarterStartDatesBetween = (gridStart: Readonly<Date>, gridEnd: Readonly<Date>): Date[] => {
  const startTime = gridStart.getTime();
  const endTime = gridEnd.getTime();
  const dates: Date[] = [];

  for (let year = gridStart.getFullYear(); year <= gridEnd.getFullYear(); year += 1) {
    dates.push(...collectQuarterStartDatesForYear(year, startTime, endTime));
  }

  return dates;
}

/**
 * Week column index whose Sun-Sat span contains `date`.
 * @param {readonly HeatmapColumn[]} columns - Week columns to search.
 * @param {Readonly<Date>} date - Date to locate.
 * @returns {number | undefined} The matching column index, or `undefined` when no column contains `date`.
  */
const findHeatmapColumnIndexForDate = (columns: readonly HeatmapColumn[], date: Readonly<Date>): number | undefined => {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const targetTime = target.getTime();

  const columnIndex = columns.findIndex((column: Readonly<HeatmapColumn>) => {
    const weekStart = getHeatmapColumnStartDate(column);
    const weekEnd = getHeatmapColumnEndDate(column);
    if (!(weekStart && weekEnd)) {return false;}

    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(0, 0, 0, 0);
    return targetTime >= weekStart.getTime() && targetTime <= weekEnd.getTime();
  });

  return columnIndex === -1 ? undefined : columnIndex;
}

/**
 * Display/inferred/extent fallback chain for the quarter-separator range start.
 * @param {readonly HeatmapColumn[]} columns - Week columns used to resolve the display and inferred range starts.
 * @param {Readonly<Date>} extentStart - Fallback start when no display or inferred start resolves.
 * @returns {Readonly<Date>} The resolved quarter range start.
 */
// Display/inferred/extent fallback chain for the quarter-separator range start.
const resolveQuarterRangeStart = (columns: HeatmapColumn[], extentStart: Readonly<Date>): Readonly<Date> => {
  const displayRange = resolveHeatmapDisplayRange(columns);
  return displayRange.start ?? inferHeatmapCalendarRangeStart(columns) ?? extentStart;
}

interface QuarterSeparatorSeed {
  readonly groups: HeatmapSeparatorGroup[];
  readonly usedColumns: Set<number>;
}

// First quarter group plus its claimed column; later groups append after it.
const createQuarterSeparatorSeed = (quarterRangeStart: Readonly<Date>): QuarterSeparatorSeed => {
  const quarter = getCalendarQuarter(quarterRangeStart);
  const groups: HeatmapSeparatorGroup[] = [
    {
      label: `Q${quarter}`,
      quarter,
      startColumnIndex: 0,
      startDate: quarterRangeStart,
      year: quarterRangeStart.getFullYear(),
    },
  ];
  return { groups, usedColumns: new Set<number>([0]) };
}

interface AppendQuarterSeparatorGroupParams {
  readonly columns: readonly HeatmapColumn[];
  readonly groups: HeatmapSeparatorGroup[];
  readonly quarterStart: Readonly<Date>;
  readonly usedColumns: Set<number>;
}

// One quarter-start date becomes a group unless its column is taken or is the seed column.
const appendQuarterSeparatorGroup = (params: Readonly<AppendQuarterSeparatorGroupParams>): void => {
  const { columns, groups, quarterStart, usedColumns } = params;
  const columnIndex = findHeatmapColumnIndexForDate(columns, quarterStart);
  if (columnIndex !== undefined && columnIndex !== 0 && !usedColumns.has(columnIndex)) {
    usedColumns.add(columnIndex);
    const quarter = getCalendarQuarter(quarterStart);
    groups.push({
      label: `Q${quarter}`,
      quarter,
      startColumnIndex: columnIndex,
      startDate: quarterStart,
      year: quarterStart.getFullYear(),
    });
  }
}

interface AppendQuarterSeparatorGroupsParams {
  readonly columns: readonly HeatmapColumn[];
  readonly gridEnd: Readonly<Date>;
  readonly groups: HeatmapSeparatorGroup[];
  readonly quarterRangeStart: Readonly<Date>;
  readonly usedColumns: Set<number>;
}

const appendQuarterSeparatorGroups = (params: Readonly<AppendQuarterSeparatorGroupsParams>): void => {
  const { columns, gridEnd, groups, quarterRangeStart, usedColumns } = params;
  const quarterStarts = getCalendarQuarterStartDatesBetween(quarterRangeStart, gridEnd);
  for (const quarterStart of quarterStarts) {
    appendQuarterSeparatorGroup({ columns, groups, quarterStart, usedColumns });
  }
}

const buildHeatmapQuarterSeparatorGroups = (columns: HeatmapColumn[]): HeatmapSeparatorGroup[] => {
  if (columns.length === 0) {return [];}

  const extent = getHeatmapTimeExtent(columns);
  if (!extent) {return [];}

  const quarterRangeStart = resolveQuarterRangeStart(columns, extent[0]);
  const { groups, usedColumns } = createQuarterSeparatorSeed(quarterRangeStart);
  appendQuarterSeparatorGroups({ columns, gridEnd: extent[1], groups, quarterRangeStart, usedColumns });

  groups.sort((groupA: Readonly<HeatmapSeparatorGroup>, groupB: Readonly<HeatmapSeparatorGroup>) => groupA.startColumnIndex - groupB.startColumnIndex);
  return groups;
}

/**
 * @param {Readonly<HeatmapSeparatorParsedConfig>} config - Parsed separator config, or `null` to disable separators.
 * @param {readonly HeatmapColumn[]} columns - Week columns the layout is computed against.
 * @returns {HeatmapSeparatorLayout | null} The resolved separator layout, or `null` when separators are disabled or have no effect.
 */
// Quarter-grouped separators; null when separators are disabled or have no effect.
const resolveQuarterSeparatorLayout = (config: Readonly<HeatmapSeparatorParsedConfig>, columns: HeatmapColumn[]): HeatmapSeparatorLayout | null => {
  const groups = buildHeatmapQuarterSeparatorGroups(columns);
  if (groups.length === 0) {return null;}

  const atColumns: number[] = [];
  for (const group of groups) {
    if (group.startColumnIndex > 0) {atColumns.push(group.startColumnIndex);}
  }

  return { atColumns, groups, spacing: config.spacing };
}

const resolveHeatmapSeparatorLayout = (config: Readonly<HeatmapSeparatorParsedConfig> | null, columns: HeatmapColumn[]): HeatmapSeparatorLayout | null => {
  if (!config) {return null;}

  if (config.groupBy === "quarter") {
    return resolveQuarterSeparatorLayout(config, columns);
  }

  // Bind before the guard so the positive-count narrowing carries to the call below.
  const every = config.every ?? 0;
  if (every <= 0) {return null;}

  const atColumns = getHeatmapSeparatorColumnIndices(columns.length, every);

  return { atColumns, groups: [], spacing: config.spacing };
}

// Separator/plot position helpers removed: separators read store bounds;
// Column offsets and plot widths come from the package band scales.)

interface HeatmapSeparatorLineYParams {
  readonly innerHeight: number;
  readonly marginTop: number;
  /** Distance from the chart container top to the line start. Default: plot top. */
  readonly startOffset?: number;
  readonly paddingY?: number;
}

interface HeatmapSeparatorLineYSpan {
  readonly y1: number;
  readonly y2: number;
}

// Separator line geometry removed: separators are decorative package marks
// Positioned by the band scales, not by arithmetic line helpers.)

/** Separator line style. */
type HeatmapSeparatorStrokeStyle = "solid" | "dashed";

const DEFAULT_DASHED_STROKE_DASHARRAY = "4,4";

/**
 * @param {HeatmapSeparatorStrokeStyle} [strokeStyle] - Line style.
 * @param {string} [strokeDasharray] - Explicit dasharray override.
 * @returns {string | undefined} The stroke dasharray for `strokeStyle`, or `undefined` for a solid line.
 */
const resolveHeatmapSeparatorStrokeDasharray = (strokeStyle: HeatmapSeparatorStrokeStyle = "solid", strokeDasharray?: string): string | undefined => {
  if (strokeStyle !== "dashed") {return undefined;}
  return strokeDasharray ?? DEFAULT_DASHED_STROKE_DASHARRAY;
}

/** Vertical stroke gradient for separator lines (`from` -> optional `via` -> `to`). */
interface HeatmapSeparatorGradient {
  readonly from: string;
  readonly via?: string;
  readonly to: string;
  readonly fromOpacity?: number;
  readonly viaOpacity?: number;
  readonly toOpacity?: number;
}

interface HeatmapSeparatorGradientStop {
  readonly offset: string;
  readonly color: string;
  readonly opacity: number;
}

const DEFAULT_GRADIENT_STOP_OPACITY = 1;

/**
 * Builds SVG gradient stops for a vertical separator line.
 * @param {Readonly<HeatmapSeparatorGradient>} gradient - Gradient color/opacity stops.
 * @param {number} [strokeOpacity] - Overall stroke opacity multiplier.
 * @returns {HeatmapSeparatorGradientStop[]} The SVG gradient stops.
 */
const buildHeatmapSeparatorGradientStops = (gradient: Readonly<HeatmapSeparatorGradient>, strokeOpacity = 1): HeatmapSeparatorGradientStop[] => {
  const scaleOpacity = (value: number | undefined, fallback: number = DEFAULT_GRADIENT_STOP_OPACITY): number => (value ?? fallback) * strokeOpacity;

  if (gradient.via !== undefined) {
    return [
      { color: gradient.from, offset: "0%", opacity: scaleOpacity(gradient.fromOpacity) },
      { color: gradient.via, offset: "50%", opacity: scaleOpacity(gradient.viaOpacity) },
      { color: gradient.to, offset: "100%", opacity: scaleOpacity(gradient.toOpacity) },
    ];
  }

  return [
    { color: gradient.from, offset: "0%", opacity: scaleOpacity(gradient.fromOpacity) },
    { color: gradient.to, offset: "100%", opacity: scaleOpacity(gradient.toOpacity) },
  ];
}

interface HeatmapHoverStyleParams {
  readonly inactiveOpacity: number;
  readonly inactiveScale: number;
  readonly activeScale: number;
}

/**
 * Whether hover styling runs (disabled when all scale/opacity props are 1).
 * @param {Readonly<HeatmapHoverStyleParams>} params - Hover style params.
 * @returns {boolean} `true` when hover styling has a visible effect.
 */
const isHeatmapHoverEffectEnabled = (params: Readonly<HeatmapHoverStyleParams>): boolean => params.inactiveOpacity !== 1 || params.inactiveScale !== 1 || params.activeScale !== 1;


interface HeatmapHoverStyle {
  readonly opacity: number;
  readonly scale: number;
}

/**
 * Opacity and scale for highlighted vs dimmed cells and legend swatches.
 * @param {boolean} isHighlighted - Whether the cell/swatch is the hovered one.
 * @param {boolean} isDimmed - Whether the cell/swatch should be dimmed.
 * @param {Readonly<HeatmapHoverStyleParams>} params - Hover style params.
 * @returns {HeatmapHoverStyle} The resolved opacity/scale.
 */
const resolveHeatmapHoverStyle = (isHighlighted: boolean, isDimmed: boolean, params: Readonly<HeatmapHoverStyleParams>): HeatmapHoverStyle => {
  if (isHighlighted && params.activeScale !== 1) {return { opacity: 1, scale: params.activeScale };}
  if (isDimmed) {return { opacity: params.inactiveOpacity, scale: params.inactiveScale };}
  return { opacity: 1, scale: 1 };
}

/**
 * `Array.isArray`'s built-in type predicate narrows a `readonly number[] | X` union to
 * `any[]` (it asserts `arg is any[]`), not `readonly number[]` — a known TS narrowing gap.
 * This wrapper declares the honest predicate type so callers narrow soundly: the true
 * branch is the array member of the caller's union and the false branch keeps the rest.
 * @param {Other} value - Value to test; a `readonly number[]` or some other known type.
 * @returns {boolean} Whether `value` is a `readonly number[]`.
 */
const isReadonlyNumberArray = <Other,>(value: Other): value is Extract<Other, readonly number[]> => Array.isArray(value);

/**
 * Per-row opacity multiplier for display rows (default 1).
 * @param {number} row - Row index.
 * @param {number | readonly number[]} [rowOpacity] - A single opacity for all rows, or a per-row array.
 * @returns {number} The resolved opacity for `row`.
 */
const resolveHeatmapRowOpacity = (row: number, rowOpacity: number | readonly number[] = 1): number => {
  if (isReadonlyNumberArray(rowOpacity)) {return rowOpacity[row] ?? 1;}
  return rowOpacity;
}

const DEFAULT_FADED_OPACITY = 0.35;
const DEFAULT_ACTIVE_OPACITY = 1;
const DEFAULT_ROW_COUNT = 7;

/**
 * Builds a per-row opacity map for HeatmapCells/HeatmapYAxis from explicit row indices or a predicate.
 * @param {readonly number[] | ((row: number) => boolean)} match - Explicit faded row indices, or a predicate returning whether a row is faded.
 * @param {number} [fadedOpacity] - Opacity applied to matched (faded) rows.
 * @param {number} [activeOpacity] - Opacity applied to unmatched (active) rows.
 * @param {number} [rowCount] - Number of rows to build an opacity entry for.
 * @returns {number[]} The per-row opacity array.
 */
const buildHeatmapRowOpacity = (match: readonly number[] | ((row: number) => boolean), fadedOpacity: number = DEFAULT_FADED_OPACITY, activeOpacity: number = DEFAULT_ACTIVE_OPACITY, rowCount: number = DEFAULT_ROW_COUNT): number[] => {
  if (isReadonlyNumberArray(match)) {
    const opacity = Array.from({ length: rowCount }, () => activeOpacity);
    for (const row of match) {
      if (row >= 0 && row < rowCount) {opacity[row] = fadedOpacity;}
    }
    return opacity;
  }

  return Array.from({ length: rowCount }, (_unused, row) => (match(row) ? fadedOpacity : activeOpacity));
}

const LEGEND_GRADIENT_MAX_PERCENT = 100;

/**
 * CSS `linear-gradient` for a continuous legend bar from level styles.
 * @param {HeatmapLevelStyles} levelStyles - Ordered level colors.
 * @returns {string} The `linear-gradient(...)` CSS value.
 */
const buildHeatmapLegendGradient = (levelStyles: HeatmapLevelStyles): string => {
  const lastIndex = levelStyles.length - 1;
  const stops = levelStyles.map((style, index) => {
    const offset = lastIndex === 0 ? 0 : (index / lastIndex) * LEGEND_GRADIENT_MAX_PERCENT;
    return `${style.color} ${offset}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

// Chart dimensions removed: the host owns sizing and the package band
// Scales own the pixel range; outer height derives from width in chart-core.)

export {
  HEATMAP_MONTHS_ONE_YEAR,
  HEATMAP_MONTHS_SIX,
  HEATMAP_WEEKS_ONE_YEAR,
  HEATMAP_DAY_LABELS,
  getHeatmapCalendarRangeStart,
  getHeatmapYearStartMonth,
  getHeatmapWeekStartSunday,
  getHeatmapWeekCount,
  countHeatmapWeekDaysOnOrAfter,
  getHeatmapWeekStartAlignedToRange,
  resolveHeatmapWeekRange,
  getHeatmapContributionLevel,
  getHeatmapDayLabels,
  formatHeatmapYAxisLabel,
  shouldShowHeatmapYAxisTick,
  rotateHeatmapColumnBins,
  getHeatmapColumnMonthAnchor,
  formatHeatmapMonthShort,
  formatHeatmapTooltipDate,
  formatHeatmapTooltipWeekday,
  formatHeatmapContributionLabel,
  getHeatmapColumnStartDate,
  getHeatmapColumnEndDate,
  getHeatmapTimeExtent,
  filterHeatmapColumns,
  isHeatmapGhostBin,
  inferHeatmapCalendarRangeStart,
  resolveHeatmapDisplayRange,
  normalizeHeatmapSeparatorConfig,
  getHeatmapSeparatorColumnIndices,
  getCalendarQuarter,
  getCalendarQuarterStartDatesBetween,
  findHeatmapColumnIndexForDate,
  buildHeatmapQuarterSeparatorGroups,
  resolveHeatmapSeparatorLayout,
  resolveHeatmapSeparatorStrokeDasharray,
  buildHeatmapSeparatorGradientStops,
  isHeatmapHoverEffectEnabled,
  resolveHeatmapHoverStyle,
  resolveHeatmapRowOpacity,
  buildHeatmapRowOpacity,
  buildHeatmapLegendGradient,
};

export type {
  HeatmapBin,
  HeatmapColumn,
  HeatmapWeekRange,
  HeatmapWeekStartDay,
  HeatmapYAxisLabelFormat,
  HeatmapYAxisTickFilter,
  HeatmapDisplayRange,
  HeatmapSeparatorGroupBy,
  HeatmapSeparatorParsedConfig,
  HeatmapSeparatorGroup,
  HeatmapSeparatorLayout,
  HeatmapColumnSeparatorsConfig,
  HeatmapSeparatorLineYParams,
  HeatmapSeparatorLineYSpan,
  HeatmapSeparatorStrokeStyle,
  HeatmapSeparatorGradient,
  HeatmapSeparatorGradientStop,
  HeatmapHoverStyleParams,
  HeatmapHoverStyle,
};
