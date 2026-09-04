import type { ChartMark, ChartMotionDefinition } from "@tanstack/charts";
import { dot } from "@tanstack/charts/dot";
import { whenFocused } from "@tanstack/charts/focus/mark";
import { toDate } from "./coerce-date";
import { isFiniteNumber } from "./scatter-datum-utils";
import { createScatterEnterMotion, createYGradientScatterMark } from "./scatter-marks";
import type { ResolvedSeries } from "./scatter-marks";
import { withMarkerBaseClassName } from "./series-marker-mark";
import type { MotionEasing } from "./reveal-easing";
import type { ChartDatum } from "./types";

// Fixed 0.5s enter tween (bklit SeriesPointMarker).
const ENTER_TWEEN_MS = 500;
// Hovered group pops to 1.35x radius; the rest dim to inactiveOpacity (default 0.5).
const ACTIVE_HIGHLIGHT_SCALE = 1.35;
// Enter-motion highlight pad as a fraction of the dot radius.
const SCATTER_ENTER_HIGHLIGHT_PAD_FRACTION = 0.35;

interface BuildSeriesEnterMotionParams {
  readonly animate: boolean;
  readonly durationSec: number;
  readonly easing: MotionEasing;
  readonly innerWidth: number;
  readonly radius: number;
  readonly ringGap: number;
  readonly strokeWidth: number;
}

const buildSeriesEnterMotion = ({
  animate,
  durationSec,
  easing,
  innerWidth,
  radius,
  ringGap,
  strokeWidth,
}: Readonly<BuildSeriesEnterMotionParams>): ChartMotionDefinition<ChartDatum> | false => {
  if (!animate) {return false;}
  const enterRing = strokeWidth > 0 ? ringGap + strokeWidth : 0;
  const enterHighlightPad = radius * SCATTER_ENTER_HIGHLIGHT_PAD_FRACTION;
  const enterVisualExtent = radius + enterRing + enterHighlightPad + 2;
  return createScatterEnterMotion({ easing, fadeDurationMs: ENTER_TWEEN_MS, innerWidth, staggerDurationSec: durationSec, visualExtent: enterVisualExtent });
};

interface BuildActiveScatterMarkParams {
  readonly baseR: number;
  readonly projectY: (value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedFill: string;
  readonly series: Readonly<ResolvedSeries>;
  readonly xDataKey: string;
}

const buildActiveScatterMark = ({
  baseR,
  projectY,
  renderData,
  resolvedFill,
  series,
  xDataKey,
}: Readonly<BuildActiveScatterMarkParams>): ChartMark<ChartDatum, Date, number> => {
  const activeScatterMark = dot(renderData, {
    fill: resolvedFill,
    id: `${series.dataKey}__active`,
    r: baseR * ACTIVE_HIGHLIGHT_SCALE,
    stroke: "none",
    x: (datum: Readonly<ChartDatum>) => toDate(datum[xDataKey]),
    y: (datum: Readonly<ChartDatum>) => {
      const value = datum[series.dataKey];
      return isFiniteNumber(value) ? projectY(value) : undefined;
    },
  });
  return whenFocused(activeScatterMark, { match: "group", retarget: true });
};

interface BuildScatterSeriesMarksParams {
  readonly enterMotion: ChartMotionDefinition<ChartDatum> | false;
  readonly gradientId: string | undefined;
  readonly hasRing: boolean;
  readonly projectY: (value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly scatterDimmed: boolean;
  readonly series: Readonly<ResolvedSeries>;
  readonly xDataKey: string;
}

const buildScatterSeriesMarks = ({
  enterMotion,
  gradientId,
  hasRing,
  projectY,
  renderData,
  scatterDimmed,
  series,
  xDataKey,
}: Readonly<BuildScatterSeriesMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (series.useYGradient) {
    return [createYGradientScatterMark({ motion: enterMotion, projectY, series, source: renderData, xDataKey })];
  }
  const baseR = hasRing ? series.radius + series.ringGap + series.strokeWidth : series.radius;
  const resolvedFill = gradientId === undefined ? series.fill : `url(#${gradientId})`;
  const baseScatterMark = dot(renderData, {
    fill: resolvedFill,
    id: series.dataKey,
    motion: enterMotion,
    r: baseR,
    stroke: "none",
    x: (datum: Readonly<ChartDatum>) => toDate(datum[xDataKey]),
    y: (datum: Readonly<ChartDatum>) => {
      const value = datum[series.dataKey];
      return isFiniteNumber(value) ? projectY(value) : undefined;
    },
  });
  if (!series.showActiveHighlight) {return [withMarkerBaseClassName(baseScatterMark, scatterDimmed)];}
  return [
    withMarkerBaseClassName(baseScatterMark, scatterDimmed),
    buildActiveScatterMark({ baseR, projectY, renderData, resolvedFill, series, xDataKey }),
  ];
};

interface SeriesMarksProjector {
  readonly projectorFor: (axisId?: string | number) => (value: number) => number;
  readonly renderData: readonly ChartDatum[];
  readonly resolvedSeries: readonly Readonly<ResolvedSeries>[];
  readonly xDataKey: string;
}

interface BuildAllSeriesMarksParams extends SeriesMarksProjector {
  readonly durationSec: number;
  readonly easing: MotionEasing;
  readonly gradientIdBySeries: Readonly<Map<string, string>>;
  readonly innerWidth: number;
  readonly pointerFocusActive: boolean;
}

const buildAllSeriesMarks = ({
  durationSec,
  easing,
  gradientIdBySeries,
  innerWidth,
  pointerFocusActive,
  projectorFor,
  renderData,
  resolvedSeries,
  xDataKey,
}: Readonly<BuildAllSeriesMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const marks: ChartMark<ChartDatum, Date, number>[] = [];
  for (const series of resolvedSeries) {
    const projectY = projectorFor(series.yAxisId);
    const enterMotion = buildSeriesEnterMotion({
      animate: series.animate,
      durationSec,
      easing,
      innerWidth,
      radius: series.radius,
      ringGap: series.ringGap,
      strokeWidth: series.strokeWidth,
    });
    const hasRing = series.strokeWidth > 0;
    const gradientId = hasRing ? gradientIdBySeries.get(series.dataKey) : undefined;
    marks.push(
      ...buildScatterSeriesMarks({
        enterMotion,
        gradientId,
        hasRing,
        projectY,
        renderData,
        scatterDimmed: series.fadeOnHover && pointerFocusActive,
        series,
        xDataKey,
      }),
    );
  }
  return marks;
};

export { ACTIVE_HIGHLIGHT_SCALE, buildActiveScatterMark, buildAllSeriesMarks, buildScatterSeriesMarks, buildSeriesEnterMotion, ENTER_TWEEN_MS };
export type { BuildActiveScatterMarkParams, BuildAllSeriesMarksParams, BuildScatterSeriesMarksParams, BuildSeriesEnterMotionParams, SeriesMarksProjector };
