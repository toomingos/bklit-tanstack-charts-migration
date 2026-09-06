// Area layer-props hook: renderer, reference-area geom, container styles.
import { useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import type { ChartRenderer } from "@tanstack/charts";
import { useChartRenderer } from "./motion-renderer";
import type { ReferenceAreaLayersGeom } from "./reference-area-layer";
import type { ChartPhase } from "./chart-phase";
import type { ChartDatum, ChartMarker } from "./types";
import type { TimeExtentMs } from "./area-chart-model";

interface AreaLayerPropsParams {
  readonly aspectRatio: string;
  readonly chartPhase: ChartPhase;
  readonly clearFocusChrome: () => void;
  readonly isLoaded: boolean;
  readonly nicedDomainsByAxis: Record<string, [number, number]>;
  readonly renderDataLength: number;
  readonly style: CSSProperties | undefined;
  readonly timeExtent: Readonly<TimeExtentMs> | undefined;
  readonly yDomainFinal: [number, number];
}

interface AreaLayerProps {
  readonly areaChartRenderer: ChartRenderer<ChartDatum, Date, number>;
  readonly containerStyle: CSSProperties;
  readonly handleMarkerHoverChange: (markers: readonly Readonly<ChartMarker>[] | null) => void;
  readonly referenceAreaGeom: ReferenceAreaLayersGeom;
}

const useAreaLayerProps = (params: Readonly<AreaLayerPropsParams>): AreaLayerProps => {
  const {
    aspectRatio,
    chartPhase,
    clearFocusChrome,
    isLoaded,
    nicedDomainsByAxis,
    renderDataLength,
    style,
    timeExtent,
    yDomainFinal,
  } = params;
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
  const containerStyle = useMemo((): CSSProperties => ({
    aspectRatio,
    isolation: "isolate",
    position: "relative",
    touchAction: "none",
    width: "100%",
    ...style,
  }), [aspectRatio, style]);

  return {
    areaChartRenderer,
    containerStyle,
    handleMarkerHoverChange,
    referenceAreaGeom,
  };
};

export { useAreaLayerProps };
export type { AreaLayerProps, AreaLayerPropsParams };
