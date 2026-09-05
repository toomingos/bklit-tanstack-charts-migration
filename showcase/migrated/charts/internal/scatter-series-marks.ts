import type { ChartMark, ChartMotionDefinition } from "@tanstack/charts";
import { whenFocused } from "@tanstack/charts/focus/mark";
import { createScatterDotMark } from "./scatter-dot-mark";
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
// Ring extent contributed when the series has no stroke to draw a ring with.
const NO_RING_EXTENT = 0;
// Extra pixel pad around the enter-motion visual extent so the tween never clips the dot edge.
const ENTER_VISUAL_EXTENT_PAD_PX = 2;

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
  const enterRing = strokeWidth > NO_RING_EXTENT ? ringGap + strokeWidth : NO_RING_EXTENT;
  const enterHighlightPad = radius * SCATTER_ENTER_HIGHLIGHT_PAD_FRACTION;
  const enterVisualExtent = radius + enterRing + enterHighlightPad + ENTER_VISUAL_EXTENT_PAD_PX;
  return createScatterEnterMotion({ easing, fadeDurationMs: ENTER_TWEEN_MS, innerWidth, staggerDurationSec: durationSec, visualExtent: enterVisualExtent });
};

interface BuildActiveScatterMarkParams {
  readonly projectY: (value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly series: Readonly<ResolvedSeries>;
  readonly xDataKey: string;
}

const buildActiveScatterMark = ({
  projectY,
  renderData,
  series,
  xDataKey,
}: Readonly<BuildActiveScatterMarkParams>): ChartMark<ChartDatum, Date, number> => {
  // Bklit scales the whole marker (disc, ring gap, ring stroke) about the dot centre.
  // Baking ACTIVE_HIGHLIGHT_SCALE into the geometry reproduces that transform.
  const activeScatterMark = createScatterDotMark({
    markId: `${series.dataKey}__active`,
    motion: false,
    projectY,
    scale: ACTIVE_HIGHLIGHT_SCALE,
    series,
    source: renderData,
    xDataKey,
  });
  return whenFocused(activeScatterMark, { match: "group", retarget: true });
};

interface BuildScatterSeriesMarksParams {
  readonly enterMotion: ChartMotionDefinition<ChartDatum> | false;
  readonly projectY: (value: number) => number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly scatterDimmed: boolean;
  readonly series: Readonly<ResolvedSeries>;
  readonly xDataKey: string;
}

const buildScatterSeriesMarks = ({
  enterMotion,
  projectY,
  renderData,
  scatterDimmed,
  series,
  xDataKey,
}: Readonly<BuildScatterSeriesMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  if (series.useYGradient) {
    return [createYGradientScatterMark({ motion: enterMotion, projectY, series, source: renderData, xDataKey })];
  }
  const baseScatterMark = createScatterDotMark({
    markId: series.dataKey,
    motion: enterMotion,
    projectY,
    scale: 1,
    series,
    source: renderData,
    xDataKey,
  });
  if (!series.showActiveHighlight) {return [withMarkerBaseClassName(baseScatterMark, scatterDimmed)];}
  return [
    withMarkerBaseClassName(baseScatterMark, scatterDimmed),
    buildActiveScatterMark({ projectY, renderData, series, xDataKey }),
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
  readonly innerWidth: number;
  readonly pointerFocusActive: boolean;
}

const buildAllSeriesMarks = ({
  durationSec,
  easing,
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
    marks.push(
      ...buildScatterSeriesMarks({
        enterMotion,
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
