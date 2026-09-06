// Area overlays hook: data for host-child chrome; anchors/gradients resolve inside the host.
import { useMemo } from "react";
import type { RefObject } from "react";
import { buildCrosshairGradientDef } from "./focus-marks";
import type { CrosshairGradientDef } from "./focus-marks";
import { resolveFadeEdgesMask } from "./fade-mask";
import { resolveProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionLineConfig } from "./projection-config";
import {
  DEFAULT_TERMINAL_MARKER_RADIUS_PX,
  PROJECTION_FALLBACK_STROKE,
  isString,
} from "./area-chart-model";
import type { ReadonlyResolvedArea, TimeExtentMs } from "./area-chart-model";
import type { ProjectionPhaseHandle } from "./terminal-marker";
import type { ChartDatum, ExtractedChildren, ProjectionLineChildConfig } from "./types";
import type { ChartPhase } from "./chart-phase";

interface AreaProjectionMappers {
  readonly innerWidth: number;
  readonly rightEdge: number;
  readonly xMap: (value: Readonly<Date>) => number;
  readonly yMap: (value: number) => number;
}

interface AreaProjectionGradientInput {
  readonly baseId: string;
  readonly config: Readonly<ProjectionLineConfig> | undefined;
  readonly index: number;
  readonly mappers: Readonly<AreaProjectionMappers> | undefined;
  readonly line: Readonly<ProjectionLineChildConfig>;
}

// Gradient def for one projection line; undefined unless the line uses a gradient stroke.
const resolveAreaProjectionGradient = (input: Readonly<AreaProjectionGradientInput>): ProjectionGradientDef | undefined => {
  const { config, line, mappers } = input;
  if (mappers === undefined) {return undefined;}
  if ((line.strokeStyle ?? "solid") !== "gradient") {return undefined;}
  if (!config || config.data.length < 2) {return undefined;}
  const stroke = line.stroke ?? PROJECTION_FALLBACK_STROKE;
  const gradientStart = line.gradientStart ?? stroke;
  const gradientEnd = line.gradientEnd ?? "var(--chart-5)";
  const strokeWidth = line.strokeWidth ?? 2;
  const endpointRadius = line.endpointRadius ?? DEFAULT_TERMINAL_MARKER_RADIUS_PX;
  return resolveProjectionGradientDef({
    data: config.data,
    endpointRadius,
    gradientEnd,
    gradientId: `${input.baseId}-proj-${input.index}`,
    gradientStart,
    rightEdge: mappers.rightEdge,
    showEndMarker: line.showEndMarker ?? line.showEndpoints ?? true,
    strokeStyle: "gradient",
    strokeWidth,
    xMap: mappers.xMap,
    yMap: mappers.yMap,
  });
};

interface AreaProjectionGradientFrame {
  readonly baseId: string;
  readonly configs: readonly Readonly<ProjectionLineConfig>[];
  readonly lines: readonly Readonly<ProjectionLineChildConfig>[];
  readonly mappers: Readonly<AreaProjectionMappers> | undefined;
}

// Gradient defs for every projection line; non-gradient lines contribute nothing.
const buildAreaProjectionGradientDefs = (frame: Readonly<AreaProjectionGradientFrame>): ProjectionGradientDef[] => frame.lines.flatMap((line: Readonly<ProjectionLineChildConfig>, index: number) => {
  const gradient = resolveAreaProjectionGradient({
    baseId: frame.baseId,
    config: frame.configs.at(index),
    index,
    line,
    mappers: frame.mappers,
  });
  return gradient ? [gradient] : [];
});

interface AreaProjectionChromeProps {
  readonly chartPhase: ChartPhase;
  readonly heightPx: number;
  readonly phasePort: RefObject<ProjectionPhaseHandle | null>;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionEndMarkers: ExtractedChildren["projectionEndMarkers"];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: readonly Readonly<ProjectionLineChildConfig>[];
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly terminalMarkers: ExtractedChildren["terminalMarkers"];
  readonly timeExtent: TimeExtentMs | undefined;
  readonly timeExtentRaw: TimeExtentMs | undefined;
  readonly width: number;
  readonly xDataKey: string;
  readonly yDomainFinal: readonly [number, number];
}

interface AreaOverlaysParams {
  readonly crosshairGradientId: string;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionEndMarkers: ExtractedChildren["projectionEndMarkers"];
  readonly projectionGradientBaseId: string;
  readonly projectionLines: readonly Readonly<ProjectionLineChildConfig>[];
  readonly projectionPhasePortRef: RefObject<ProjectionPhaseHandle | null>;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly resolvedAreas: readonly ReadonlyResolvedArea[];
  readonly terminalMarkers: ExtractedChildren["terminalMarkers"];
  readonly timeExtent: TimeExtentMs | undefined;
  readonly timeExtentRaw: TimeExtentMs | undefined;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipEnabled: boolean;
  readonly width: number;
  readonly heightPx: number;
  readonly chartPhase: ChartPhase;
  readonly xDataKey: string;
  readonly yDomainFinal: readonly [number, number];
}

interface AreaOverlays {
  readonly crosshairGradientDef: CrosshairGradientDef | undefined;
  readonly fadeEdgesMask: ReturnType<typeof resolveFadeEdgesMask>;
  readonly projectionChromeProps: AreaProjectionChromeProps | undefined;
}

const useAreaOverlays = (params: Readonly<AreaOverlaysParams>): AreaOverlays => {
  const {
    chartPhase,
    crosshairGradientId,
    heightPx,
    projectionConfigs,
    projectionEndMarkers,
    projectionGradientBaseId,
    projectionLines,
    projectionPhasePortRef,
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

  const crosshairGradientDef = useMemo((): CrosshairGradientDef | undefined => {
    if (!(tooltipEnabled && (tooltip?.showCrosshair ?? true))) {return undefined;}
    const indicatorColor = tooltip?.indicatorColor;
    const color = isString(indicatorColor) ? indicatorColor : "var(--chart-crosshair)";
    return buildCrosshairGradientDef(crosshairGradientId, color);
  }, [tooltipEnabled, tooltip, crosshairGradientId]);

  // Anchors and gradient defs mount inside the host so bounds come from the store (V1.2/G6).
  const projectionChromeProps: AreaProjectionChromeProps | undefined =
    (projectionConfigs.length > 0 || projectionEndMarkers.length > 0 || terminalMarkers.length > 0)
      ? {
        chartPhase,
        heightPx,
        phasePort: projectionPhasePortRef,
        projectionConfigs,
        projectionEndMarkers,
        projectionGradientBaseId,
        projectionLines,
        renderData,
        terminalMarkers,
        timeExtent,
        timeExtentRaw,
        width,
        xDataKey,
        yDomainFinal,
      }
      : undefined;

  return {
    crosshairGradientDef,
    fadeEdgesMask,
    projectionChromeProps,
  };
};

export { buildAreaProjectionGradientDefs, useAreaOverlays };
export type { AreaOverlays, AreaOverlaysParams, AreaProjectionChromeProps, AreaProjectionMappers };
