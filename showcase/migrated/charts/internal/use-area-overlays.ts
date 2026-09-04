// Area overlays hook: anchors, projection gradient defs, crosshair from area-chart.tsx.
// Hook call order is unchanged; logic moved verbatim.
import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { timeToPixelX } from "./x-time-scale";
import { buildTerminalAnchors, buildProjectionEndAnchors } from "./line-marker-anchors";
import {
  buildCrosshairGradientDef,
} from "./hover-geometry";
import type { CrosshairGradientDef } from "./hover-geometry";
import { resolveFadeEdgesMask } from "./fade-mask";
import { resolveProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionLineConfig } from "./projection-config";
import type { ChartMargin } from "./use-chart-margin";
import type { ChartDatum, ExtractedChildren, ProjectionLineChildConfig } from "./types";
import {
  DEFAULT_PROJECTION_STROKE_WIDTH_PX,
  DEFAULT_TERMINAL_MARKER_RADIUS_PX,
  DEFAULT_TERMINAL_MARKER_STROKE_WIDTH_PX,
  PROJECTION_FALLBACK_STROKE,
  isString,
  withZeroFallback,
} from "./area-chart-model";
import type { ReadonlyResolvedArea, TimeExtentMs } from "./area-chart-model";

interface AreaProjectionGradientInput {
  readonly baseId: string;
  readonly config: Readonly<ProjectionLineConfig> | undefined;
  readonly index: number;
  readonly innerWidth: number;
  readonly isLoading: boolean;
  readonly line: Readonly<ProjectionLineChildConfig>;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

// Gradient def for one projection line; undefined unless the line uses a gradient stroke.
const resolveAreaProjectionGradient = (input: Readonly<AreaProjectionGradientInput>): ProjectionGradientDef | undefined => {
  const { config, line } = input;
  if ((line.strokeStyle ?? "solid") !== "gradient" || !config || config.data.length < 2) {return undefined;}
  const stroke = line.stroke ?? PROJECTION_FALLBACK_STROKE;
  const gradientStart = line.gradientStart ?? stroke;
  const gradientEnd = line.gradientEnd ?? "var(--chart-5)";
  const strokeWidth = line.strokeWidth ?? DEFAULT_PROJECTION_STROKE_WIDTH_PX;
  const curveKind = line.curveKind ?? "linear";
  const endpointRadius = line.endpointRadius ?? DEFAULT_TERMINAL_MARKER_RADIUS_PX;
  return resolveProjectionGradientDef({
    className: line.className ?? "chart-projection-line",
    curveKind,
    data: config.data,
    endpointRadius,
    gradientEnd,
    gradientId: `${input.baseId}-proj-${input.index}`,
    gradientStart,
    id: `projection-line-${input.index}`,
    innerWidth: input.innerWidth,
    showEndMarker: line.showEndMarker ?? line.showEndpoints ?? true,
    stroke,
    strokeDasharray: line.strokeDasharray ?? "6,4",
    strokeOpacity: line.strokeOpacity ?? 1,
    strokeStyle: "gradient",
    strokeVisible: !input.isLoading,
    strokeWidth,
    translateX: input.marginLeft,
    translateY: input.marginTop,
    xScale: input.xScale,
    yAxisId: config.yAxisId,
    yScale: input.yScale,
  });
};

interface AreaProjectionGradientFrame {
  readonly baseId: string;
  readonly configs: readonly Readonly<ProjectionLineConfig>[];
  readonly innerWidth: number;
  readonly isLoading: boolean;
  readonly lines: readonly Readonly<ProjectionLineChildConfig>[];
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly xScale: (value: Readonly<Date>) => number;
  readonly yScale: (value: number) => number;
}

// Gradient defs for every projection line; non-gradient lines contribute nothing.
const buildAreaProjectionGradientDefs = (frame: Readonly<AreaProjectionGradientFrame>): ProjectionGradientDef[] => frame.lines.flatMap((line: Readonly<ProjectionLineChildConfig>, index: number) => {
  const gradient = resolveAreaProjectionGradient({
    baseId: frame.baseId,
    config: frame.configs.at(index),
    index,
    innerWidth: frame.innerWidth,
    isLoading: frame.isLoading,
    line,
    marginLeft: frame.marginLeft,
    marginTop: frame.marginTop,
    xScale: frame.xScale,
    yScale: frame.yScale,
  });
  return gradient ? [gradient] : [];
});

interface AreaOverlaysParams {
  readonly crosshairGradientId: string;
  readonly heightPx: number;
  readonly isLoading: boolean;
  readonly margin: Readonly<ChartMargin>;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionEndMarkers: ExtractedChildren["projectionEndMarkers"];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: readonly Readonly<ProjectionLineChildConfig>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly terminalMarkers: ExtractedChildren["terminalMarkers"];
  readonly timeExtent: Readonly<TimeExtentMs> | undefined;
  readonly timeExtentRaw: Readonly<TimeExtentMs> | undefined;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipEnabled: boolean;
  readonly width: number;
  readonly xDataKey: string;
  readonly yDomainFinal: readonly [number, number];
}

interface AreaOverlays {
  readonly areaEndAnchors: ReturnType<typeof buildProjectionEndAnchors>;
  readonly areaTerminalAnchors: ReturnType<typeof buildTerminalAnchors>;
  readonly crosshairGradientDef: CrosshairGradientDef | undefined;
  readonly fadeEdgesMask: ReturnType<typeof resolveFadeEdgesMask>;
  readonly projectionGradientDefsArea: ProjectionGradientDef[];
}

const useAreaOverlays = (params: Readonly<AreaOverlaysParams>): AreaOverlays => {
  const {
    crosshairGradientId,
    heightPx,
    isLoading,
    margin,
    projectionConfigs,
    projectionEndMarkers,
    projectionGradientBaseId,
    projectionLines,
    renderData,
    resolvedAreas,
    terminalMarkers,
    timeExtent,
    timeExtentRaw,
    tooltip,
    tooltipEnabled,
    width,
    xDataKey,
    yDomainFinal,
  } = params;
  // Edge-fade mask aggregates per-series fadeEdges; sides resolve via CSS :not() rules.
  const fadeEdgesMask = resolveFadeEdgesMask(resolvedAreas.map((area: ReadonlyResolvedArea) => area.fadeEdges));

  // Terminal markers anchor to the last visible row via the shared line-marker builder.
  const areaTerminalAnchors = useMemo(() => buildTerminalAnchors({
    defaults: {
      fallbackStroke: "var(--chart-1)",
      markerRadius: DEFAULT_TERMINAL_MARKER_RADIUS_PX,
      terminalStrokeWidth: DEFAULT_TERMINAL_MARKER_STROKE_WIDTH_PX,
    },
    heightPx,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    renderData,
    terminalMarkers,
    timeExtent,
    timeExtentRaw,
    width,
    xDataKey,
    yDomainFinal,
  }), [terminalMarkers, renderData, width, heightPx, margin, yDomainFinal, timeExtent, timeExtentRaw, xDataKey]);
  // Projection end markers clamp to the plot edge via the shared line-marker builder.
  const areaEndAnchors = useMemo(() => buildProjectionEndAnchors({
    fallbackStroke: PROJECTION_FALLBACK_STROKE,
    heightPx,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    marginRight: margin.right,
    marginTop: margin.top,
    markerRadius: DEFAULT_TERMINAL_MARKER_RADIUS_PX,
    projectionEndMarkers,
    timeExtent,
    timeExtentRaw,
    width,
    yDomainFinal,
  }), [projectionEndMarkers, width, heightPx, margin, yDomainFinal, timeExtent, timeExtentRaw]);
  const projectionGradientDefsArea = useMemo(() => {
    if (projectionConfigs.length === 0 || width <= 0) {return [];}
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, heightPx - margin.top - margin.bottom);
    if (innerW <= 0 || innerH <= 0 || !timeExtent || !timeExtentRaw) {return [];}
    const yScale = scaleLinear().domain(yDomainFinal).range([innerH, 0]);
    return buildAreaProjectionGradientDefs({
      baseId: projectionGradientBaseId,
      configs: projectionConfigs,
      innerWidth: innerW,
      isLoading,
      lines: projectionLines,
      marginLeft: margin.left,
      marginTop: margin.top,
      xScale: (value: Date): number => timeToPixelX(value, timeExtentRaw.minTime, timeExtent.maxTime, innerW),
      yScale: (value: number): number => withZeroFallback(yScale(value)),
    });
  }, [projectionConfigs, projectionLines, width, margin, heightPx, yDomainFinal, timeExtent, timeExtentRaw, projectionGradientBaseId, isLoading]);

  const crosshairGradientDef = useMemo((): CrosshairGradientDef | undefined => {
    if (!(tooltipEnabled && (tooltip?.showCrosshair ?? true))) {return undefined;}
    const indicatorColor = tooltip?.indicatorColor;
    const color = isString(indicatorColor) ? indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipEnabled, tooltip, crosshairGradientId]);

  return {
    areaEndAnchors,
    areaTerminalAnchors,
    crosshairGradientDef,
    fadeEdgesMask,
    projectionGradientDefsArea,
  };
};

export { useAreaOverlays };
export type { AreaOverlays, AreaOverlaysParams };
