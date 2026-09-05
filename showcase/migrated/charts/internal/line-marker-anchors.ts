import { useMemo } from "react";
import { useChartStable } from "./chart-context";
import { toDate } from "./coerce-date";
import type { TerminalMarkerAnchor } from "./terminal-marker-phase";
import type { ProjectionEndMarkerAnchor } from "./terminal-marker";
import type { ProjectionPoint } from "./projection-utils";
import type { ChartDatum, SeriesPointMarkerStyle } from "./types";

// Rendered x-domain extent; mirrors the inline timeExtentRaw/timeExtent shapes.
interface OverlayTimeExtent {
  readonly maxTime: number;
  readonly minTime: number;
}

// Host-sourced overlay mapping (V1.2/G6); built by the host-child wrapper.
interface OverlayMappers {
  readonly xMap: (value: Readonly<Date>) => number;
  readonly yMap: (value: number) => number;
  readonly innerWidth: number;
  readonly rightEdge: number;
}

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
  readonly mappers: Readonly<OverlayMappers>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly terminalMarkers: readonly Readonly<TerminalMarkerSource>[];
  readonly xDataKey: string;
}

interface TerminalAnchorContext {
  readonly defaults: Readonly<TerminalAnchorDefaults>;
  readonly mappers: Readonly<OverlayMappers>;
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
  const cx = context.mappers.xMap(dateValue);
  const cy = context.mappers.yMap(rowValue);
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
  if (params.terminalMarkers.length === 0 || params.renderData.length === 0) {
    return [];
  }
  const lastRow = params.renderData.at(-1);
  if (!lastRow) {
    return [];
  }
  return params.terminalMarkers.flatMap((marker: Readonly<TerminalMarkerSource>) => {
    const anchor = resolveTerminalAnchor(marker, { defaults: params.defaults, lastRow, mappers: params.mappers, xDataKey: params.xDataKey });
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
  readonly mappers: Readonly<OverlayMappers>;
  readonly markerRadius: number;
  readonly projectionEndMarkers: readonly Readonly<ProjectionEndMarkerSource>[];
}

interface ProjectionEndAnchorContext {
  readonly fallbackStroke: string;
  readonly mappers: Readonly<OverlayMappers>;
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
    context.mappers.xMap(dateValue),
    Math.max(0, context.mappers.innerWidth - (radius + 1)),
  );
  const cy = context.mappers.yMap(last.value);
  if (Number.isNaN(dateValue.getTime()) || !Number.isFinite(cx) || !Number.isFinite(cy)) {
    return undefined;
  }
  return { cx, cy, radius, stroke: marker.stroke ?? context.fallbackStroke, strokeOpacity: marker.strokeOpacity ?? 1 };
};

const buildProjectionEndAnchors = (params: Readonly<ProjectionEndAnchorParams>): ProjectionEndMarkerAnchor[] => {
  if (params.projectionEndMarkers.length === 0) {
    return [];
  }
  return params.projectionEndMarkers.flatMap((marker: Readonly<ProjectionEndMarkerSource>) => {
    const anchor = resolveProjectionEndAnchor(marker, { fallbackStroke: params.fallbackStroke, mappers: params.mappers, markerRadius: params.markerRadius });
    return anchor ? [anchor] : [];
  });
};

// Host-child mapper source (V1.2/G6); must render under ChartHost.
const useOverlayMappers = (params: Readonly<{
  readonly extentMaxTime: number | undefined;
  readonly rawMinTime: number | undefined;
  readonly yDomainFinal: readonly [number, number];
}>): OverlayMappers | undefined => {
  const { chart, xScale, yScale } = useChartStable();
  const { extentMaxTime, rawMinTime, yDomainFinal } = params;
  const [y0, y1] = yDomainFinal;
  return useMemo((): OverlayMappers | undefined => {
    if (chart === undefined || rawMinTime === undefined || extentMaxTime === undefined) {
      return undefined;
    }
    const x = xScale.copy().domain([rawMinTime, extentMaxTime]);
    const y = yScale.copy().domain([y0, y1]);
    return {
      innerWidth: chart.width,
      rightEdge: chart.x + chart.width,
      xMap: (value: Readonly<Date>): number => x(value),
      yMap: (value: number): number => y(value),
    };
  }, [chart, xScale, yScale, rawMinTime, extentMaxTime, y0, y1]);
};

export {
  buildProjectionEndAnchors,
  buildTerminalAnchors,
  useOverlayMappers,
};
export type {
  OverlayMappers,
  OverlayTimeExtent,
  ProjectionEndAnchorParams,
  TerminalAnchorParams,
};
