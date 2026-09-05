// Area layer-props hook: brush geometry, renderer, reference-area geom, container styles.
import { useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import type { ChartRenderer } from "@tanstack/charts";
import { useSanitizedId } from "./use-sanitized-id";
import { useChartRenderer } from "./motion-renderer";
import type { ReferenceAreaLayersGeom } from "./reference-area-layer";
import type { ChartPhase } from "./chart-phase";
import type { ChartDatum, ChartMarker } from "./types";
import type { ChartMargin } from "./use-chart-margin";
import type { TimeExtentMs } from "./area-chart-model";

interface AreaLayerPropsParams {
  readonly aspectRatio: string;
  readonly chartPhase: ChartPhase;
  readonly clearFocusChrome: () => void;
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
  readonly chartBodyClipStyle: CSSProperties | undefined;
  readonly containerStyle: CSSProperties;
  readonly handleMarkerHoverChange: (markers: readonly Readonly<ChartMarker>[] | null) => void;
  readonly needsAreaBrushClip: boolean;
  readonly referenceAreaGeom: ReferenceAreaLayersGeom;
}

const useAreaLayerProps = (params: Readonly<AreaLayerPropsParams>): AreaLayerProps => {
  const {
    aspectRatio,
    chartPhase,
    clearFocusChrome,
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
  const areaChartRenderer = useChartRenderer<ChartDatum, Date, number>(renderDataLength);

  // Stable identities for layer props that would otherwise allocate per render.
  // Reference-area geometry reads bounds from the host; only data domains travel by prop.
  const referenceAreaGeom = useMemo(
    (): ReferenceAreaLayersGeom => ({
      isLoaded,
      phase: chartPhase,
      xDomain: timeExtent ? [new Date(timeExtent.minTime), new Date(timeExtent.maxTime)] : undefined,
      yDomain: yDomainFinal,
      yDomainsByAxis: nicedDomainsByAxis,
    }),
    [isLoaded, chartPhase, timeExtent, yDomainFinal, nicedDomainsByAxis],
  );
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
    chartBodyClipStyle,
    containerStyle,
    handleMarkerHoverChange,
    needsAreaBrushClip,
    referenceAreaGeom,
  };
};

export { useAreaLayerProps };
export type { AreaLayerProps, AreaLayerPropsParams };
