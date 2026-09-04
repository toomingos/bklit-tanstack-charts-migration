import { useCallback } from 'react';
import type { UserHandlers } from '@use-gesture/react';
import type { Point, Scale, TransformMatrix, Translate } from "./zoom-math";
import { localPoint } from "./zoom-point";
import type { GenericWheelEvent, InteractionEvent } from "./zoom-point";
import type { ZoomTransform } from "./zoom-matrix-api";

// Drag/wheel/pinch callbacks for Zoom, split out so zoom-engine.tsx stays under the size limits. Hook order and dependency arrays are verbatim from Zoom.

interface ScaleSignatureLocal {
  readonly scaleX: TransformMatrix["scaleX"];
  readonly scaleY?: TransformMatrix["scaleY"];
  readonly point?: Point;
}

type PinchDelta = (
  params: Parameters<UserHandlers["onPinch"]>[0],
) => Scale;

interface DragTranslateArgs {
  readonly startPoint: Point;
  readonly startTranslate: Translate;
  readonly event: InteractionEvent;
  readonly offsetX: number | undefined;
  readonly offsetY: number | undefined;
}

// Drag translation from the gesture event; hoisted so dragMove stays short.
const resolveDragTranslate = (dragArgs: Readonly<DragTranslateArgs>): Translate => {
  const currentPoint = localPoint(dragArgs.event);
  const dx = currentPoint ? -(dragArgs.startPoint.x - currentPoint.x) : -dragArgs.startPoint.x;
  const dy = currentPoint ? -(dragArgs.startPoint.y - currentPoint.y) : -dragArgs.startPoint.y;
  let translateX = dragArgs.startTranslate.translateX + dx;
  if (dragArgs.offsetX !== undefined && dragArgs.offsetX !== 0 && !Number.isNaN(dragArgs.offsetX)) {translateX += dragArgs.offsetX;}
  let translateY = dragArgs.startTranslate.translateY + dy;
  if (dragArgs.offsetY !== undefined && dragArgs.offsetY !== 0 && !Number.isNaN(dragArgs.offsetY)) {translateY += dragArgs.offsetY;}
  return { translateX, translateY };
};

type PinchGestureState = Parameters<UserHandlers["onPinch"]>[0];

interface PinchZoomArgs {
  readonly container: Element | null;
  readonly gesture: PinchGestureState;
  readonly pinchDelta: PinchDelta;
  readonly scale: (scale: ScaleSignatureLocal) => void;
}

// Gesture memo this module writes: the container-relative origin captured on first pinch.
// External gesture state types memo as `any`; this narrows our own memo back to its real shape.
interface PinchOriginMemo {
  readonly left: number;
  readonly top: number;
}

const isNumber = <Value,>(value: Value): value is Value & number => typeof value === "number";

const isPinchOriginMemo = <Value,>(value: Value): value is Value & PinchOriginMemo => {
  if (typeof value !== "object" || value === null) {return false;}
  if (!("left" in value) || !("top" in value)) {return false;}
  return isNumber(value.left) && isNumber(value.top);
};

const isOriginPair = <Value,>(value: Value): value is Value & readonly [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) {return false;}
  const first: unknown = value[0];
  const second: unknown = value[1];
  return isNumber(first) && isNumber(second);
};

// The gesture library documents origin as a number pair, but the resolved handler state
// Reaches this module typed as `any`; re-narrow to that documented shape here.
const readPinchOrigin = (origin: unknown): readonly [number, number] => {
  if (isOriginPair(origin)) {return origin;}
  return [0, 0];
};

// Pinch zoom around the gesture origin; hoisted so handlePinch stays short. Returns the gesture memo.
const applyPinchZoom = (pinchArgs: Readonly<PinchZoomArgs>): PinchOriginMemo | undefined => {
  const gestureMemo: unknown = pinchArgs.gesture.memo;
  const [ox, oy] = readPinchOrigin(pinchArgs.gesture.origin);
  let currentMemo: PinchOriginMemo | undefined = isPinchOriginMemo(gestureMemo) ? gestureMemo : undefined;
  if (pinchArgs.container) {
    const { top, left } = currentMemo ?? pinchArgs.container.getBoundingClientRect();
    currentMemo ??= { left, top };
    const { scaleX, scaleY } = pinchArgs.pinchDelta(pinchArgs.gesture);
    pinchArgs.scale({ point: { x: ox - left, y: oy - top }, scaleX, scaleY });
  }
  return currentMemo;
};

type DragGestureState = Parameters<UserHandlers["onDrag"]>[0];
type WheelGestureState = Parameters<UserHandlers["onWheel"]>[0];

interface GestureDragArgs {
  readonly state: DragGestureState;
  readonly dragMove: (event: InteractionEvent) => void;
  readonly dragEnd: () => void;
}

// Routes one gesture-drag frame; hoisted so the useGesture config stays short.
const handleGestureDrag = (dragArgs: Readonly<GestureDragArgs>): void => {
  const { event, pinching, cancel } = dragArgs.state;
  if (pinching === true) {
    cancel();
    dragArgs.dragEnd();
    return;
  }
  if (!(event instanceof KeyboardEvent)) {dragArgs.dragMove(event);}
};

interface GestureWheelArgs {
  readonly state: WheelGestureState;
  readonly handleWheel: (event: GenericWheelEvent) => void;
}

// Routes one gesture-wheel frame; hoisted so the useGesture config stays short.
const handleGestureWheel = (wheelArgs: Readonly<GestureWheelArgs>): void => {
  const { event, active, pinching } = wheelArgs.state;
  if (pinching === true || !active) {return;}
  wheelArgs.handleWheel(event);
};

interface ZoomInteractions {
  readonly dragStart: (event: InteractionEvent) => void;
  readonly dragMove: (event: InteractionEvent, options?: { readonly offsetX?: number; readonly offsetY?: number }) => void;
  readonly dragEnd: () => void;
  readonly handleWheel: (event: GenericWheelEvent) => void;
  readonly handlePinch: UserHandlers["onPinch"];
  readonly onDrag: (state: DragGestureState) => void;
  readonly onDragStart: (state: DragGestureState) => void;
  readonly onWheel: (state: WheelGestureState) => void;
}

interface ZoomInteractionsArgs<ElementType> {
  readonly transform: Readonly<ZoomTransform<ElementType>>;
  readonly setTranslate: (translate: Translate) => void;
  readonly scale: (scale: ScaleSignatureLocal) => void;
  readonly wheelDelta: (event: GenericWheelEvent) => Scale;
  readonly pinchDelta: PinchDelta;
}

interface ZoomDragApi {
  readonly dragStart: (event: InteractionEvent) => void;
  readonly dragMove: (event: InteractionEvent, options?: { readonly offsetX?: number; readonly offsetY?: number }) => void;
  readonly dragEnd: () => void;
}

interface ZoomDragApiArgs<ElementType> {
  readonly transform: Readonly<ZoomTransform<ElementType>>;
  readonly setTranslate: (translate: Translate) => void;
}

// Drag callbacks for Zoom; one hook so the interactions hook stays short.
const useZoomDrag = <ElementType extends Element>(drag: Readonly<ZoomDragApiArgs<ElementType>>): ZoomDragApi => {
  const { isDragging, setIsDragging, setStartPoint, setStartTranslate, startPoint, startTranslate, transformMatrix } = drag.transform;
  const { setTranslate } = drag;
  const dragStart = useCallback(
    (event: InteractionEvent) => {
      const { translateX, translateY } = transformMatrix;
      setStartPoint(localPoint(event));
      setStartTranslate({ translateX, translateY });
      setIsDragging(true);
    },
    [transformMatrix, setStartPoint, setStartTranslate, setIsDragging],
  );

  const dragMove = useCallback(
    (event: InteractionEvent, options?: { readonly offsetX?: number; readonly offsetY?: number }) => {
      if (!isDragging || !startPoint || !startTranslate) {return;}
      setTranslate(resolveDragTranslate({
        event,
        offsetX: options?.offsetX,
        offsetY: options?.offsetY,
        startPoint,
        startTranslate,
      }));
    },
    [isDragging, setTranslate, startPoint, startTranslate],
  );

  const dragEnd = useCallback(() => {
    setStartPoint(undefined);
    setStartTranslate(undefined);
    setIsDragging(false);
  }, [setStartPoint, setStartTranslate, setIsDragging]);

  return { dragEnd, dragMove, dragStart };
};

interface ZoomWheelApi {
  readonly handleWheel: (event: GenericWheelEvent) => void;
  readonly handlePinch: UserHandlers["onPinch"];
  readonly onDrag: (state: DragGestureState) => void;
  readonly onDragStart: (state: DragGestureState) => void;
  readonly onWheel: (state: WheelGestureState) => void;
}

interface ZoomWheelApiArgs<ElementType> {
  readonly containerRef: ZoomTransform<ElementType>["containerRef"];
  readonly wheelDelta: (event: GenericWheelEvent) => Scale;
  readonly scale: (scale: ScaleSignatureLocal) => void;
  readonly pinchDelta: PinchDelta;
  readonly drag: Readonly<ZoomDragApi>;
}

// Wheel/pinch/gesture-route callbacks for Zoom; one hook so the interactions hook stays short.
const useZoomWheel = <ElementType extends Element>(wheel: Readonly<ZoomWheelApiArgs<ElementType>>): ZoomWheelApi => {
  const { containerRef, pinchDelta, scale, wheelDelta } = wheel;
  const handleWheel = useCallback(
    (event: GenericWheelEvent) => {
      event.preventDefault();
      const point = localPoint(event);
      const { scaleX, scaleY } = wheelDelta(event);
      scale({ point, scaleX, scaleY });
    },
    [scale, wheelDelta],
  );

  const handlePinch: UserHandlers["onPinch"] = useCallback(
    (state) => applyPinchZoom({ container: containerRef.current, gesture: state, pinchDelta, scale }),
    [containerRef, scale, pinchDelta],
  );

  const onDrag = useCallback(
    (state: DragGestureState) => { handleGestureDrag({ dragEnd: wheel.drag.dragEnd, dragMove: wheel.drag.dragMove, state }); },
    [wheel.drag],
  );

  const onDragStart = useCallback(
    (state: DragGestureState) => {
      const { event } = state;
      if (!(event instanceof KeyboardEvent)) {wheel.drag.dragStart(event);}
    },
    [wheel.drag],
  );

  const onWheel = useCallback(
    (state: WheelGestureState) => { handleGestureWheel({ handleWheel, state }); },
    [handleWheel],
  );

  return { handlePinch, handleWheel, onDrag, onDragStart, onWheel };
};

// Drag/wheel/pinch callbacks for Zoom; one hook so Zoom stays short.
const useZoomInteractions = <ElementType extends Element>(interactions: Readonly<ZoomInteractionsArgs<ElementType>>): ZoomInteractions => {
  const drag = useZoomDrag<ElementType>({ setTranslate: interactions.setTranslate, transform: interactions.transform });
  const wheel = useZoomWheel<ElementType>({
    containerRef: interactions.transform.containerRef,
    drag,
    pinchDelta: interactions.pinchDelta,
    scale: interactions.scale,
    wheelDelta: interactions.wheelDelta,
  });
  return { ...drag, ...wheel };
};

export type { DragGestureState, PinchDelta, PinchGestureState, WheelGestureState, ZoomInteractions, ZoomInteractionsArgs };
export { applyPinchZoom, handleGestureDrag, handleGestureWheel, resolveDragTranslate, useZoomInteractions };
