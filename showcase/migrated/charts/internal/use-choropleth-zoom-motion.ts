import { useCallback, useRef, useState } from "react";
import type { TransformMatrix } from "./choropleth-zoom-types";
import {
  matricesEqual,
  queueZoomFrame,
  resolveZoomFrameMatrix,
  zoomSnapshotChanged,
} from "./choropleth-zoom-motion";

interface UseChoroplethZoomMotionOptions {
  readonly initialZoom: TransformMatrix;
}

interface ZoomTickInput {
  readonly transformMatrix: TransformMatrix;
  readonly isDragging: boolean;
}

interface UseChoroplethZoomMotionState {
  readonly displayMatrix: TransformMatrix;
  readonly getIsDragging: () => boolean;
  readonly setRefreshTooltipAnchor: (refresh: () => void) => void;
  readonly onZoomTick: (zoom: Readonly<ZoomTickInput>) => void;
}

const useChoroplethZoomMotion = (
  options: Readonly<UseChoroplethZoomMotionOptions>,
): UseChoroplethZoomMotionState => {
  const { initialZoom } = options;

  const [displayMatrix, setDisplayMatrix] = useState<TransformMatrix>(() => initialZoom);
  const targetMatrixRef = useRef<TransformMatrix>(initialZoom);
  const isDraggingRef = useRef(false);
  const committedMatrixRef = useRef<TransformMatrix>(initialZoom);
  const committedDraggingRef = useRef(false);
  const easeRef = useRef<{ from: TransformMatrix; start: number } | undefined>(undefined);
  const zoomRafRef = useRef<number | undefined>(undefined);
  const refreshTooltipAnchorRef = useRef<() => void>(() => {
    // No-op until the tooltip anchor registers its refresh.
  });

  const stepZoomFrame = useCallback(function stepZoomFrame(now: number): void {
    zoomRafRef.current = undefined;
    const dragging = isDraggingRef.current;
    const next = resolveZoomFrameMatrix({ dragging, easeRef, now, target: targetMatrixRef.current });
    if (zoomSnapshotChanged({ committedDragging: committedDraggingRef.current, committedMatrix: committedMatrixRef.current, dragging, matrix: next })) {
      committedMatrixRef.current = next;
      committedDraggingRef.current = dragging;
      setDisplayMatrix(next);
      refreshTooltipAnchorRef.current();
    }
    zoomRafRef.current = queueZoomFrame(dragging || easeRef.current !== undefined, stepZoomFrame);
  }, []);

  const scheduleZoomFrame = useCallback(() => {
    if ((zoomRafRef.current ?? 0) !== 0) {return;}
    zoomRafRef.current = requestAnimationFrame(stepZoomFrame);
  }, [stepZoomFrame]);

  const onZoomTick = useCallback((zoom: Readonly<ZoomTickInput>) => {
    targetMatrixRef.current = zoom.transformMatrix;
    isDraggingRef.current = zoom.isDragging;
    if (zoom.isDragging) {
      easeRef.current = undefined;
    } else if (matricesEqual(zoom.transformMatrix, committedMatrixRef.current)) {
      // Settled on the committed matrix: the existing ease (if any) already applies.
    }
    else {easeRef.current = { from: committedMatrixRef.current, start: performance.now() };}
    scheduleZoomFrame();
  }, [scheduleZoomFrame]);

  // Stable accessors keep ref objects inside the hook: hook-returned refs read
  // As effect deps, so callers use these instead of touching the refs directly.
  const getIsDragging = useCallback((): boolean => isDraggingRef.current, []);
  const setRefreshTooltipAnchor = useCallback((refresh: () => void): void => {
    refreshTooltipAnchorRef.current = refresh;
  }, []);

  return { displayMatrix, getIsDragging, onZoomTick, setRefreshTooltipAnchor };
};

export { useChoroplethZoomMotion };
export type { UseChoroplethZoomMotionOptions, UseChoroplethZoomMotionState };
