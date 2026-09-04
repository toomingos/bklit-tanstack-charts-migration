import { scaleLinear } from "d3-scale";
import { shortDateFmt } from "./formatters";
import { resolveYAxisTickCount } from "./y-axis-ticks";
import { TICKER_HALF_WIDTH, FADE_BUFFER } from "./design-tokens";
import type {
  ChartAxisTickLabelContext,
  ChartMotionDefinition,
  ChartPositionScaleOptions,
  ChartScale,
  ChartScaleInput,
} from "@tanstack/charts";
import type { XAxisConfig, YAxisConfig } from "./types";

// Compact-thousands formatting: values at or above this render as "Nk".
const COMPACT_THOUSANDS_DIVISOR = 1000;
// X tick-label baseline offset from the axis bottom margin.
const X_TICK_LABEL_DY_OFFSET = 26;
// Y tick-label horizontal offset, mirrored by orientation.
const Y_TICK_LABEL_DX = 8;

/**
 * Bklit formatLabel: formatValue override, else ≥1000 compacts to `"Nk"`.
 *
 * @param {number} value - Raw tick value in data units.
 * @param {((value: number) => string) | undefined} formatValue - Caller-supplied formatter taking precedence when defined.
 * @param {boolean} formatLargeNumbers - Whether values at or above 1000 compact to `"Nk"` via `toFixed(0)`.
 * @returns {string} Label text for the tick.
 */
const formatYAxisTick = (value: number, formatValue: ((value: number) => string) | undefined, formatLargeNumbers: boolean): string => {
  if (formatValue) {return formatValue(value);}
  if (formatLargeNumbers && value >= COMPACT_THOUSANDS_DIVISOR) {
    return `${(value / COMPACT_THOUSANDS_DIVISOR).toFixed(0)}k`;
  }
  return String(value);
}

/**
 * D3 linear ticks of the re-niced y domain (1–10 count clamp).
 *
 * @param {readonly [number, number]} yDomain - Data-unit [min, max] domain re-niced before ticking.
 * @param {number} [numTicks] - Desired tick-count hint forwarded to the tick-count resolver.
 * @returns {number[]} Tick values in data units.
 */
const buildYAxisTickValues = (yDomain: readonly [number, number], numTicks?: number): number[] => scaleLinear()
    .domain(yDomain)
    .nice()
    .ticks(resolveYAxisTickCount(numTicks));


/**
 * Labels within tickerHalfWidth vanish, then ramp to 1 across fadeBuffer.
 *
 * @param {Readonly<TickLabelFadeOpacityParams>} params - Label anchor/text, hovered ticker state, and fade radii.
 * @returns {number} Opacity in [0, 1] for the label.
 */
interface TickLabelFadeOpacityParams {
  readonly fadeBuffer: number;
  readonly hoveredLabel: string | null;
  readonly labelText: string;
  readonly labelX: number;
  readonly primaryX: number;
  readonly tickerHalfWidth: number;
}

const tickLabelFadeOpacity = (params: Readonly<TickLabelFadeOpacityParams>): number => {
  const { fadeBuffer, hoveredLabel, labelText, labelX, primaryX, tickerHalfWidth } = params;
  const distance = Math.abs(labelX - primaryX);
  if (distance < tickerHalfWidth) {return 0;}
  if (hoveredLabel !== null && hoveredLabel.length > 0 && labelText === hoveredLabel) {return 0;}
  if (distance < tickerHalfWidth + fadeBuffer) {
    return (distance - tickerHalfWidth) / fadeBuffer;
  }
  return 1;
}

interface XAxisPresentation {
  line: false;
  ticks: { count: number; size: number; padding: number };
  tickLabels:
    | false
    | {
        fontSize: number;
        thin: boolean;
        dy: number;
        opacity: number | ((context: ChartAxisTickLabelContext<Date>) => number | undefined);
        motion?: ChartMotionDefinition;
      };
}

interface FadeXAxisOptionsParams {
  readonly columnTicks: number;
  readonly labelFade: { readonly primaryX: number; readonly hoveredLabel: string | null } | null;
  readonly marginBottom: number;
  readonly xAxis: Readonly<XAxisConfig> | undefined;
}

const buildFadeXAxisOptions = (params: Readonly<FadeXAxisOptionsParams>): XAxisPresentation => {
  const { columnTicks, labelFade, marginBottom, xAxis } = params;
  return {
    line: false,
    tickLabels: xAxis
      ? {
          dy: marginBottom - X_TICK_LABEL_DY_OFFSET,
          fontSize: 12,
          opacity: labelFade
            ? (context: ChartAxisTickLabelContext<Date>) => tickLabelFadeOpacity({
                  fadeBuffer: FADE_BUFFER,
                  hoveredLabel: labelFade.hoveredLabel,
                  labelText: xAxis.formatValue === undefined ? shortDateFmt.format(context.value) : xAxis.formatValue(context.value),
                  labelX: context.position,
                  primaryX: labelFade.primaryX,
                  tickerHalfWidth: xAxis.tickerHalfWidth ?? TICKER_HALF_WIDTH,
                })
            : 1,
          thin: false,
        }
      : false,
    ticks: { count: columnTicks, padding: 0, size: 0 },
  };
};

interface PrecomputedXAxisOptionsParams {
  readonly columnTicks: number;
  readonly marginBottom: number;
  readonly tickLabelMotion: ChartMotionDefinition;
  readonly xAxis: Readonly<XAxisConfig> | undefined;
  readonly xTickLabelOpacity: number | ((context: ChartAxisTickLabelContext<Date>) => number | undefined);
}

const buildPrecomputedXAxisOptions = (params: Readonly<PrecomputedXAxisOptionsParams>): XAxisPresentation => {
  const { columnTicks, marginBottom, tickLabelMotion, xAxis, xTickLabelOpacity } = params;
  return {
    line: false,
    tickLabels: xAxis
      ? {
          dy: marginBottom - X_TICK_LABEL_DY_OFFSET,
          fontSize: 12,
          motion: tickLabelMotion,
          opacity: xTickLabelOpacity,
          thin: false,
        }
      : false,
    ticks: { count: columnTicks, padding: 0, size: 0 },
  };
};

interface YAxisOptionsParams {
  readonly gridHorizontal: boolean;
  readonly scale: ChartScale | ChartScaleInput<number>;
  readonly tickLabelMotion: ChartMotionDefinition;
  readonly yAxis: Readonly<YAxisConfig>;
  readonly yDomainForTicks: readonly [number, number];
}

const buildYAxisOptions = (params: Readonly<YAxisOptionsParams>): ChartPositionScaleOptions<number> => {
  const { gridHorizontal, scale, tickLabelMotion, yAxis, yDomainForTicks } = params;
  return {
    axis: {
      line: false,
      tickLabels: {
        dx: yAxis.orientation === "right" ? Y_TICK_LABEL_DX : -Y_TICK_LABEL_DX,
        fontSize: 12,
        motion: tickLabelMotion,
        opacity: 1,
        thin: false,
      },
      ticks: {
        format: (tickValue: number) => formatYAxisTick(tickValue, yAxis.formatValue, yAxis.formatLargeNumbers ?? true),
        padding: 0,
        size: 0,
        values: buildYAxisTickValues(yDomainForTicks, yAxis.numTicks),
      },
    },
    grid: gridHorizontal,
    scale,
    side: yAxis.orientation === "right" ? "right" : "left",
  };
};

interface HiddenAxisOptions {
  readonly line: false;
  readonly tickLabels: false;
  readonly ticks: {
    readonly count: number;
    readonly size: number;
  };
}

const hiddenAxisOptions = (tickCount: number): HiddenAxisOptions => (
  { line: false, tickLabels: false, ticks: { count: tickCount, size: 0 } }
);

export { formatYAxisTick, buildYAxisTickValues, tickLabelFadeOpacity, buildFadeXAxisOptions, buildPrecomputedXAxisOptions, buildYAxisOptions, hiddenAxisOptions };
export type { XAxisPresentation };
