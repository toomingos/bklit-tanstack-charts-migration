// Composed overlay chrome: host-child anchors, gradients and crosshair defs (V1.2/G6).
"use client";

import { useLayoutEffect, useMemo } from "react";
import type { ReactNode, RefObject } from "react";
import { useChartStable } from "./chart-context";
import { useEffectEvent } from "./use-effect-event";
import { collectProjectionEndAnchors, collectTerminalAnchors } from "./composed-marker-anchors";
import { collectProjectionGradients } from "./composed-scales";
import {
  END_ANCHOR_FALLBACKS,
  NOTHING,
  PROJECTION_MARKER_FALLBACKS,
  PROJECTION_STROKE_FALLBACKS,
  TERMINAL_ANCHOR_FALLBACKS,
} from "./composed-series";
import { ProjectionMarkerOverlay } from "./terminal-marker";
import type { ProjectionPhaseHandle } from "./terminal-marker";
import type { ProjectionLineConfig } from "./projection-config";
import type { TimeBounds } from "./composed-data-math";
import type { ChartPhase } from "./chart-phase";
import type { CrosshairGradientDef } from "./focus-marks";
import { renderCrosshairNode, renderProjectionGradientsNode } from "./composed-gradient-nodes";
import type { ChartDatum } from "./types";

// Anchors and projection gradients resolve through host scales (V1.2/G6).
const ComposedProjectionChrome = (properties: Readonly<{
  readonly composedProjectionEndMarkers: readonly Readonly<ChartDatum>[];
  readonly composedProjectionLines: readonly Readonly<ChartDatum>[];
  readonly composedTerminalMarkers: readonly Readonly<ChartDatum>[];
  readonly heightPx: number;
  readonly phasePort: RefObject<ProjectionPhaseHandle | null>;
  readonly phaseRef: RefObject<ChartPhase>;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionGradientBaseId: string;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly timeExtent: Readonly<TimeBounds> | undefined;
  readonly timeExtentRaw: Readonly<TimeBounds> | undefined;
  readonly width: number;
  readonly xDataKey: string;
  readonly yDomain: [number, number];
}>): ReactNode => {
  const { chart, xScale: hostXScale, yScale: hostYScale } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  const { composedProjectionEndMarkers, composedProjectionLines, composedTerminalMarkers, heightPx, phasePort, phaseRef, projectionConfigs, projectionGradientBaseId, renderData, timeExtent, timeExtentRaw, width, xDataKey, yDomain } = properties;
  const frame = useMemo(() => {
    if (plot.width <= 0 || plot.height <= 0 || !timeExtent || !timeExtentRaw) {return undefined;}
    const innerW = plot.width;
    const xForDate = (() => {
      const x = hostXScale.copy().domain([timeExtentRaw.minTime, timeExtent.maxTime]);
      return (date: Readonly<Date>): number => x(date);
    })();
    const yForValue = (() => {
      const y = hostYScale.copy().domain([yDomain[0], yDomain[1]]);
      return (value: number): number => y(value);
    })();
    return {
      innerH: plot.height,
      innerW,
      rightEdge: plot.x + plot.width,
      xForDate,
      yForValue,
    };
  }, [plot.width, plot.height, plot.x, timeExtent, timeExtentRaw, hostXScale, hostYScale, yDomain]);
  const terminalAnchors = useMemo(() => {
    if (composedTerminalMarkers.length === 0 || renderData.length === 0 || !frame) {return [];}
    const lastRow = renderData.at(-1);
    if (!lastRow) {return [];}
    return collectTerminalAnchors({
      fallbacks: TERMINAL_ANCHOR_FALLBACKS,
      frame,
      lastRow,
      terminals: composedTerminalMarkers,
      xDataKey,
    });
  }, [composedTerminalMarkers, renderData, frame, xDataKey]);
  const endAnchors = useMemo(() => {
    if (composedProjectionEndMarkers.length === 0 || !frame) {return [];}
    return collectProjectionEndAnchors({
      fallbacks: END_ANCHOR_FALLBACKS,
      frame,
      markers: composedProjectionEndMarkers,
    });
  }, [composedProjectionEndMarkers, frame]);
  const gradientDefs = useMemo(() => {
    if (projectionConfigs.length === 0 || !frame) {return [];}
    return collectProjectionGradients({
      cfgs: projectionConfigs,
      gradientBaseId: projectionGradientBaseId,
      lines: composedProjectionLines,
      markerFallbacks: PROJECTION_MARKER_FALLBACKS,
      rightEdge: frame.rightEdge,
      strokeFallbacks: PROJECTION_STROKE_FALLBACKS,
      xMap: (value: Readonly<Date>): number => frame.xForDate(value),
      yMap: (value: number): number => frame.yForValue(value),
    });
  }, [projectionConfigs, composedProjectionLines, frame, projectionGradientBaseId]);
  const overlayRendered = (terminalAnchors.length > 0 || endAnchors.length > 0) && width > 0 && heightPx > 0;
  const pushPhaseToProjectionPort = useEffectEvent((): void => {
    phasePort.current?.setPhase(phaseRef.current);
  });
  useLayoutEffect(() => {
    if (!overlayRendered) {return;}
    pushPhaseToProjectionPort();
  }, [overlayRendered]);
  return (
    <>
      {renderProjectionGradientsNode(gradientDefs)}
      {overlayRendered && (
        <ProjectionMarkerOverlay
          terminalMarkers={terminalAnchors}
          projectionEndMarkers={endAnchors}
          phasePort={phasePort}
        />
      )}
    </>
  );
};


// Crosshair gradient geometry follows the host plot rect (V1.2/G6).
const ComposedCrosshairDef = (properties: Readonly<{
  readonly gradientDef: CrosshairGradientDef | undefined;
}>): ReactNode => {
  const { chart, margin } = useChartStable();
  const plot = chart ?? { height: 0, width: 0, x: 0, y: 0 };
  if (!properties.gradientDef || plot.width <= 0 || plot.height <= 0) {return NOTHING;}
  return renderCrosshairNode({
    def: properties.gradientDef,
    heightPx: margin.top + plot.height + margin.bottom,
    margin,
  });
};

export { ComposedCrosshairDef, ComposedProjectionChrome };
