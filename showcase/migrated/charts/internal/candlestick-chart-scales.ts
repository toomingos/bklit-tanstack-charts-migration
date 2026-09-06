// Candlestick scales and definition options: time/y extents, x/y scale builders, tooltip and reveal targets.
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ChartScale, ChartTooltipInput, ResolvedScale } from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { buildXAxisTickValues, formatYAxisTick } from "./axis-ticks";
import { resolveYAxisTickCount } from "./y-axis-ticks";
import { BOX_OFFSET, TOOLTIP_BOX_SPRING } from "./design-tokens";
import type { ChartDatum, ExtractedChildren } from "./types";
import {
  GEOMETRY_HALF_DIVISOR,
  MIN_GEOMETRY_EXTENT_PX,
  MIN_ROW_COUNT,
  NO_ANIMATION_DURATION_MS,
  isNumber,
} from "./candlestick-chart-shared";

// Tick counts for the axis defaults below.
const DEFAULT_TICK_COUNT = 5;

// Grid fallback stays so builds against engines omitting tickCount keep the legacy default.
// Nullable params keep the coalescing guards genuinely conditional.
const coalesceTickCount = (primary: number | undefined, secondary: number | undefined): number =>
  primary ?? secondary ?? DEFAULT_TICK_COUNT;

/**
 * Tracks the lower time bound across scanned rows (pure; NaN candidates never win).
 *
 * @param {number} current - Bound accumulated so far.
 * @param {number} candidate - New scanned time value.
 * @returns {number} The earlier of the two values.
 */
const lowerTimeBound = (current: number, candidate: number): number => (candidate < current ? candidate : current);

/**
 * Tracks the upper time bound across scanned rows (pure; NaN candidates never win).
 *
 * @param {number} current - Bound accumulated so far.
 * @param {number} candidate - New scanned time value.
 * @returns {number} The later of the two values.
 */
const upperTimeBound = (current: number, candidate: number): number => (candidate > current ? candidate : current);

interface CandleYExtremes {
  readonly min: number;
  readonly max: number;
}

/**
 * Scans candle rows for the y-domain extremes (definition-memo time).
 *
 * @param {readonly Readonly<ChartDatum>[]} source - Raw candle rows backing the chart.
 * @returns {CandleYExtremes | undefined} Finite low/high extremes, or undefined when no row qualifies.
 */
const findCandleYExtremes = (source: readonly Readonly<ChartDatum>[]): CandleYExtremes | undefined => {
  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;
  for (const row of source) {
    const { high, low } = row;
    minVal = isNumber(low) && low < minVal ? low : minVal;
    maxVal = isNumber(high) && high > maxVal ? high : maxVal;
  }
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {return undefined;}
  return { max: maxVal, min: minVal };
};

interface CandleTimeExtent {
  readonly minTime: number;
  readonly maxTime: number;
}

/**
 * Scans rows for the selection time extent (selection-memo time).
 *
 * @param {readonly Readonly<ChartDatum>[]} source - Raw candle rows backing the chart.
 * @param {string} xDataKey - Datum field holding the point date.
 * @returns {CandleTimeExtent | undefined} Finite time bounds, or undefined with no dates.
 */
const findCandleTimeExtent = (source: readonly Readonly<ChartDatum>[], xDataKey: string): CandleTimeExtent | undefined => {
  let minTime = Infinity;
  let maxTime = -Infinity;
  for (const datum of source) {
    const value = datum[xDataKey];
    if (value instanceof Date) {
      minTime = lowerTimeBound(minTime, value.getTime());
      maxTime = upperTimeBound(maxTime, value.getTime());
    }
  }
  if (!Number.isFinite(minTime)) {return undefined;}
  return { maxTime, minTime };
};

interface CandleYScaleParams {
  readonly formatLargeNumbers: boolean | undefined;
  readonly formatValue: ((value: number) => string) | undefined;
  readonly gridNumTicks: number | undefined;
  readonly hasYAxis: boolean;
  readonly yMax: number;
  readonly yMin: number;
  readonly yNumTicks: number | undefined;
}

/**
 * Builds the y scale with padded domain ticks (definition-memo time).
 *
 * @param {Readonly<CandleYScaleParams>} params - Padded domain bounds plus axis/grid inputs.
 * @returns {ChartScale} Linear y scale with legacy label formatting.
 */
const buildCandleYScale = (params: Readonly<CandleYScaleParams>): ChartScale => {
  const { formatLargeNumbers, formatValue, gridNumTicks, hasYAxis, yMax, yMin, yNumTicks } = params;
  const yScale: ChartScale = {
    id: "y",
    resolve(context) {
      const scale = scaleLinear()
        .domain([yMin, yMax])
        .nice()
        .range(context.range);
      // Native y ticks follow the label-tick source; the grid follows the labels in that case.
      const tickCount = hasYAxis ? resolveYAxisTickCount(yNumTicks) : coalesceTickCount(context.tickCount, gridNumTicks);
      const tickValues = scale.ticks(tickCount);
      return {
        bandwidth: 0,
        domain: scale.domain(),
        id: context.id,
        map: (value: unknown) => {
          if (!isNumber(value)) {return Number.NaN;}
          return scale(value);
        },
        ticks: tickValues.map((value) => ({
          label: hasYAxis ? formatYAxisTick(value, formatValue, formatLargeNumbers ?? true) : String(value),
          position: scale(value),
          value,
        })),
        type: "linear",
      };
    },
  };
  return yScale;
};

interface CandleXScaleParams {
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly timeExtent: CandleTimeExtent;
  readonly xAxis: ExtractedChildren["xAxis"];
  readonly xDataKey: string;
}

/**
 * Builds the x scale with the slotWidth/2 range inset (definition-memo time).
 *
 * @param {Readonly<CandleXScaleParams>} params - Rows, time extent, and the x-axis child config.
 * @returns {ChartScale} Time x scale with legacy tick values.
 */
const buildCandleXScale = (params: Readonly<CandleXScaleParams>): ChartScale => {
  const { renderData, timeExtent, xAxis, xDataKey } = params;
  const { minTime, maxTime } = timeExtent;
  const count = Math.max(renderData.length, MIN_ROW_COUNT);
  return {
    id: "x",
    resolve(context): ResolvedScale {
      const [r0, r1] = context.range;
      const lo = Math.min(r0, r1);
      const hi = Math.max(r0, r1);
      const localSlotWidth = Math.max(MIN_GEOMETRY_EXTENT_PX, hi - lo) / count;
      const padding = localSlotWidth / GEOMETRY_HALF_DIVISOR;
      const insetLo = lo + padding;
      const insetHi = Math.max(insetLo, hi - padding);
      const scale = scaleUtc().domain([minTime, maxTime]).range([insetLo, insetHi]);
      const ticks = xAxis
        ? buildXAxisTickValues({
            data: renderData,
            formatValue: xAxis.formatValue,
            numTicks: xAxis.numTicks ?? DEFAULT_TICK_COUNT,
            rangeEnd: insetHi,
            rangeStart: insetLo,
            tickMode: xAxis.tickMode,
            xDataKey,
          }).map(({ value, label }: { readonly label: string; readonly value: Readonly<Date> }) => ({
            label,
            position: scale(value),
            value,
          }))
        : scale.ticks(context.tickCount).map((value: Readonly<Date>) => ({
            label: value.toISOString(),
            position: scale(value),
            value,
          }));
      return {
        bandwidth: 0,
        domain: scale.domain(),
        id: context.id,
        map: (value: unknown): number => {
          if (!(value instanceof Date)) {return Number.NaN;}
          return scale(value);
        },
        ticks,
        type: "time",
      };
    },
  };
};

interface CandleTooltipOptionParams {
  readonly discrete: boolean;
  readonly tooltipEnabled: boolean;
}

/**
 * Builds the package tooltip extension for the chart definition (definition-memo time).
 *
 * @param {Readonly<CandleTooltipOptionParams>} params - Discrete mode and tooltip enablement.
 * @returns {ChartTooltipInput<ChartDatum, Date, number, "dom"> | false} Tooltip extension, or false when disabled.
 */
const buildCandleTooltipOption = (params: Readonly<CandleTooltipOptionParams>): ChartTooltipInput<ChartDatum, Date, number, "dom"> | false => {
  const { discrete, tooltipEnabled } = params;
  if (!tooltipEnabled) {return false;}
  return {
    // Viewport-aware via the live x scale, falling back to pixel x.
    anchor: (_points, context) => {
      const { primary } = context.focus;
      const scale = context.scales.x;
      const position = (scale.viewport?.map ?? scale.map)(primary.xValue);
      return {
        x: Number.isFinite(position) ? position : primary.x,
        y: context.plot.y - BOX_OFFSET,
      };
    },
    className: "bkm-native-tooltip",
    motion: discrete
      ? (false as const)
      : { damping: TOOLTIP_BOX_SPRING.damping, stiffness: TOOLTIP_BOX_SPRING.stiffness, type: "spring" as const },
    offset: BOX_OFFSET,
    placement: ["bottom-right", "bottom-left"] as const,
    portal,
    sticky: false,
    use: tooltip,
  };
};

/**
 * Resolves whether candle marks render target geometry (shown once revealed or when animation is off).
 *
 * @param {boolean} revealed - Whether the reveal flip has run.
 * @param {number} animationDuration - Enter animation duration in milliseconds.
 * @param {boolean} animate - Whether candle animation is enabled.
 * @returns {boolean} True when target geometry should render.
 */
const resolveCandleTargetGeometry = (revealed: boolean, animationDuration: number, animate: boolean): boolean =>
  revealed || animationDuration <= NO_ANIMATION_DURATION_MS || !animate;

export type { CandleTimeExtent };
export {
  buildCandleTooltipOption,
  buildCandleXScale,
  buildCandleYScale,
  findCandleTimeExtent,
  findCandleYExtremes,
  resolveCandleTargetGeometry,
};
