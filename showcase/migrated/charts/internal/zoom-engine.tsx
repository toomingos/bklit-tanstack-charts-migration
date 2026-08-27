"use client";

// T19 — local port of `@visx/zoom` (the last surviving `@visx/*` import in
// `migrated/**`). Ported line-by-line from the installed dist so behaviour is
// pixel/interaction identical, per showcase/node_modules/@visx/zoom/lib/:
//   - `Zoom.js` (349 lines) -> the `Zoom` component below
//   - `util/matrix.js` (123 lines) -> the matrix helpers below
//   - `types.d.ts` / `Zoom.d.ts` / `util/matrix.d.ts` -> the type exports below
//
// Reasons this can't just stay a dependency import, and can't be replaced by
// TanStack's own zoom primitive:
//   - `choropleth-chart.tsx` needs 2D geo pan/zoom (independent x/y scale +
//     translate against a `<g transform={matrix}>`). TanStack's zoomX
//     (`@tanstack/charts` interaction-zoom) is 1-dimensional — an x-axis
//     window for time series — and cannot express this. Ruled out of scope.
//   - The vendored `showcase/repos/bklit-ui` reference still imports the real
//     `@visx/zoom` package (its own `choropleth-context.tsx`) and stays the
//     QA/pixel-parity oracle; `@visx/zoom` (and `@visx/event`, which the
//     ported `localPoint` below also inlines) stay installed dependencies —
//     only `migrated/**`'s import graph moves off them.
//
// `@use-gesture/react`'s `useGesture` binds the *native* wheel/pinch listeners
// to `containerRef`, ported verbatim below (including the `onWheel` early
// return on `pinching || !active`, which the original comments explain avoids
// a 2x scale update on the last wheel tick) — not replaced by React onWheel
// props or hand-rolled listeners.
//
// `localPoint` is also inlined (from `@visx/event/lib/{localPoint,
// localPointGeneric,getXAndYFromEvent,typeGuards}.js`), returning a plain
// `{ x, y }` object rather than the `@visx/point` `Point` class — nothing in
// `Zoom.js` calls `.value()`/`.toArray()` on the result, only reads `.x`/`.y`,
// so the class's extra methods are dead weight for this call graph and a
// plain object literal is a faithful (structurally identical) substitute.

import { useCallback, useRef, useState, type ReactElement, type RefObject } from "react";
import type * as React from "react";
import { useGesture, type UserHandlers } from "@use-gesture/react";

// ---------------------------------------------------------------------------
// Types (ported from @visx/zoom/lib/types.d.ts)
// ---------------------------------------------------------------------------

export type GenericWheelEvent = React.WheelEvent | WheelEvent;
export type InteractionEvent =
  | React.MouseEvent
  | React.TouchEvent
  | React.PointerEvent
  | MouseEvent
  | TouchEvent
  | PointerEvent;

export interface TransformMatrix {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  skewX: number;
  skewY: number;
}

export interface Point {
  x: number;
  y: number;
}

export type Translate = Pick<TransformMatrix, "translateX" | "translateY">;
export type Scale = Pick<TransformMatrix, "scaleX" | "scaleY">;

export type PinchDelta = (
  params: Parameters<UserHandlers["onPinch"]>[0],
) => Scale;

export interface ScaleSignature {
  scaleX: TransformMatrix["scaleX"];
  scaleY?: TransformMatrix["scaleY"];
  point?: Point;
}

export interface ProvidedZoom<ElementType> {
  /** Sets translateX/Y to the center defined by width and height. */
  center: () => void;
  /** Sets the transform matrix to the identity matrix. */
  clear: () => void;
  /** Applies the specified scaleX + optional scaleY transform relative to the specified point (or center of canvas if unspecified). */
  scale: (scale: ScaleSignature) => void;
  /** Multiplies the current transform matrix by the specified translation. */
  translate: (translate: Translate) => void;
  /** Translates to a specific x,y point. */
  translateTo: (point: Point) => void;
  /** Sets the translation of the current transform matrix to the specified translation. */
  setTranslate: (translate: Translate) => void;
  /**
   * Sets the transform matrix to the specified matrix, constraining the transform
   * scale by default (or applying props.constrain if provided).
   */
  setTransformMatrix: (matrix: TransformMatrix) => void;
  /** Resets the transform to the initial transform specified by props. */
  reset: () => void;
  /** Callback for a wheel event, updating scale based on props.wheelDelta, relative to the mouse position. */
  handleWheel: (event: React.WheelEvent | WheelEvent) => void;
  /** Callback for a @use-gesture/react on pinch event, updating scale based on props.pinchDelta, relative to the pinch position. */
  handlePinch: UserHandlers["onPinch"];
  /** Callback for dragEnd, sets isDragging to false. */
  dragEnd: () => void;
  /** Callback for dragMove, results in a scale transform. */
  dragMove: (event: InteractionEvent, options?: { offsetX?: number; offsetY?: number }) => void;
  /** Callback for dragStart, sets isDragging to true.  */
  dragStart: (event: InteractionEvent) => void;
  /**
   * Returns a string representation of the matrix transform:
   * matrix(${scaleX}, ${skewY}, ${skewX}, ${scaleY}, ${translateX}, ${translateY})
   */
  toString: () => string;
  /** Returns the inverse of the current transform matrix. */
  invert: () => TransformMatrix;
  /**
   * Returns the string representation of the inverse of the current transform matrix:
   * matrix(${scaleX}, ${skewY}, ${skewX}, ${scaleY}, ${translateX}, ${translateY})
   */
  toStringInvert: () => string;
  /** Applies the current transform matrix to the specified point. */
  applyToPoint: ({ x, y }: Point) => Point;
  /** Applies the inverse of the current transform matrix to the specified point. */
  applyInverseToPoint: ({ x, y }: Point) => Point;
  /** Ref to stick on element to attach all handlers automatically. */
  containerRef: RefObject<ElementType | null>;
}

/** Internal state properties exposed by the Zoom component. */
export interface ZoomState {
  /** The initial transform matrix specified by props. */
  initialTransformMatrix: TransformMatrix;
  /** The current transform matrix. */
  transformMatrix: TransformMatrix;
  /** Whether the user is currently dragging. */
  isDragging: boolean;
}

/** Complete Zoom API including methods and state, passed to children render prop. */
export type ZoomInstance<ElementType> = ProvidedZoom<ElementType> & ZoomState;

// ---------------------------------------------------------------------------
// Matrix helpers (ported from @visx/zoom/lib/util/matrix.js)
// ---------------------------------------------------------------------------

export function identityMatrix(): TransformMatrix {
  return {
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: 0,
    skewX: 0,
    skewY: 0,
  };
}

export function createMatrix({
  scaleX = 1,
  scaleY = 1,
  translateX = 0,
  translateY = 0,
  skewX = 0,
  skewY = 0,
}: Partial<TransformMatrix>): TransformMatrix {
  return { scaleX, scaleY, translateX, translateY, skewX, skewY };
}

export function inverseMatrix({
  scaleX,
  scaleY,
  translateX,
  translateY,
  skewX,
  skewY,
}: TransformMatrix): TransformMatrix {
  const denominator = scaleX * scaleY - skewY * skewX;
  return {
    scaleX: scaleY / denominator,
    scaleY: scaleX / denominator,
    translateX: (scaleY * translateX - skewX * translateY) / -denominator,
    translateY: (skewY * translateX - scaleX * translateY) / denominator,
    skewX: skewX / -denominator,
    skewY: skewY / -denominator,
  };
}

export function applyMatrixToPoint(matrix: TransformMatrix, { x, y }: Point): Point {
  return {
    x: matrix.scaleX * x + matrix.skewX * y + matrix.translateX,
    y: matrix.skewY * x + matrix.scaleY * y + matrix.translateY,
  };
}

export function applyInverseMatrixToPoint(matrix: TransformMatrix, { x, y }: Point): Point {
  return applyMatrixToPoint(inverseMatrix(matrix), { x, y });
}

export function scaleMatrix(scaleX: TransformMatrix["scaleX"], maybeScaleY?: TransformMatrix["scaleY"]): TransformMatrix {
  const scaleY = maybeScaleY || scaleX;
  return createMatrix({ scaleX, scaleY });
}

export function translateMatrix(translateX: TransformMatrix["translateX"], translateY: TransformMatrix["translateY"]): TransformMatrix {
  return createMatrix({ translateX, translateY });
}

export function multiplyMatrices(matrix1: TransformMatrix, matrix2: TransformMatrix): TransformMatrix {
  return {
    scaleX: matrix1.scaleX * matrix2.scaleX + matrix1.skewX * matrix2.skewY,
    scaleY: matrix1.skewY * matrix2.skewX + matrix1.scaleY * matrix2.scaleY,
    translateX: matrix1.scaleX * matrix2.translateX + matrix1.skewX * matrix2.translateY + matrix1.translateX,
    translateY: matrix1.skewY * matrix2.translateX + matrix1.scaleY * matrix2.translateY + matrix1.translateY,
    skewX: matrix1.scaleX * matrix2.skewX + matrix1.skewX * matrix2.scaleY,
    skewY: matrix1.skewY * matrix2.scaleX + matrix1.scaleY * matrix2.skewY,
  };
}

export function composeMatrices(...matrices: TransformMatrix[]): TransformMatrix {
  switch (matrices.length) {
    case 0:
      throw new Error("composeMatrices() requires arguments: was called with no args");
    case 1:
      return matrices[0];
    case 2:
      return multiplyMatrices(matrices[0], matrices[1]);
    default: {
      const [matrix1, matrix2, ...restMatrices] = matrices;
      const matrix = multiplyMatrices(matrix1, matrix2);
      return composeMatrices(matrix, ...restMatrices);
    }
  }
}

// ---------------------------------------------------------------------------
// localPoint (ported from @visx/event/lib/{localPoint,localPointGeneric,
// getXAndYFromEvent,typeGuards}.js) — returns a plain `{x,y}` object instead
// of a `@visx/point` `Point` class instance; see file header for why that's a
// faithful substitute for every call site below.
// ---------------------------------------------------------------------------

type EventType = InteractionEvent | GenericWheelEvent;

function isElementNode(elem: unknown): elem is Element {
  return !!elem && elem instanceof Element;
}

// functional definition of isSVGElement. Note that SVGSVGElements are HTMLElements
function isSVGElementNode(elem: unknown): elem is SVGElement {
  return !!elem && (elem instanceof SVGElement || "ownerSVGElement" in (elem as object));
}

// functional definition of SVGGElement
function isSVGSVGElementNode(elem: unknown): elem is SVGSVGElement {
  return !!elem && "createSVGPoint" in (elem as object);
}

function isSVGGraphicsElementNode(elem: unknown): elem is SVGGraphicsElement {
  return !!elem && "getScreenCTM" in (elem as object);
}

// functional definition of TouchEvent
function isTouchEventType(event: unknown): event is TouchEvent | React.TouchEvent {
  return !!event && "changedTouches" in (event as object);
}

// functional definition of MouseEvent
function isMouseEventType(event: unknown): event is MouseEvent | React.MouseEvent {
  return !!event && "clientX" in (event as object);
}

// functional definition of event
function isEventType(event: unknown): event is Event | React.SyntheticEvent {
  return (
    !!event &&
    (event instanceof Event ||
      ("nativeEvent" in (event as object) && (event as React.SyntheticEvent).nativeEvent instanceof Event))
  );
}

const DEFAULT_POINT: Point = { x: 0, y: 0 };

function getXAndYFromEvent(event?: EventType | null): Point {
  if (!event) return { ...DEFAULT_POINT };
  if (isTouchEventType(event)) {
    return event.changedTouches.length > 0
      ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
      : { ...DEFAULT_POINT };
  }
  if (isMouseEventType(event)) {
    return { x: event.clientX, y: event.clientY };
  }

  // for focus events try to extract the center position of the target element
  const target = (event as unknown as { target?: EventTarget | null })?.target;
  const boundingClientRect =
    target && "getBoundingClientRect" in target
      ? (target as Element).getBoundingClientRect()
      : null;
  if (!boundingClientRect) return { ...DEFAULT_POINT };
  return {
    x: boundingClientRect.x + boundingClientRect.width / 2,
    y: boundingClientRect.y + boundingClientRect.height / 2,
  };
}

function localPointGeneric(node: Element, event: EventType): Point | null {
  if (!node || !event) return null;
  const coords = getXAndYFromEvent(event);

  // find top-most SVG
  const svg = isSVGElementNode(node) ? (node as SVGElement).ownerSVGElement : node;
  const screenCTM = isSVGGraphicsElementNode(svg) ? svg.getScreenCTM() : null;
  if (isSVGSVGElementNode(svg) && screenCTM) {
    let point = svg.createSVGPoint();
    point.x = coords.x;
    point.y = coords.y;
    point = point.matrixTransform(screenCTM.inverse());
    return { x: point.x, y: point.y };
  }

  // fall back to bounding box
  const rect = node.getBoundingClientRect();
  return {
    x: coords.x - rect.left - (node as unknown as HTMLElement).clientLeft,
    y: coords.y - rect.top - (node as unknown as HTMLElement).clientTop,
  };
}

/** Handles two signatures for backwards compatibility. */
function localPoint(nodeOrEvent: Element | EventType, maybeEvent?: EventType): Point | null {
  // localPoint(node, event)
  if (isElementNode(nodeOrEvent) && maybeEvent) {
    return localPointGeneric(nodeOrEvent, maybeEvent);
  }
  // localPoint(event)
  if (isEventType(nodeOrEvent)) {
    const event = nodeOrEvent as EventType;
    const node = (event as unknown as { target?: EventTarget | null }).target;
    if (node) return localPointGeneric(node as Element, event);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Zoom component (ported from @visx/zoom/lib/Zoom.js)
// ---------------------------------------------------------------------------

export type ZoomProps<ElementType> = {
  /** Width of the zoom container. */
  width: number;
  /** Height of the zoom container. */
  height: number;
  /**
   * ```js
   *  wheelDelta(event)
   * ```
   *
   * A function that returns { scaleX,scaleY } factors to scale the matrix by.
   * Scale factors greater than 1 will increase (zoom in), less than 1 will decrease (zoom out).
   */
  wheelDelta?: (event: GenericWheelEvent) => Scale;
  /**
   * ```js
   *  pinchDelta(state)
   * ```
   *
   * A function that returns { scaleX, scaleY, point } factors to scale the matrix by.
   * Scale factors greater than 1 will increase (zoom in), less than 1 will decrease (zoom out), the point is used to find where to zoom.
   * The state parameter is from react-use-gestures onPinch handler
   */
  pinchDelta?: PinchDelta;
  /** Minimum x scale value for transform. */
  scaleXMin?: number;
  /** Maximum x scale value for transform. */
  scaleXMax?: number;
  /** Minimum y scale value for transform. */
  scaleYMin?: number;
  /** Maximum y scale value for transform. */
  scaleYMax?: number;
  /**
   * By default constrain() will only constrain scale values. To change
   * constraints you can pass in your own constrain function as a prop.
   */
  constrain?: (transform: TransformMatrix, prevTransform: TransformMatrix) => TransformMatrix;
  /** Initial transform matrix to apply. */
  initialTransformMatrix?: TransformMatrix;
  children: (zoom: ZoomInstance<ElementType>) => ReactElement;
};

// default prop values
const defaultInitialTransformMatrix: TransformMatrix = {
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
  skewX: 0,
  skewY: 0,
};

const defaultWheelDelta = (event: GenericWheelEvent): Scale =>
  -event.deltaY > 0 ? { scaleX: 1.1, scaleY: 1.1 } : { scaleX: 0.9, scaleY: 0.9 };

const defaultPinchDelta: PinchDelta = ({ offset: [s], lastOffset: [lastS] }) => ({
  scaleX: s - lastS < 0 ? 0.9 : 1.1,
  scaleY: s - lastS < 0 ? 0.9 : 1.1,
});

function Zoom<ElementType extends Element>({
  scaleXMin = 0,
  scaleXMax = Infinity,
  scaleYMin = 0,
  scaleYMax = Infinity,
  initialTransformMatrix = defaultInitialTransformMatrix,
  wheelDelta = defaultWheelDelta,
  pinchDelta = defaultPinchDelta,
  width,
  height,
  constrain,
  children,
}: ZoomProps<ElementType>): ReactElement {
  const containerRef = useRef<ElementType | null>(null);
  const matrixStateRef = useRef(initialTransformMatrix);
  const [transformMatrix, setTransformMatrixState] = useState(initialTransformMatrix);
  const [isDragging, setIsDragging] = useState(false);
  const [startTranslate, setStartTranslate] = useState<Translate | undefined>(undefined);
  const [startPoint, setStartPoint] = useState<Point | undefined>(undefined);

  const defaultConstrain = useCallback(
    (newTransformMatrix: TransformMatrix, prevTransformMatrix: TransformMatrix) => {
      if (constrain) return constrain(newTransformMatrix, prevTransformMatrix);
      const { scaleX, scaleY } = newTransformMatrix;
      const shouldConstrainScaleX = scaleX > scaleXMax || scaleX < scaleXMin;
      const shouldConstrainScaleY = scaleY > scaleYMax || scaleY < scaleYMin;
      if (shouldConstrainScaleX || shouldConstrainScaleY) {
        return prevTransformMatrix;
      }
      return newTransformMatrix;
    },
    [constrain, scaleXMin, scaleXMax, scaleYMin, scaleYMax],
  );

  const setTransformMatrix = useCallback(
    (newTransformMatrix: TransformMatrix) => {
      setTransformMatrixState((prevTransformMatrix) => {
        const updatedTransformMatrix = defaultConstrain(newTransformMatrix, prevTransformMatrix);
        matrixStateRef.current = updatedTransformMatrix;
        return updatedTransformMatrix;
      });
    },
    [defaultConstrain],
  );

  const applyToPoint = useCallback(
    ({ x, y }: Point) => applyMatrixToPoint(transformMatrix, { x, y }),
    [transformMatrix],
  );

  const applyInverseToPoint = useCallback(
    ({ x, y }: Point) => applyInverseMatrixToPoint(transformMatrix, { x, y }),
    [transformMatrix],
  );

  const reset = useCallback(() => {
    setTransformMatrix(initialTransformMatrix);
  }, [initialTransformMatrix, setTransformMatrix]);

  const scale = useCallback(
    ({ scaleX, scaleY: maybeScaleY, point }: ScaleSignature) => {
      const scaleY = maybeScaleY || scaleX;
      const cleanPoint = point || { x: width / 2, y: height / 2 };
      // need to use ref value instead of state here because wheel listener does not have access to latest state
      const translate = applyInverseMatrixToPoint(matrixStateRef.current, cleanPoint);
      const nextMatrix = composeMatrices(
        matrixStateRef.current,
        translateMatrix(translate.x, translate.y),
        scaleMatrix(scaleX, scaleY),
        translateMatrix(-translate.x, -translate.y),
      );
      setTransformMatrix(nextMatrix);
      if (isDragging) {
        const { translateX, translateY } = matrixStateRef.current;
        setStartPoint(point);
        setStartTranslate({ translateX, translateY });
      }
    },
    [height, width, isDragging, setTransformMatrix],
  );

  const translate = useCallback(
    ({ translateX, translateY }: Translate) => {
      const nextMatrix = composeMatrices(transformMatrix, translateMatrix(translateX, translateY));
      setTransformMatrix(nextMatrix);
    },
    [setTransformMatrix, transformMatrix],
  );

  const setTranslate = useCallback(
    ({ translateX, translateY }: Translate) => {
      const nextMatrix = { ...transformMatrix, translateX, translateY };
      setTransformMatrix(nextMatrix);
    },
    [setTransformMatrix, transformMatrix],
  );

  const translateTo = useCallback(
    ({ x, y }: Point) => {
      const point = applyInverseMatrixToPoint(transformMatrix, { x, y });
      setTranslate({ translateX: point.x, translateY: point.y });
    },
    [setTranslate, transformMatrix],
  );

  const invert = useCallback(() => inverseMatrix(transformMatrix), [transformMatrix]);

  const toStringInvert = useCallback(() => {
    const { translateX, translateY, scaleX, scaleY, skewX, skewY } = invert();
    return `matrix(${scaleX}, ${skewY}, ${skewX}, ${scaleY}, ${translateX}, ${translateY})`;
  }, [invert]);

  const dragStart = useCallback(
    (event: InteractionEvent) => {
      const { translateX, translateY } = transformMatrix;
      setStartPoint(localPoint(event) || undefined);
      setStartTranslate({ translateX, translateY });
      setIsDragging(true);
    },
    [transformMatrix],
  );

  const dragMove = useCallback(
    (event: InteractionEvent, options?: { offsetX?: number; offsetY?: number }) => {
      if (!isDragging || !startPoint || !startTranslate) return;
      const currentPoint = localPoint(event);
      const dx = currentPoint ? -(startPoint.x - currentPoint.x) : -startPoint.x;
      const dy = currentPoint ? -(startPoint.y - currentPoint.y) : -startPoint.y;
      let translateX = startTranslate.translateX + dx;
      if (options?.offsetX) translateX += options?.offsetX ?? 0;
      let translateY = startTranslate.translateY + dy;
      if (options?.offsetY) translateY += options?.offsetY ?? 0;
      setTranslate({ translateX, translateY });
    },
    [isDragging, setTranslate, startPoint, startTranslate],
  );

  const dragEnd = useCallback(() => {
    setStartPoint(undefined);
    setStartTranslate(undefined);
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent | WheelEvent) => {
      event.preventDefault();
      const point = localPoint(event) || undefined;
      const { scaleX, scaleY } = wheelDelta(event);
      scale({ scaleX, scaleY, point });
    },
    [scale, wheelDelta],
  );

  const handlePinch: UserHandlers["onPinch"] = useCallback(
    (state) => {
      const {
        origin: [ox, oy],
        memo,
      } = state;
      let currentMemo = memo;
      if (containerRef.current) {
        const { top, left } = currentMemo ?? containerRef.current.getBoundingClientRect();
        if (!currentMemo) {
          currentMemo = { top, left };
        }
        const { scaleX, scaleY } = pinchDelta(state);
        scale({ scaleX, scaleY, point: { x: ox - left, y: oy - top } });
      }
      return currentMemo;
    },
    [scale, pinchDelta],
  );

  const toString = useCallback(() => {
    const { translateX, translateY, scaleX, scaleY, skewX, skewY } = transformMatrix;
    return `matrix(${scaleX}, ${skewY}, ${skewX}, ${scaleY}, ${translateX}, ${translateY})`;
  }, [transformMatrix]);

  const center = useCallback(() => {
    const centerPoint = { x: width / 2, y: height / 2 };
    const inverseCentroid = applyInverseToPoint(centerPoint);
    translate({
      translateX: inverseCentroid.x - centerPoint.x,
      translateY: inverseCentroid.y - centerPoint.y,
    });
  }, [height, width, applyInverseToPoint, translate]);

  const clear = useCallback(() => {
    setTransformMatrix(identityMatrix());
  }, [setTransformMatrix]);

  useGesture(
    {
      onDragStart: ({ event }) => {
        if (!(event instanceof KeyboardEvent)) dragStart(event as InteractionEvent);
      },
      onDrag: ({ event, pinching, cancel }) => {
        if (pinching) {
          cancel();
          dragEnd();
        } else if (!(event instanceof KeyboardEvent)) {
          dragMove(event as InteractionEvent);
        }
      },
      onDragEnd: dragEnd,
      onPinch: handlePinch,
      onWheel: ({ event, active, pinching }) => {
        if (
          // Outside of Safari, the wheel event is fired together with the pinch event
          pinching ||
          // currently onWheelEnd emits one final wheel event which causes 2x scale
          // updates for the last tick. ensuring that the gesture is active avoids this
          !active
        ) {
          return;
        }
        handleWheel(event as WheelEvent);
      },
    },
    {
      target: containerRef as RefObject<Element>,
      eventOptions: { passive: false },
      drag: { filterTaps: true },
    },
  );

  const zoom: ZoomInstance<ElementType> = {
    initialTransformMatrix,
    transformMatrix,
    isDragging,
    center,
    clear,
    scale,
    translate,
    translateTo,
    setTranslate,
    setTransformMatrix,
    reset,
    handleWheel,
    handlePinch,
    dragEnd,
    dragMove,
    dragStart,
    toString,
    invert,
    toStringInvert,
    applyToPoint,
    applyInverseToPoint,
    containerRef,
  };

  return children(zoom);
}

export { Zoom };
export default Zoom;
