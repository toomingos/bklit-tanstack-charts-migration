// Area selection hook: x-scale ref, scene inversion, drag selection, segment/ref-area extraction.
// Hook call order matches area-chart.tsx lines 1624-1654 exactly; logic moved verbatim.
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { scaleUtc } from "d3-scale";
import type { ChartScene, ChartTooltipPosition } from "@tanstack/charts";
import { extractReferenceAreaProps } from "./reference-area-config";
import { extractSegmentComponents, useChartSelection } from "./chart-selection";
import type { ChartSelection, SegmentComponent } from "./chart-selection";
import type { ChartDatum } from "./types";
import type { TimeExtentMs } from "./area-chart-model";

interface AreaSelectionParams {
  readonly children: ReactNode;
  readonly clientToScene: (clientX: number, clientY: number) => ChartTooltipPosition | null;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly data: ChartDatum[];
  readonly innerWidth: number;
  readonly marginLeft: number;
  readonly onDragEnd: () => void;
  readonly onDragStart: () => void;
  readonly sceneRef: RefObject<ChartScene<ChartDatum, Date, number> | null>;
  readonly timeExtent: Readonly<TimeExtentMs> | undefined;
  readonly xDataKey: string;
}

interface AreaSelection {
  readonly areaXScaleD3Ref: RefObject<((value: Date) => number | undefined) | null>;
  readonly chartSelection: ChartSelection | null;
  readonly refAreaChildren: ReturnType<typeof extractReferenceAreaProps>;
  readonly segmentComponents: SegmentComponent[];
}

const useAreaSelection = (params: Readonly<AreaSelectionParams>): AreaSelection => {
  const {
    children,
    clientToScene,
    containerRef,
    data,
    innerWidth,
    marginLeft,
    onDragEnd,
    onDragStart,
    sceneRef,
    timeExtent,
    xDataKey,
  } = params;
  const innerWidthArea = innerWidth;
  const areaXScaleD3Ref = useRef<((value: Date) => number | undefined) | null>(null);
  useEffect(() => {
    if (!timeExtent) { areaXScaleD3Ref.current = null; return; }
    areaXScaleD3Ref.current = scaleUtc().domain([timeExtent.minTime, timeExtent.maxTime]).range([0, innerWidthArea]);
  }, [timeExtent, innerWidthArea]);
  // Selection resolves through the host's live interaction/scene refs, not a duplicate scale.
  const resolveScenePos = clientToScene;
  const invertSceneX = useCallback(
    (sceneX: number) => sceneRef.current?.scales.x.invert?.(sceneX) ?? undefined,
    [sceneRef],
  );
  const { selection: chartSelection } = useChartSelection({
    containerRef,
    data,
    enabled: true,
    innerWidth: innerWidthArea,
    invertSceneX,
    marginLeft,
    onDragEnd,
    onDragStart,
    resolveScenePos,
    xDataKey,
  });
  const segmentComponents = useMemo(() => extractSegmentComponents(children), [children]);
  const refAreaChildren = useMemo(() => extractReferenceAreaProps(children), [children]);

  return {
    areaXScaleD3Ref,
    chartSelection,
    refAreaChildren,
    segmentComponents,
  };
};

export { useAreaSelection };
export type { AreaSelection, AreaSelectionParams };
