// Custom bar mark for ComposedChart — replaces stock `barY()` whose
// `inferBandwidth` formula (`minSpacing × 0.8`) diverges from bklit's own
// `computeSeriesBarWidth` (`slot × 0.88`) on continuous time scales, causing
// a ~4.5% pixel diff at n=4.
//
// This mark uses bklit's exact bar-width math (computeSeriesBarWidth) and
// unstacked-group layout (computeSeriesBarLayout), emits `kind:'rect'` nodes
// with explicit x/y/width/height/fill, and emits ChartPoints for hover/focus
// plumbing. The `.ts-chart__bar-y` className contract is preserved so the
// existing WAAPI stagger reveal in composed-chart.tsx's `handleRender` finds
// the same selectors.
import { createMark } from "@tanstack/charts";
import type { ChartMark, ChartPoint, SceneNode } from "@tanstack/charts";
import { computeSeriesBarWidth } from "./series-bar-layout";
import type { ChartDatum } from "./types";

export interface SeriesBarMarkOptions {
  /** Mark id — by convention the bar's dataKey, matching the stock barY id. */
  id: string;
  /** Accessor for the x (time) value of each datum. */
  xAccessor: (d: ChartDatum) => Date;
  /** Accessor for the y (bar height) value of each datum. */
  yAccessor: (d: ChartDatum) => number;
  /** Fill color for the bar rects. */
  fill: string;
  /** Corner radius for bar top corners. Default: 0. */
  radius?: number;
  /** All bar series dataKeys in the group (for computing group-width layout).
      Default: [id] (single-series, no group). */
  groupDataKeys?: string[];
  /** This series' 0-based index within the group. Default: 0. */
  seriesIndex?: number;
  /** Gap in px between grouped bars. Default: 4 (bklit ComposedChart default). */
  barGap?: number;
  /** bklit `barSize` — target bar width in px. */
  barSize?: number;
  /** bklit `maxBarSize` — clamp on bar width. */
  maxBarSize?: number;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function seriesBarMark(
  data: ChartDatum[],
  options: SeriesBarMarkOptions,
): ChartMark<ChartDatum, Date, number> {
  const {
    id,
    xAccessor,
    yAccessor,
    fill,
    radius = 0,
    groupDataKeys = [id],
    seriesIndex = 0,
    barGap = 4,
    barSize,
    maxBarSize,
  } = options;
  const seriesCount = groupDataKeys.length;
  const gap = barGap;

  return createMark(() => {
    const xValues = data.map((d) => xAccessor(d));
    const yValues = data.map((d) => yAccessor(d));

    return {
      id,
      channels: {
        x: { scale: "x", values: xValues },
        y: {
          scale: "y",
          values: yValues.filter(isFiniteNumber),
          includeZero: true,
        },
      },
      render: ({ scales, chart }) => {
        const nodes: SceneNode[] = [];
        const points: ChartPoint<ChartDatum, Date, number>[] = [];

        // bklit `computeSeriesBarWidth` with `slot = innerWidth/(dataLength-1)`,
        // same as the current composed-chart's `columnWidth` (no groupScale
        // padding needed — this mark handles grouping manually).
        const slotWidth =
          data.length < 2 ? chart.width : chart.width / (data.length - 1);
        const barWidth = computeSeriesBarWidth({
          innerWidth: chart.width,
          dataLength: data.length,
          columnWidth: slotWidth,
          seriesCount,
          composedBarSize: barSize,
          composedMaxBarSize: maxBarSize,
          composedBarGap: gap,
        });

        // bklit `computeSeriesBarLayout` for unstacked groups:
        // groupWidth = n × barWidth + (n−1) × gap
        // barLeft = xCenter − groupWidth/2 + seriesIndex × (barWidth + gap)
        const groupWidth =
          seriesCount > 1
            ? seriesCount * barWidth + (seriesCount - 1) * gap
            : barWidth;

        const baseline = scales.y.map(0);

        for (let i = 0; i < data.length; i++) {
          const datum = data[i]!;
          const xValue = xValues[i]!;
          const yValue = yValues[i];

          if (!isFiniteNumber(yValue)) continue;

          const xCenter = scales.x.map(xValue);
          if (!Number.isFinite(xCenter)) continue;

          const yTop = scales.y.map(yValue);
          if (!Number.isFinite(yTop)) continue;

          const barLeft = xCenter - groupWidth / 2 + seriesIndex * (barWidth + gap);
          const barY = Math.min(yTop, baseline);
          const barHeight = Math.abs(baseline - yTop);

          const key = `${id}:rect:${i}`;
          nodes.push({
            kind: "rect",
            key,
            x: barLeft,
            y: barY,
            width: barWidth,
            height: barHeight,
            radius: radius || undefined,
            style: { fill },
          });

          points.push({
            key,
            markId: id,
            group: id,
            groupLabel: id,
            datum,
            datumIndex: i,
            xValue,
            yValue: yValue,
            x: xCenter,
            y: yTop,
            color: fill,
          });
        }

        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__bar ts-chart__bar-y",
              ariaHidden: true,
              children: nodes,
            },
          ],
          points,
        };
      },
    };
  });
}
