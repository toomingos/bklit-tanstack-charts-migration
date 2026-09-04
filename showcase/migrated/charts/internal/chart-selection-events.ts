import type { RefObject } from "react";
import type { ChartSelection, DragCallbacks } from "./chart-selection";

// Shared signatures for the selection listeners.
type PointerHandler = (pointerEvent: PointerEvent) => void;
type TouchEventHandler = (event: Event) => void;
type SelectionSetter = (selection: ChartSelection | null) => void;
type SceneIndexResolver = (sceneX: number) => number;
type ScenePositionResolver = (clientX: number, clientY: number) => { x: number; y: number } | null;

interface SelectionHandlerParams {
  readonly dragCallbacks: DragCallbacks;
  readonly dragStartSceneXRef: RefObject<number>;
  readonly draggingRef: RefObject<boolean>;
  readonly marginLeft: number;
  readonly resolveIndexFromScene: SceneIndexResolver;
  readonly resolveScenePos: ScenePositionResolver;
  readonly setSelection: SelectionSetter;
}

interface ActiveSelectionParams {
  readonly endIndex: number;
  readonly endScene: number;
  readonly marginLeft: number;
  readonly startIndex: number;
  readonly startScene: number;
}

interface SelectionHandlers {
  readonly onPointerDown: PointerHandler;
  readonly onPointerLeave: () => void;
  readonly onPointerMove: PointerHandler;
  readonly onPointerUp: () => void;
  readonly onTouchEnd: () => void;
  readonly onTouchMove: TouchEventHandler;
  readonly onTouchStart: TouchEventHandler;
}

// Builds the active selection value from an ordered scene range and resolved indices.
const buildActiveSelection = (params: Readonly<ActiveSelectionParams>): ChartSelection => {
  const { endIndex, endScene, marginLeft, startIndex, startScene } = params;
  return { active: true, endIndex, endX: endScene - marginLeft, startIndex, startX: startScene - marginLeft };
};

// Captures the pointer to its target so a drag continues outside the element.
const capturePointerTarget = (pointerEvent: PointerEvent): void => {
  const captureTarget = pointerEvent.target;
  if (captureTarget instanceof Element) {
    captureTarget.setPointerCapture(pointerEvent.pointerId);
  }
};

// Begins a pointer drag at the given scene position and clears any selection.
const beginPointerDrag = (params: Readonly<SelectionHandlerParams>, sceneX: number): void => {
  params.draggingRef.current = true;
  params.dragStartSceneXRef.current = sceneX;
  params.dragCallbacks.onDragStart?.();
  params.setSelection(null);
};

// Extends an in-progress pointer drag to the given scene position.
const extendPointerDrag = (params: Readonly<SelectionHandlerParams>, sceneX: number): void => {
  const sceneStart = Math.min(params.dragStartSceneXRef.current, sceneX);
  const sceneEnd = Math.max(params.dragStartSceneXRef.current, sceneX);
  const startIndex = params.resolveIndexFromScene(sceneStart);
  const endIndex = params.resolveIndexFromScene(sceneEnd);
  params.setSelection(buildActiveSelection({ endIndex, endScene: sceneEnd, marginLeft: params.marginLeft, startIndex, startScene: sceneStart }));
};

// Starts a pointer drag selection and captures the pointer to the target.
const handlePointerDown = (params: Readonly<SelectionHandlerParams>, pointerEvent: PointerEvent): void => {
  if (pointerEvent.button !== 0) {return;}
  const pos = params.resolveScenePos(pointerEvent.clientX, pointerEvent.clientY);
  if (!pos) {return;}
  beginPointerDrag(params, pos.x);
  capturePointerTarget(pointerEvent);
};

// Extends the active pointer drag selection to the current pointer position.
const handlePointerMove = (params: Readonly<SelectionHandlerParams>, pointerEvent: PointerEvent): void => {
  if (!params.draggingRef.current) {return;}
  const pos = params.resolveScenePos(pointerEvent.clientX, pointerEvent.clientY);
  if (!pos) {return;}
  extendPointerDrag(params, pos.x);
};

// Ends a pointer drag selection and notifies the drag-end callback.
const handlePointerUp = (params: Readonly<SelectionHandlerParams>): void => {
  const { dragCallbacks, draggingRef, setSelection } = params;
  if (draggingRef.current) {
    draggingRef.current = false;
    dragCallbacks.onDragEnd?.();
  }
  setSelection(null);
};

// Applies a two-finger pinch selection from the current touch positions.
const handleTouchPair = (params: Readonly<SelectionHandlerParams>, touchEvent: TouchEvent): void => {
  const { marginLeft, resolveIndexFromScene, resolveScenePos, setSelection } = params;
  const firstPos = resolveScenePos(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
  const secondPos = resolveScenePos(touchEvent.touches[1].clientX, touchEvent.touches[1].clientY);
  if (!firstPos || !secondPos) {return;}
  const sceneStart = Math.min(firstPos.x, secondPos.x);
  const sceneEnd = Math.max(firstPos.x, secondPos.x);
  const startIndex = resolveIndexFromScene(sceneStart);
  const endIndex = resolveIndexFromScene(sceneEnd);
  setSelection(buildActiveSelection({ endIndex, endScene: sceneEnd, marginLeft, startIndex, startScene: sceneStart }));
};

// Starts a pinch selection when a second finger lands on the chart.
const handleTouchStart = (params: Readonly<SelectionHandlerParams>, touchEvent: TouchEvent): void => {
  const { dragCallbacks } = params;
  if (touchEvent.touches.length !== 2) {return;}
  touchEvent.preventDefault();
  dragCallbacks.onDragStart?.();
  handleTouchPair(params, touchEvent);
};

// Extends the pinch selection while both fingers move.
const handleTouchMove = (params: Readonly<SelectionHandlerParams>, touchEvent: TouchEvent): void => {
  if (touchEvent.touches.length !== 2) {return;}
  touchEvent.preventDefault();
  handleTouchPair(params, touchEvent);
};

// Clears the pinch selection when touch ends.
const handleTouchEnd = (params: Readonly<SelectionHandlerParams>): void => {
  const { dragCallbacks, setSelection } = params;
  dragCallbacks.onDragEnd?.();
  setSelection(null);
};

// Creates the listener callbacks for one subscription from the latest selection inputs.
const createSelectionHandlers = (params: Readonly<SelectionHandlerParams>): SelectionHandlers => {
  const onPointerDown = (pointerEvent: PointerEvent): void => {handlePointerDown(params, pointerEvent);};
  const onPointerMove = (pointerEvent: PointerEvent): void => {handlePointerMove(params, pointerEvent);};
  const onPointerUp = (): void => {handlePointerUp(params);};
  const onTouchEnd = (): void => {handleTouchEnd(params);};
  const onTouchMove = (event: Event): void => {
    if (event instanceof TouchEvent) {handleTouchMove(params, event);}
  };
  const onTouchStart = (event: Event): void => {
    if (event instanceof TouchEvent) {handleTouchStart(params, event);}
  };
  return { onPointerDown, onPointerLeave: onPointerUp, onPointerMove, onPointerUp, onTouchEnd, onTouchMove, onTouchStart };
};

// Attaches the selection listeners and returns the matching cleanup.
const subscribeSelectionListeners = (chartElement: Readonly<HTMLDivElement>, handlers: Readonly<SelectionHandlers>): (() => void) => {
  chartElement.addEventListener("pointerdown", handlers.onPointerDown);
  globalThis.addEventListener("pointermove", handlers.onPointerMove);
  globalThis.addEventListener("pointerup", handlers.onPointerUp);
  chartElement.addEventListener("pointerleave", handlers.onPointerLeave);
  chartElement.addEventListener("touchstart", handlers.onTouchStart, { passive: false });
  chartElement.addEventListener("touchmove", handlers.onTouchMove, { passive: false });
  chartElement.addEventListener("touchend", handlers.onTouchEnd, { passive: true });
  return (): void => {
    chartElement.removeEventListener("pointerdown", handlers.onPointerDown);
    globalThis.removeEventListener("pointermove", handlers.onPointerMove);
    globalThis.removeEventListener("pointerup", handlers.onPointerUp);
    chartElement.removeEventListener("pointerleave", handlers.onPointerLeave);
    chartElement.removeEventListener("touchstart", handlers.onTouchStart);
    chartElement.removeEventListener("touchmove", handlers.onTouchMove);
    chartElement.removeEventListener("touchend", handlers.onTouchEnd);
  };
};

export { createSelectionHandlers, subscribeSelectionListeners };
