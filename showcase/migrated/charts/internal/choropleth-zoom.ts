"use client";

// Choropleth 2-D pan/zoom on D3-zoom with the legacy zoom-shaped facade the chart calls.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";
import { select } from "d3-selection";
import type { Selection } from "d3-selection";
import { zoom, zoomIdentity, ZoomTransform } from "d3-zoom";
import type { D3ZoomEvent, ZoomBehavior } from "d3-zoom";
import type { UserHandlers } from "@use-gesture/react";
import type {
  GenericWheelEvent,
  InteractionEvent,
  Point,
  ScaleSignature,
  TransformMatrix,
  Translate,
  ZoomInstance,
} from "./choropleth-zoom-types";

interface ZoomTickInput {
  readonly transformMatrix: TransformMatrix;
  readonly isDragging: boolean;
}

const matrixFromZoomTransform = (transform: ZoomTransform): TransformMatrix => ({
  scaleX: transform.k,
  scaleY: transform.k,
  skewX: 0,
  skewY: 0,
  translateX: transform.x,
  translateY: transform.y,
});

const zoomTransformFromMatrix = (matrix: Readonly<TransformMatrix>): ZoomTransform =>
  zoomIdentity.translate(matrix.translateX, matrix.translateY).scale(matrix.scaleX);

const applyMatrixToPoint = (matrix: Readonly<TransformMatrix>, point: Readonly<Point>): Point => ({
  x: matrix.scaleX * point.x + matrix.skewX * point.y + matrix.translateX,
  y: matrix.skewY * point.x + matrix.scaleY * point.y + matrix.translateY,
});

const invertMatrix = (
  { scaleX, scaleY, translateX, translateY, skewX, skewY }: Readonly<TransformMatrix>,
): TransformMatrix => {
  const denominator = scaleX * scaleY - skewY * skewX;
  return {
    scaleX: scaleY / denominator,
    scaleY: scaleX / denominator,
    skewX: skewX / -denominator,
    skewY: skewY / -denominator,
    translateX: (scaleY * translateX - skewX * translateY) / -denominator,
    translateY: (skewY * translateX - scaleX * translateY) / denominator,
  };
};

const matrixToString = (
  { scaleX, scaleY, translateX, translateY, skewX, skewY }: Readonly<TransformMatrix>,
): string =>
  `matrix(${scaleX}, ${skewY}, ${skewX}, ${scaleY}, ${translateX}, ${translateY})`;

const identityMatrix = (): TransformMatrix => ({
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  skewY: 0,
  translateX: 0,
  translateY: 0,
});

// D3-zoom transforms are uniform-scale and skew-free: anything else throws like an invalid prop.
const assertUniformMatrix = (matrix: Readonly<TransformMatrix>): void => {
  if (matrix.skewX !== 0 || matrix.skewY !== 0 || matrix.scaleX !== matrix.scaleY) {
    throw new Error("ChoroplethZoom: TransformMatrix with non-uniform scale or skew is not representable in d3-zoom.");
  }
};

// Legacy manual wheel/pinch step factors (the deleted resolveWheelZoomDelta pair).
const LEGACY_ZOOM_OUT_FACTOR = 0.95;
const LEGACY_ZOOM_IN_FACTOR = 1.05;
// D3-zoom scales by 2^wheelDelta per wheel event: log2 factors reproduce the legacy
// Per-tick step (resolveWheelZoomDelta: deltaY > 0 ? 0.95 : 1.05) exactly.
const WHEEL_ZOOM_OUT_DELTA = Math.log2(LEGACY_ZOOM_OUT_FACTOR);
const WHEEL_ZOOM_IN_DELTA = Math.log2(LEGACY_ZOOM_IN_FACTOR);
const wheelDeltaForEvent = (event: Readonly<{ deltaY: number }>): number =>
  event.deltaY > 0 ? WHEEL_ZOOM_OUT_DELTA : WHEEL_ZOOM_IN_DELTA;

type HostSelection = Selection<HTMLElement, unknown, null, undefined>;

const releaseZoom = (element: HTMLElement): void => {
  select(element).on(".zoom", null);
};

const activeSelection = (shared: Readonly<FacadeShared>): HostSelection | null => {
  const element = shared.containerRef.current;
  return element ? select(element) : null;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;const isDragSourceEvent = (sourceEvent: unknown): boolean =>
  isObject(sourceEvent)
  && (sourceEvent.type === "mousedown" || sourceEvent.type === "pointerdown" || sourceEvent.type === "touchstart");

const eventPoint = (element: HTMLElement | null, event: InteractionEvent): Point | undefined => {
  if (element === null) {return undefined;}
  const rect = element.getBoundingClientRect();
  if ("changedTouches" in event) {
    const touch = event.changedTouches.item(0);
    if (touch === null) {return undefined;}
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }
  if ("clientX" in event && "clientY" in event) {
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  return undefined;
};

// D3 scaleTo math for the selection-free manual paths (constrain/translateExtent stay infinite).
const scaleAroundPoint = (transform: ZoomTransform, factor: number, at: Readonly<Point>): ZoomTransform => {
  const [ix, iy] = transform.invert([at.x, at.y]);
  const scaled = transform.k * factor;
  return new ZoomTransform(scaled, at.x - ix * scaled, at.y - iy * scaled);
};

// D3 translateTo math: data point (x, y) lands on the viewport center.
const translateToTransform = (transform: ZoomTransform, x: number, y: number, center: Readonly<Point>): ZoomTransform =>
  new ZoomTransform(transform.k, center.x - x * transform.k, center.y - y * transform.k);

interface FacadeShared {
  readonly behaviour: ZoomBehavior<HTMLElement, unknown>;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly transformRef: RefObject<ZoomTransform>;
  readonly draggingRef: RefObject<boolean>;
  readonly sizeRef: RefObject<{ readonly height: number; readonly width: number }>;
  readonly initialTransformMatrix: TransformMatrix;
  readonly zoomMin: number;
  readonly zoomMax: number;
  readonly commit: (transform: ZoomTransform) => void;
  readonly report: () => void;
}

const clampK = (shared: Readonly<FacadeShared>, scale: number): number =>
  Math.max(shared.zoomMin, Math.min(shared.zoomMax, scale));

// Programmatic set: clamp into scaleExtent, then ride the behavior so zoom events fire.
const applyTransform = (shared: Readonly<FacadeShared>, transform: ZoomTransform): void => {
  const clamped = new ZoomTransform(clampK(shared, transform.k), transform.x, transform.y);
  const selection = activeSelection(shared);
  if (selection) {shared.behaviour.transform(selection, clamped);}
  else {shared.commit(clamped);}
};

const centerOf = (shared: Readonly<FacadeShared>): Point => ({
  x: shared.sizeRef.current.width / 2,
  y: shared.sizeRef.current.height / 2,
});

const scaleByFactor = (shared: Readonly<FacadeShared>, factor: number, at: Readonly<Point> | undefined): void => {
  const selection = activeSelection(shared);
  if (selection) {
    shared.behaviour.scaleBy(selection, factor, at ? [at.x, at.y] : undefined);
    return;
  }
  const { current } = shared.transformRef;
  shared.commit(scaleAroundPoint(current, factor, at ?? centerOf(shared)));
};

const makeScale = (shared: Readonly<FacadeShared>) => (scale: ScaleSignature): void => {
  if (scale.scaleY !== undefined && scale.scaleY !== scale.scaleX) {
    throw new Error("ChoroplethZoom: scale with non-uniform scaleX/scaleY is not representable in d3-zoom.");
  }
  scaleByFactor(shared, scale.scaleX, scale.point);
};

const makeTranslateTo = (shared: Readonly<FacadeShared>) => (point: Point): void => {
  const selection = activeSelection(shared);
  if (selection) {
    shared.behaviour.translateTo(selection, point.x, point.y);
    return;
  }
  const { current } = shared.transformRef;
  shared.commit(translateToTransform(current, point.x, point.y, centerOf(shared)));
};

const makeHandleWheel = (shared: Readonly<FacadeShared>) => (event: GenericWheelEvent): void => {
  event.preventDefault();
  const factor = event.deltaY > 0 ? LEGACY_ZOOM_OUT_FACTOR : LEGACY_ZOOM_IN_FACTOR;
  scaleByFactor(shared, factor, eventPoint(shared.containerRef.current, event) ?? centerOf(shared));
};

type PinchHandlerState = Parameters<UserHandlers["onPinch"]>[0];

const pinchAnchor = (shared: Readonly<FacadeShared>, state: PinchHandlerState): Point => {
  const element = shared.containerRef.current;
  if (!element) {return centerOf(shared);}
  const rect = element.getBoundingClientRect();
  const [ox, oy] = state.origin;
  return { x: ox - rect.left, y: oy - rect.top };
};

const makeHandlePinch: (shared: Readonly<FacadeShared>) => UserHandlers["onPinch"] = (shared) => (state) => {
  const [currentScale] = state.offset;
  const [lastScale] = state.lastOffset;
  const factor = lastScale === 0 ? 1 : currentScale / lastScale;
  if (!Number.isFinite(factor) || factor === 1) {return undefined;}
  scaleByFactor(shared, factor, pinchAnchor(shared, state));
  return undefined;
};

interface DragState {
  point: Point;
  translateX: number;
  translateY: number;
}

const makeDragStart = (shared: Readonly<FacadeShared>, dragRef: RefObject<DragState | undefined>) =>
  (event: InteractionEvent): void => {
    const at = eventPoint(shared.containerRef.current, event);
    const { current } = shared.transformRef;
    dragRef.current = { point: at ?? centerOf(shared), translateX: current.x, translateY: current.y };
    shared.draggingRef.current = true;
    shared.report();
  };

const makeDragMove = (shared: Readonly<FacadeShared>, dragRef: RefObject<DragState | undefined>) =>
  (event: InteractionEvent, options?: { readonly offsetX?: number; readonly offsetY?: number }): void => {
    const start = dragRef.current;
    const at = eventPoint(shared.containerRef.current, event);
    if (!start || !at) {return;}
    // Legacy drag maps screen pixels 1:1 onto translate units (not D3's k-scaled translateBy).
    const translateX = start.translateX + (at.x - start.point.x) + (options?.offsetX ?? 0);
    const translateY = start.translateY + (at.y - start.point.y) + (options?.offsetY ?? 0);
    const { current } = shared.transformRef;
    applyTransform(shared, new ZoomTransform(current.k, translateX, translateY));
  };

const makeDragEnd = (shared: Readonly<FacadeShared>, dragRef: RefObject<DragState | undefined>) => (): void => {
  dragRef.current = undefined;
  shared.draggingRef.current = false;
  shared.report();
};

const createZoomInstance = (
  shared: Readonly<FacadeShared>,
  dragRef: RefObject<DragState | undefined>,
  matrix: TransformMatrix,
  dragging: boolean,
): ZoomInstance<HTMLElement> => {
  const { current } = shared.transformRef;
  const { height, width } = shared.sizeRef.current;
  return {
    applyInverseToPoint: ({ x, y }: Point): Point => applyMatrixToPoint(invertMatrix(matrix), { x, y }),
    applyToPoint: ({ x, y }: Point): Point => applyMatrixToPoint(matrix, { x, y }),
    center: (): void => {
      const [dx, dy] = current.invert([width / 2, height / 2]);
      makeTranslateTo(shared)({ x: dx, y: dy });
    },
    clear: (): void => {
      applyTransform(shared, zoomIdentity);
    },
    containerRef: shared.containerRef,
    dragEnd: makeDragEnd(shared, dragRef),
    dragMove: makeDragMove(shared, dragRef),
    dragStart: makeDragStart(shared, dragRef),
    handlePinch: makeHandlePinch(shared),
    handleWheel: makeHandleWheel(shared),
    initialTransformMatrix: shared.initialTransformMatrix,
    invert: (): TransformMatrix => invertMatrix(matrix),
    isDragging: dragging,
    reset: (): void => {
      assertUniformMatrix(shared.initialTransformMatrix);
      applyTransform(shared, zoomTransformFromMatrix(shared.initialTransformMatrix));
    },
    scale: makeScale(shared),
    setTransformMatrix: (next: TransformMatrix): void => {
      assertUniformMatrix(next);
      applyTransform(shared, zoomTransformFromMatrix(next));
    },
    setTranslate: (translate: Translate): void => {
      applyTransform(shared, zoomIdentity.translate(translate.translateX, translate.translateY).scale(current.k));
    },
    toString: (): string => matrixToString(matrix),
    toStringInvert: (): string => matrixToString(invertMatrix(matrix)),
    transformMatrix: matrix,
    translate: (translate: Translate): void => {
      const selection = activeSelection(shared);
      if (selection) {shared.behaviour.translateBy(selection, translate.translateX, translate.translateY);}
      else {shared.commit(current.translate(translate.translateX, translate.translateY));}
    },
    translateTo: makeTranslateTo(shared),
  };
};

interface ChoroplethZoomProps {
  readonly width: number;
  readonly height: number;
  readonly initialTransformMatrix: TransformMatrix;
  readonly zoomMin: number;
  readonly zoomMax: number;
  readonly onZoomTick: (zoom: ZoomTickInput) => void;
  readonly children: (zoom: ZoomInstance<HTMLElement>) => ReactElement;
}

interface BoundTarget {
  readonly element: HTMLElement;
  readonly behaviour: ZoomBehavior<HTMLElement, unknown>;
}

const ChoroplethZoom = ({
  width,
  height,
  initialTransformMatrix,
  zoomMin,
  zoomMax,
  onZoomTick,
  children,
}: Readonly<ChoroplethZoomProps>): ReactElement => {
  assertUniformMatrix(initialTransformMatrix);
  const containerRef = useRef<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = useState<ZoomTickInput>(() => ({
    isDragging: false,
    transformMatrix: initialTransformMatrix,
  }));
  const [initialTransform] = useState(() => zoomTransformFromMatrix(initialTransformMatrix));
  const transformRef = useRef(initialTransform);
  const draggingRef = useRef(false);
  const dragRef = useRef<DragState | undefined>(undefined);
  const boundRef = useRef<BoundTarget | null>(null);
  const sizeRef = useRef({ height, width });
  sizeRef.current = { height, width };

  const commit = useCallback((transform: ZoomTransform): void => {
    const clamped = new ZoomTransform(
      Math.max(zoomMin, Math.min(zoomMax, transform.k)),
      transform.x,
      transform.y,
    );
    transformRef.current = clamped;
    const transformMatrix = matrixFromZoomTransform(clamped);
    const isDragging = draggingRef.current;
    setSnapshot({ isDragging, transformMatrix });
    onZoomTick({ isDragging, transformMatrix });
  }, [zoomMin, zoomMax, onZoomTick]);

  // Manual drag API reports flag-only ticks through the same tick the gestures use.
  const report = useCallback((): void => {
    const transformMatrix = matrixFromZoomTransform(transformRef.current);
    const isDragging = draggingRef.current;
    setSnapshot({ isDragging, transformMatrix });
    onZoomTick({ isDragging, transformMatrix });
  }, [onZoomTick]);

  const behaviour = useMemo(
    () =>
      zoom<HTMLElement, unknown>()
        .scaleExtent([zoomMin, zoomMax])
        .wheelDelta(wheelDeltaForEvent)
        .on("start", (event: D3ZoomEvent<HTMLElement, unknown>) => {
          if (isDragSourceEvent(event.sourceEvent)) {
            draggingRef.current = true;
            setSnapshot((prev) => (prev.isDragging ? prev : { ...prev, isDragging: true }));
          }
        })
        .on("zoom", (event: D3ZoomEvent<HTMLElement, unknown>) => {
          commit(event.transform);
        })
        .on("end", () => {
          if (!draggingRef.current) {return;}
          draggingRef.current = false;
          report();
        }),
    [zoomMin, zoomMax, commit, report],
  );

  // Bind on mount; rebind when the host element or the behavior changes.
  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      boundRef.current = null;
    } else {
      const bound = boundRef.current;
      if (!bound || bound.element !== element || bound.behaviour !== behaviour) {
        if (bound && bound.element !== element) {releaseZoom(bound.element);}
        boundRef.current = { behaviour, element };
        select(element).call(behaviour);
        behaviour.transform(select(element), transformRef.current);
      } else {
        select(element).call(behaviour);
      }
    }
    return (): void => {
      const { current } = boundRef;
      if (current) {releaseZoom(current.element);}
    };
  });

  const shared = useMemo<FacadeShared>(
    () => ({
      behaviour,
      commit,
      containerRef,
      draggingRef,
      initialTransformMatrix,
      report,
      sizeRef,
      transformRef,
      zoomMax,
      zoomMin,
    }),
    [behaviour, commit, initialTransformMatrix, report, zoomMax, zoomMin],
  );
  const instance = useMemo(
    () => createZoomInstance(shared, dragRef, snapshot.transformMatrix, snapshot.isDragging),
    [shared, dragRef, snapshot],
  );
  return children(instance);
};

export { ChoroplethZoom, applyMatrixToPoint, identityMatrix, invertMatrix, matrixFromZoomTransform, matrixToString, zoomTransformFromMatrix };
export type { ZoomTickInput };
