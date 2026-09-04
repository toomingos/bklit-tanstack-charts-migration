import { scaleLinear } from "d3-scale";
import type { ChartMark } from "@tanstack/charts";
import { timeToPixelX } from "./x-time-scale";
import { toDate } from "./coerce-date";
import type { TerminalMarkerAnchor } from "./terminal-marker-phase";
import type { ProjectionEndMarkerAnchor } from "./terminal-marker";
import type { ProjectionPoint } from "./projection-utils";
import { gridHighlightRowMarks } from "./grid-highlight-mark";
import { resolveGridGuide } from "./grid";
import type { ChartDatum, GridConfig, SeriesPointMarkerStyle } from "./types";

// Rendered x-domain extent; mirrors the inline timeExtentRaw/timeExtent shapes.
interface OverlayTimeExtent {
  readonly maxTime: number;
  readonly minTime: number;
}

interface GridHighlightRowMarksParams {
  readonly grid: GridConfig | null;
  readonly heightPx: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly width: number;
  readonly yDomainFinal: readonly [number, number];
}

const buildGridHighlightRowMarks = (params: Readonly<GridHighlightRowMarksParams>): ChartMark<ChartDatum, Date, number>[] => {
  const gridGuide = resolveGridGuide(params.grid);
  const highlightGrid = params.grid && gridGuide.horizontal ? params.grid : undefined;
  if (!highlightGrid || !highlightGrid.highlightRowValues || highlightGrid.highlightRowValues.length === 0 || params.width <= 0) {
    return [];
  }
  const innerWidth = Math.max(0, params.width - params.marginLeft - params.marginRight);
  const innerHeight = Math.max(0, params.heightPx - params.marginTop - params.marginBottom);
  if (innerWidth <= 0 || innerHeight <= 0) {
    return [];
  }
  const highlightScale = scaleLinear().domain(params.yDomainFinal).range([innerHeight, 0]);
  return gridHighlightRowMarks({
    grid: params.grid,
    yScale: (value: number) => highlightScale(value),
  });
};

interface OverlayScales {
  readonly innerWidth: number;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

interface OverlayScaleParams {
  readonly extentMaxTime: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly rawMinTime: number;
  readonly yDomainFinal: readonly [number, number];
}

const resolveOverlayScales = (params: Readonly<OverlayScaleParams>): OverlayScales => ({
  innerWidth: params.innerWidth,
  xScale: (value: Readonly<Date>): number => timeToPixelX(value, params.rawMinTime, params.extentMaxTime, params.innerWidth),
  yScale: scaleLinear().domain(params.yDomainFinal).range([params.innerHeight, 0]),
});

interface AnchorFrame {
  readonly extentMaxTime: number;
  readonly innerWidth: number;
  readonly rawMinTime: number;
  readonly yScale: (value: number) => number;
}

interface AnchorFrameParams {
  readonly heightPx: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly timeExtent: Readonly<OverlayTimeExtent> | undefined;
  readonly timeExtentRaw: Readonly<OverlayTimeExtent> | undefined;
  readonly width: number;
  readonly yDomainFinal: readonly [number, number];
}

const resolveAnchorFrame = (params: Readonly<AnchorFrameParams>): AnchorFrame | undefined => {
  const innerWidth = Math.max(0, params.width - params.marginLeft - params.marginRight);
  const innerHeight = Math.max(0, params.heightPx - params.marginTop - params.marginBottom);
  const rawExtent = params.timeExtentRaw;
  const extent = params.timeExtent;
  if (innerWidth <= 0 || innerHeight <= 0 || !extent || !rawExtent) {
    return undefined;
  }
  return {
    extentMaxTime: extent.maxTime,
    innerWidth,
    rawMinTime: rawExtent.minTime,
    yScale: scaleLinear().domain(params.yDomainFinal).range([innerHeight, 0]),
  };
};

type TerminalMarkerSource = Readonly<SeriesPointMarkerStyle> & {
  readonly dataKey: string;
};

interface TerminalAnchorDefaults {
  readonly fallbackStroke: string;
  readonly markerRadius: number;
  readonly terminalStrokeWidth: number;
}

interface TerminalAnchorParams {
  readonly defaults: Readonly<TerminalAnchorDefaults>;
  readonly heightPx: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly terminalMarkers: readonly Readonly<TerminalMarkerSource>[];
  readonly timeExtent: Readonly<OverlayTimeExtent> | undefined;
  readonly timeExtentRaw: Readonly<OverlayTimeExtent> | undefined;
  readonly width: number;
  readonly xDataKey: string;
  readonly yDomainFinal: readonly [number, number];
}

interface TerminalAnchorContext {
  readonly defaults: Readonly<TerminalAnchorDefaults>;
  readonly frame: Readonly<AnchorFrame>;
  readonly lastRow: Readonly<ChartDatum>;
  readonly xDataKey: string;
}

// Terminal markers anchor to the last visible row, not the last raw data row.
const isNumber = <Subject>(value: Subject): value is Subject & number => typeof value === "number";

const resolveTerminalAnchor = (
  marker: Readonly<TerminalMarkerSource>,
  context: Readonly<TerminalAnchorContext>,
): TerminalMarkerAnchor | undefined => {
  const rowValue = context.lastRow[marker.dataKey];
  const dateValue = toDate(context.lastRow[context.xDataKey]);
  if (!isNumber(rowValue) || !Number.isFinite(rowValue) || !dateValue) {
    return undefined;
  }
  const cx = timeToPixelX(dateValue, context.frame.rawMinTime, context.frame.extentMaxTime, context.frame.innerWidth);
  const cy = context.frame.yScale(rowValue);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
    return undefined;
  }
  return {
    cx,
    cy,
    dataKey: marker.dataKey,
    fill: marker.fill ?? "transparent",
    outlineColor: marker.outlineColor,
    outlineWidth: marker.outlineWidth ?? 0,
    radius: marker.radius ?? context.defaults.markerRadius,
    ringGap: marker.ringGap ?? 0,
    stroke: marker.stroke ?? context.defaults.fallbackStroke,
    strokeWidth: marker.strokeWidth ?? context.defaults.terminalStrokeWidth,
  };
};

const buildTerminalAnchors = (params: Readonly<TerminalAnchorParams>): TerminalMarkerAnchor[] => {
  if (params.terminalMarkers.length === 0 || params.renderData.length === 0 || params.width <= 0 || params.heightPx <= 0) {
    return [];
  }
  const frame = resolveAnchorFrame(params);
  const lastRow = params.renderData.at(-1);
  if (!frame || !lastRow) {
    return [];
  }
  return params.terminalMarkers.flatMap((marker: Readonly<TerminalMarkerSource>) => {
    const anchor = resolveTerminalAnchor(marker, { defaults: params.defaults, frame, lastRow, xDataKey: params.xDataKey });
    return anchor ? [anchor] : [];
  });
};

interface ProjectionEndMarkerSource {
  readonly data: readonly Readonly<ProjectionPoint>[];
  readonly radius?: number;
  readonly stroke?: string;
  readonly strokeOpacity?: number;
}

interface ProjectionEndAnchorParams {
  readonly fallbackStroke: string;
  readonly heightPx: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
  readonly marginTop: number;
  readonly markerRadius: number;
  readonly projectionEndMarkers: readonly Readonly<ProjectionEndMarkerSource>[];
  readonly timeExtent: Readonly<OverlayTimeExtent> | undefined;
  readonly timeExtentRaw: Readonly<OverlayTimeExtent> | undefined;
  readonly width: number;
  readonly yDomainFinal: readonly [number, number];
}

interface ProjectionEndAnchorContext {
  readonly fallbackStroke: string;
  readonly frame: Readonly<AnchorFrame>;
  readonly markerRadius: number;
}

const resolveProjectionEndAnchor = (
  marker: Readonly<ProjectionEndMarkerSource>,
  context: Readonly<ProjectionEndAnchorContext>,
): ProjectionEndMarkerAnchor | undefined => {
  if (marker.data.length < 2) {
    return undefined;
  }
  const [last] = marker.data.slice(-1);
  const dateValue = last.date instanceof Date ? last.date : new Date(last.date);
  const radius = marker.radius ?? context.markerRadius;
  const cx = Math.min(
    timeToPixelX(dateValue, context.frame.rawMinTime, context.frame.extentMaxTime, context.frame.innerWidth),
    Math.max(0, context.frame.innerWidth - (radius + 1)),
  );
  const cy = context.frame.yScale(last.value);
  if (Number.isNaN(dateValue.getTime()) || !Number.isFinite(cx) || !Number.isFinite(cy)) {
    return undefined;
  }
  return { cx, cy, radius, stroke: marker.stroke ?? context.fallbackStroke, strokeOpacity: marker.strokeOpacity ?? 1 };
};

const buildProjectionEndAnchors = (params: Readonly<ProjectionEndAnchorParams>): ProjectionEndMarkerAnchor[] => {
  if (params.projectionEndMarkers.length === 0 || params.width <= 0 || params.heightPx <= 0) {
    return [];
  }
  const frame = resolveAnchorFrame(params);
  if (!frame) {
    return [];
  }
  return params.projectionEndMarkers.flatMap((marker: Readonly<ProjectionEndMarkerSource>) => {
    const anchor = resolveProjectionEndAnchor(marker, { fallbackStroke: params.fallbackStroke, frame, markerRadius: params.markerRadius });
    return anchor ? [anchor] : [];
  });
};

export {
  buildGridHighlightRowMarks,
  buildProjectionEndAnchors,
  buildTerminalAnchors,
  resolveOverlayScales,
};
export type {
  AnchorFrame,
  GridHighlightRowMarksParams,
  OverlayScales,
  OverlayScaleParams,
  OverlayTimeExtent,
  ProjectionEndAnchorParams,
  TerminalAnchorParams,
};
