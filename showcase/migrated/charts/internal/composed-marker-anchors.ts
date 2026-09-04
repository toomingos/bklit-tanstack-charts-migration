import { toDate } from "./coerce-date";
import type { OverlayFrame } from "./composed-overlay-geometry";
import type { ProjectionEndMarkerAnchor, TerminalMarkerAnchor } from "./terminal-marker";
import type { ChartDatum } from "./types";

interface TerminalAnchorSource {
  readonly lastRow: Readonly<ChartDatum>;
  readonly terminal: Readonly<TerminalMarkerProps>;
  readonly xDataKey: string;
}

interface TerminalAnchorGeometry {
  readonly xForDate: (date: Readonly<Date>) => number;
  readonly yForValue: (value: number) => number;
}

interface TerminalMarkerFallbacks {
  readonly fill: string;
  readonly outlineWidth: number;
  readonly radius: number;
  readonly ringGap: number;
  readonly stroke: string;
  readonly strokeWidth: number;
}

interface TerminalMarkerStyle {
  readonly fill: string;
  readonly outlineColor: string | undefined;
  readonly outlineWidth: number;
  readonly radius: number;
  readonly ringGap: number;
  readonly stroke: string;
  readonly strokeWidth: number;
}

interface BuildTerminalAnchorParams {
  readonly fallbacks: Readonly<TerminalMarkerFallbacks>;
  readonly lastRow: Readonly<ChartDatum>;
  readonly terminal: Readonly<TerminalMarkerProps>;
  readonly xDataKey: string;
  readonly xForDate: (date: Readonly<Date>) => number;
  readonly yForValue: (value: number) => number;
}

interface EndMarkerAppearanceFallbacks {
  readonly radius: number;
  readonly stroke: string;
}

interface EndMarkerAppearance {
  readonly radius: number;
  readonly stroke: string;
  readonly strokeOpacity: number;
}

interface BuildEndAnchorParams {
  readonly fallbacks: Readonly<EndMarkerAppearanceFallbacks>;
  readonly innerWidth: number;
  readonly marker: Readonly<ProjectionEndMarkerProps>;
  readonly xForDate: (date: Readonly<Date>) => number;
  readonly yForValue: (value: number) => number;
}

interface CollectTerminalAnchorsParams {
  readonly fallbacks: Readonly<TerminalMarkerFallbacks>;
  readonly frame: Readonly<OverlayFrame>;
  readonly lastRow: Readonly<ChartDatum>;
  readonly terminals: readonly Readonly<TerminalMarkerProps>[];
  readonly xDataKey: string;
}

interface CollectEndAnchorsParams {
  readonly fallbacks: Readonly<EndMarkerAppearanceFallbacks>;
  readonly frame: Readonly<OverlayFrame>;
  readonly markers: readonly Readonly<ProjectionEndMarkerProps>[];
}

/*
 * Payloads arrive untyped because the caller extracts React element props loosely.
 */
interface TerminalMarkerProps {
  readonly dataKey?: unknown;
  readonly fill?: unknown;
  readonly outlineColor?: unknown;
  readonly outlineWidth?: unknown;
  readonly radius?: unknown;
  readonly ringGap?: unknown;
  readonly stroke?: unknown;
  readonly strokeWidth?: unknown;
}

interface ProjectionEndMarkerProps {
  readonly data?: unknown;
  readonly radius?: unknown;
  readonly stroke?: unknown;
  readonly strokeOpacity?: unknown;
}

interface EndMarkerPointFields {
  readonly date: unknown;
  readonly value: unknown;
}

// Primitive `typeof` checks live in these predicates (anti-slop allows `typeof`
// Inside a type guard); call sites below branch on the guard instead.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";
const isString = <Value>(value: Value): value is Value & string => typeof value === "string";
const isEndMarkerPoint = <Value>(value: Value): value is Value & EndMarkerPointFields =>
  typeof value === "object" && value !== null && "date" in value && "value" in value;

const readTerminalSeriesValue = (
  source: Readonly<TerminalAnchorSource>,
): { dataKey: string; value: number } | undefined => {
  const rawDataKey: unknown = source.terminal.dataKey;
  if (!isString(rawDataKey)) {
    return undefined;
  }
  const value: unknown = source.lastRow[rawDataKey];
  if (!isNumber(value) || !Number.isFinite(value)) {
    return undefined;
  }
  return { dataKey: rawDataKey, value };
};

const projectTerminalPoint = (
  dateVal: Readonly<Date>,
  value: number,
  geometry: Readonly<TerminalAnchorGeometry>,
): { cx: number; cy: number } | undefined => {
  const cx = geometry.xForDate(dateVal);
  const cy = geometry.yForValue(value);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
    return undefined;
  }
  return { cx, cy };
};

const locateTerminalPoint = (
  source: Readonly<TerminalAnchorSource>,
  geometry: Readonly<TerminalAnchorGeometry>,
): { cx: number; cy: number; dataKey: string } | undefined => {
  const resolved = readTerminalSeriesValue(source);
  if (!resolved) {
    return undefined;
  }
  const dateVal = toDate(source.lastRow[source.xDataKey]);
  if (!dateVal) {
    return undefined;
  }
  const point = projectTerminalPoint(dateVal, resolved.value, geometry);
  if (!point) {
    return undefined;
  }
  return { cx: point.cx, cy: point.cy, dataKey: resolved.dataKey };
};

const resolveTerminalMarkerStyle = (
  terminal: Readonly<TerminalMarkerProps>,
  fallbacks: Readonly<TerminalMarkerFallbacks>,
): TerminalMarkerStyle => {
  const fill = isString(terminal.fill) ? terminal.fill : fallbacks.fill;
  const outlineColor = isString(terminal.outlineColor) ? terminal.outlineColor : undefined;
  const outlineWidth = isNumber(terminal.outlineWidth) ? terminal.outlineWidth : fallbacks.outlineWidth;
  const radius = isNumber(terminal.radius) ? terminal.radius : fallbacks.radius;
  const ringGap = isNumber(terminal.ringGap) ? terminal.ringGap : fallbacks.ringGap;
  const stroke = isString(terminal.stroke) ? terminal.stroke : fallbacks.stroke;
  const strokeWidth = isNumber(terminal.strokeWidth) ? terminal.strokeWidth : fallbacks.strokeWidth;
  return { fill, outlineColor, outlineWidth, radius, ringGap, stroke, strokeWidth };
};

const buildTerminalAnchor = (
  params: Readonly<BuildTerminalAnchorParams>,
): TerminalMarkerAnchor | undefined => {
  const point = locateTerminalPoint(params, params);
  if (!point) {
    return undefined;
  }
  const style = resolveTerminalMarkerStyle(params.terminal, params.fallbacks);
  return { cx: point.cx, cy: point.cy, dataKey: point.dataKey, ...style };
};

const readEndMarkerPayload = (
  marker: Readonly<ProjectionEndMarkerProps>,
): { rawDate: unknown; rawValue: unknown } | undefined => {
  const rawPts: unknown = marker.data;
  if (!Array.isArray(rawPts) || rawPts.length < 2) {
    return undefined;
  }
  const last: unknown = rawPts.at(-1);
  if (!isEndMarkerPoint(last)) {
    return undefined;
  }
  return { rawDate: last.date, rawValue: last.value };
};

const readEndMarkerPoint = (
  marker: Readonly<ProjectionEndMarkerProps>,
): { dateVal: Date; rawValue: number } | undefined => {
  const payload = readEndMarkerPayload(marker);
  if (!payload) {
    return undefined;
  }
  if (!isNumber(payload.rawValue) || !Number.isFinite(payload.rawValue)) {
    return undefined;
  }
  const dateVal = payload.rawDate instanceof Date ? payload.rawDate : toDate(payload.rawDate);
  if (!dateVal || Number.isNaN(dateVal.getTime())) {
    return undefined;
  }
  return { dateVal, rawValue: payload.rawValue };
};

const clampEndMarkerX = (rawX: number, innerWidth: number, radius: number): number => {
  const edgePadding = radius + 1;
  return Math.min(rawX, Math.max(0, innerWidth - edgePadding));
};

const resolveEndMarkerAppearance = (
  marker: Readonly<ProjectionEndMarkerProps>,
  fallbacks: Readonly<EndMarkerAppearanceFallbacks>,
): EndMarkerAppearance => {
  const radius = isNumber(marker.radius) ? marker.radius : fallbacks.radius;
  const stroke = isString(marker.stroke) ? marker.stroke : fallbacks.stroke;
  const strokeOpacity = isNumber(marker.strokeOpacity) ? marker.strokeOpacity : 1;
  return { radius, stroke, strokeOpacity };
};

const buildProjectionEndAnchor = (
  params: Readonly<BuildEndAnchorParams>,
): ProjectionEndMarkerAnchor | undefined => {
  const point = readEndMarkerPoint(params.marker);
  if (!point) {
    return undefined;
  }
  const radius = isNumber(params.marker.radius) ? params.marker.radius : params.fallbacks.radius;
  const cx = clampEndMarkerX(params.xForDate(point.dateVal), params.innerWidth, radius);
  const cy = params.yForValue(point.rawValue);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
    return undefined;
  }
  return { cx, cy, ...resolveEndMarkerAppearance(params.marker, params.fallbacks) };
};

const collectTerminalAnchors = (params: Readonly<CollectTerminalAnchorsParams>): TerminalMarkerAnchor[] => {
  const out: TerminalMarkerAnchor[] = [];
  for (const terminal of params.terminals) {
    const anchor = buildTerminalAnchor({
      fallbacks: params.fallbacks,
      lastRow: params.lastRow,
      terminal,
      xDataKey: params.xDataKey,
      xForDate: params.frame.xForDate,
      yForValue: params.frame.yForValue,
    });
    if (anchor) {out.push(anchor);}
  }
  return out;
};

const collectProjectionEndAnchors = (params: Readonly<CollectEndAnchorsParams>): ProjectionEndMarkerAnchor[] => {
  const out: ProjectionEndMarkerAnchor[] = [];
  for (const marker of params.markers) {
    const anchor = buildProjectionEndAnchor({
      fallbacks: params.fallbacks,
      innerWidth: params.frame.innerW,
      marker,
      xForDate: params.frame.xForDate,
      yForValue: params.frame.yForValue,
    });
    if (anchor) {out.push(anchor);}
  }
  return out;
};

export {
  buildProjectionEndAnchor,
  buildTerminalAnchor,
  collectProjectionEndAnchors,
  collectTerminalAnchors,
};
export type {
  BuildEndAnchorParams,
  BuildTerminalAnchorParams,
  CollectEndAnchorsParams,
  CollectTerminalAnchorsParams,
  EndMarkerAppearance,
  EndMarkerAppearanceFallbacks,
  EndMarkerPointFields,
  ProjectionEndMarkerProps,
  TerminalAnchorGeometry,
  TerminalAnchorSource,
  TerminalMarkerFallbacks,
  TerminalMarkerProps,
  TerminalMarkerStyle,
};
