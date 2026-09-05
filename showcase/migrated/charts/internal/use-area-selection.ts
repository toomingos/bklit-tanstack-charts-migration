// Area selection hook: scene inversion, drag selection, segment/ref-area extraction.
import { useCallback, useMemo } from "react";
import type { ReactNode, RefObject } from "react";
import type { ChartScene, ChartTooltipPosition } from "@tanstack/charts";
import { extractReferenceAreaProps } from "./reference-area-config";
import { extractSegmentComponents, useChartSelection } from "./chart-selection";
import type { ChartSelection, SegmentComponent } from "./chart-selection";
import type { ChartDatum } from "./types";

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
  readonly xDataKey: string;
}

interface AreaSelection {
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
    xDataKey,
  } = params;
  const innerWidthArea = innerWidth;
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
    chartSelection,
    refAreaChildren,
    segmentComponents,
  };
};

export { useAreaSelection };
export type { AreaSelection, AreaSelectionParams };
