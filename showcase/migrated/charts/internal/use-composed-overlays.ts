import { useMemo } from "react";
import { findTimeBounds } from "./composed-data-math";
import type { TimeBounds } from "./composed-data-math";
import { collectProjectionEndAnchors, collectTerminalAnchors } from "./composed-marker-anchors";
import { resolveOverlayFrame } from "./composed-overlay-geometry";
import { collectProjectionGradients } from "./composed-scales";
import {
  END_ANCHOR_FALLBACKS,
  NOTHING,
  PROJECTION_MARKER_FALLBACKS,
  PROJECTION_STROKE_FALLBACKS,
  TERMINAL_ANCHOR_FALLBACKS,
} from "./composed-series";
import { mergeProjectionXDomainMax } from "./projection-config";
import type { ProjectionLineConfig } from "./projection-config";
import type { ProjectionGradientDef } from "./projection-line-mark";
import type { ProjectionEndMarkerAnchor, TerminalMarkerAnchor } from "./terminal-marker";
import type { ChartDatum } from "./types";
import type { ChartMargin } from "./use-chart-margin";

interface UseComposedOverlayAnchorsParams {
  readonly composedProjectionEndMarkers: readonly Readonly<ChartDatum>[];
  readonly composedProjectionLines: readonly Readonly<ChartDatum>[];
  readonly composedTerminalMarkers: readonly Readonly<ChartDatum>[];
  readonly heightPx: number;
  readonly margin: Readonly<ChartMargin>;
  readonly projectionConfigs: readonly Readonly<ProjectionLineConfig>[];
  readonly projectionGradientBaseId: string;
  readonly renderData: readonly Readonly<ChartDatum>[];
  readonly width: number;
  readonly xDataKey: string;
  readonly yDomain: [number, number];
}

interface UseComposedOverlayAnchorsResult {
  readonly composedEndAnchors: ProjectionEndMarkerAnchor[];
  readonly composedTerminalAnchors: TerminalMarkerAnchor[];
  readonly projectionGradientDefs: ProjectionGradientDef[];
  readonly timeExtent: Readonly<TimeBounds> | undefined;
  readonly timeExtentRaw: Readonly<TimeBounds> | undefined;
}

const useComposedOverlayAnchors = (params: Readonly<UseComposedOverlayAnchorsParams>): UseComposedOverlayAnchorsResult => {
  const { heightPx, margin, projectionConfigs, renderData, width, xDataKey, yDomain } = params;
  // All x-domain consumers read the projection-extended extent.
  const timeExtentRaw = useMemo(() => findTimeBounds(renderData, xDataKey), [renderData, xDataKey]);
  const timeExtent = useMemo(() => {
    if (!timeExtentRaw) {return NOTHING;}
    if (projectionConfigs.length === 0) {return timeExtentRaw;}
    return {
      maxTime: mergeProjectionXDomainMax(timeExtentRaw.maxTime, projectionConfigs),
      minTime: timeExtentRaw.minTime,
    } as const;
  }, [timeExtentRaw, projectionConfigs]);

  const composedTerminalAnchors = useMemo(() => {
    if (params.composedTerminalMarkers.length === 0 || renderData.length === 0) {return [];}
    // Terminal markers anchor to the last visible row, not the last raw data row.
    const lastRow = renderData.at(-1);
    if (!lastRow) {return [];}
    const frame = resolveOverlayFrame({
      heightPx,
      margin,
      timeExtent,
      timeExtentRaw,
      width,
      yDomain,
    });
    if (!frame) {return [];}
    return collectTerminalAnchors({
      fallbacks: TERMINAL_ANCHOR_FALLBACKS,
      frame,
      lastRow,
      terminals: params.composedTerminalMarkers,
      xDataKey,
    });
  }, [params.composedTerminalMarkers, renderData, width, heightPx, margin, yDomain, timeExtent, timeExtentRaw, xDataKey]);
  const composedEndAnchors = useMemo(() => {
    if (params.composedProjectionEndMarkers.length === 0) {return [];}
    const frame = resolveOverlayFrame({
      heightPx,
      margin,
      timeExtent,
      timeExtentRaw,
      width,
      yDomain,
    });
    if (!frame) {return [];}
    // Projection end-marker points arrive as child props (unknown); the collector
    // Validates the array and the last point's shape instead of asserting it.
    return collectProjectionEndAnchors({
      fallbacks: END_ANCHOR_FALLBACKS,
      frame,
      markers: params.composedProjectionEndMarkers,
    });
  }, [params.composedProjectionEndMarkers, width, heightPx, margin, yDomain, timeExtent, timeExtentRaw]);
  const projectionGradientDefs = useMemo(() => {
    if (projectionConfigs.length === 0) {return [];}
    const frame = resolveOverlayFrame({
      heightPx,
      margin,
      timeExtent,
      timeExtentRaw,
      width,
      yDomain,
    });
    if (!frame) {return [];}
    /*
     * Loop bound keeps the index in range; marker fields are validated with typeof.
     */
    return collectProjectionGradients({
      cfgs: projectionConfigs,
      gradientBaseId: params.projectionGradientBaseId,
      innerWidth: frame.innerW,
      lines: params.composedProjectionLines,
      markerFallbacks: PROJECTION_MARKER_FALLBACKS,
      strokeFallbacks: PROJECTION_STROKE_FALLBACKS,
      translateX: margin.left,
      translateY: margin.top,
      xScale: (value: Readonly<Date>): number => frame.xForDate(value),
      yScale: (value: number): number => frame.yForValue(value),
    });
  }, [projectionConfigs, params.composedProjectionLines, width, heightPx, margin, yDomain, timeExtent, timeExtentRaw, params.projectionGradientBaseId]);

  return { composedEndAnchors, composedTerminalAnchors, projectionGradientDefs, timeExtent, timeExtentRaw };
};

export { useComposedOverlayAnchors };
export type { UseComposedOverlayAnchorsParams, UseComposedOverlayAnchorsResult };
