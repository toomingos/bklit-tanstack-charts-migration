// Area layer-props hook: brush geometry, renderer, reference-area geom, container styles.
// Hook call order is unchanged; logic moved verbatim.
import { useCallback, useMemo } from "react";
import type { CSSProperties, RefObject } from "react";
import type { BrushRange } from "@tanstack/charts/interaction/brush";
import type { ChartRenderer } from "@tanstack/charts";
import { useSanitizedId } from "./use-sanitized-id";
import { selectionToPixelExtent } from "./brush-chrome-helpers";
import type { BrushHost } from "./brush-chrome";
import { useChartRenderer } from "./motion-renderer";
import type { ReferenceAreaLayersGeom } from "./reference-area-layer";
import type { ChartPhase } from "./chart-phase";
import type { ChartDatum, ChartMarker } from "./types";
import type { ChartMargin } from "./use-chart-margin";
import type { TimeExtentMs } from "./area-chart-model";
import type { AreaSelection } from "./use-area-selection";

interface AreaLayerPropsParams {
  readonly areaXScaleD3Ref: AreaSelection["areaXScaleD3Ref"];
  readonly aspectRatio: string;
  readonly brushRangeValue: BrushRange<Date> | undefined;
  readonly brushTrackExtent: [Date, Date] | undefined;
  readonly chartPhase: ChartPhase;
  readonly clearFocusChrome: () => void;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly heightPx: number;
  readonly isLoaded: boolean;
  readonly margin: Readonly<ChartMargin>;
  readonly nicedDomainsByAxis: Record<string, [number, number]>;
  readonly renderDataLength: number;
  readonly style: CSSProperties | undefined;
  readonly timeExtent: Readonly<TimeExtentMs> | undefined;
  readonly width: number;
  readonly xDomain: [Date, Date] | undefined;
  readonly yDomainFinal: [number, number];
}

interface AreaLayerProps {
  readonly areaBrushClipId: string;
  readonly areaChartRenderer: ChartRenderer<ChartDatum, Date, number>;
  readonly brushHost: BrushHost | undefined;
  readonly brushPixelExtent: { x0: number; x1: number } | undefined;
  readonly chartBodyClipStyle: CSSProperties | undefined;
  readonly containerStyle: CSSProperties;
  readonly handleMarkerHoverChange: (markers: readonly Readonly<ChartMarker>[] | null) => void;
  readonly needsAreaBrushClip: boolean;
  readonly referenceAreaGeom: ReferenceAreaLayersGeom;
  readonly resolveAreaX: (date: Readonly<Date>) => number | undefined;
}

const useAreaLayerProps = (params: Readonly<AreaLayerPropsParams>): AreaLayerProps => {
  const {
    areaXScaleD3Ref,
    aspectRatio,
    brushRangeValue,
    brushTrackExtent,
    chartPhase,
    clearFocusChrome,
    containerRef,
    heightPx,
    isLoaded,
    margin,
    nicedDomainsByAxis,
    renderDataLength,
    style,
    timeExtent,
    width,
    xDomain,
    yDomainFinal,
  } = params;
  // With narrowed xDomain, full-data paths map outside the plot; clip them to the plot rect.
  const innerWidthForBrush = Math.max(0, width - margin.left - margin.right);
  const innerHeightForBrush = Math.max(0, heightPx - margin.top - margin.bottom);
  const areaBrushClipId = useSanitizedId();
  const needsAreaBrushClip = Boolean(xDomain) && innerWidthForBrush > 0 && innerHeightForBrush > 0;
  const brushHost = useMemo((): BrushHost | undefined => {
    if (!brushTrackExtent || innerWidthForBrush <= 0) {return undefined;}
    return { containerRef, margin, trackExtent: brushTrackExtent };
  }, [brushTrackExtent, innerWidthForBrush, margin, containerRef]);
  const brushPixelExtent = useMemo((): { x0: number; x1: number } | undefined => {
    if (!brushTrackExtent || innerWidthForBrush <= 0 || !brushRangeValue) {return undefined;}
    return selectionToPixelExtent(brushRangeValue, brushTrackExtent, innerWidthForBrush) ?? undefined;
  }, [brushTrackExtent, brushRangeValue, innerWidthForBrush]);
  const areaChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderDataLength);

  // Stable identities for layer props that would otherwise allocate per render.
  const referenceAreaGeom = useMemo(
    (): ReferenceAreaLayersGeom => ({
      height: heightPx,
      isLoaded,
      isTimeScale: true,
      margin,
      phase: chartPhase,
      width,
      xDomain: timeExtent ? [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)] : undefined,
      yDomain: yDomainFinal,
      yDomainsByAxis: nicedDomainsByAxis,
    }),
    [heightPx, isLoaded, margin, chartPhase, width, timeExtent, yDomainFinal, nicedDomainsByAxis],
  );
  const resolveAreaX = useCallback((date: Readonly<Date>): number | undefined => {
    const scale = areaXScaleD3Ref.current;
    if (!scale) {return undefined;}
    return scale(date);
  }, [areaXScaleD3Ref]);
  const handleMarkerHoverChange = useCallback((markers: readonly Readonly<ChartMarker>[] | null): void => {
    // Hovering markers hides crosshair/tooltip and drops isActive until next chart hover (legacy).
    if (markers) {
      clearFocusChrome();
    }
  }, [clearFocusChrome]);
  const chartBodyClipStyle = useMemo((): CSSProperties | undefined =>
    (needsAreaBrushClip ? { clipPath: `url(#${areaBrushClipId})` } : undefined),
  [needsAreaBrushClip, areaBrushClipId]);
  const containerStyle = useMemo((): CSSProperties => ({
    aspectRatio,
    isolation: "isolate",
    position: "relative",
    touchAction: "none",
    width: "100%",
    ...style,
  }), [aspectRatio, style]);

  return {
    areaBrushClipId,
    areaChartRenderer,
    brushHost,
    brushPixelExtent,
    chartBodyClipStyle,
    containerStyle,
    handleMarkerHoverChange,
    needsAreaBrushClip,
    referenceAreaGeom,
    resolveAreaX,
  };
};

export { useAreaLayerProps };
export type { AreaLayerProps, AreaLayerPropsParams };
