"use client";

// Vendored @visx/zoom port: TanStack zoomX is 1-D, so 2-D geo pan/zoom stays local.
import type { ReactElement, RefObject } from 'react';
import { useGesture } from '@use-gesture/react';
import type { UserHandlers } from '@use-gesture/react';
import { ZOOM_STEP_IN_FACTOR, ZOOM_STEP_OUT_FACTOR } from "./zoom-math";
import type { Point, Scale, TransformMatrix, Translate } from "./zoom-math";
import type { GenericWheelEvent, InteractionEvent } from "./zoom-point";
import { useZoomConstrain, useZoomCoreApi, useZoomScaleApi, useZoomTransform, useZoomViewApi } from "./zoom-matrix-api";
import type { ZoomCoreApi, ZoomScaleApi, ZoomTransform, ZoomViewApi } from "./zoom-matrix-api";
import { useZoomInteractions } from "./zoom-gesture-api";
import type { PinchDelta, ZoomInteractions } from "./zoom-gesture-api";

interface ScaleSignature {
  readonly scaleX: TransformMatrix["scaleX"];
  readonly scaleY?: TransformMatrix["scaleY"];
  readonly point?: Point;
}

interface ProvidedZoom<ElementType> {
  center: () => void;
  clear: () => void;
  scale: (scale: ScaleSignature) => void;
  translate: (translate: Translate) => void;
  translateTo: (point: Point) => void;
  setTranslate: (translate: Translate) => void;
  setTransformMatrix: (matrix: TransformMatrix) => void;
  reset: () => void;
  handleWheel: (event: GenericWheelEvent) => void;
  handlePinch: UserHandlers["onPinch"];
  dragEnd: () => void;
  dragMove: (event: InteractionEvent, options?: { readonly offsetX?: number; readonly offsetY?: number }) => void;
  dragStart: (event: InteractionEvent) => void;
  toString: () => string;
  invert: () => TransformMatrix;
  toStringInvert: () => string;
  applyToPoint: ({ x, y }: Point) => Point;
  applyInverseToPoint: ({ x, y }: Point) => Point;
  containerRef: RefObject<ElementType | null>;
}

interface ZoomState {
  initialTransformMatrix: TransformMatrix;
  transformMatrix: TransformMatrix;
  isDragging: boolean;
}

type ZoomInstance<ElementType> = ProvidedZoom<ElementType> & ZoomState;


interface ZoomProps<ElementType> {
  readonly width: number;
  readonly height: number;
  readonly wheelDelta?: (event: GenericWheelEvent) => Scale;
  readonly pinchDelta?: PinchDelta;
  readonly scaleXMin?: number;
  readonly scaleXMax?: number;
  readonly scaleYMin?: number;
  readonly scaleYMax?: number;
  readonly constrain?: (transform: TransformMatrix, prevTransform: TransformMatrix) => TransformMatrix;
  readonly initialTransformMatrix?: TransformMatrix;
  readonly children: (zoom: ZoomInstance<ElementType>) => ReactElement;
}

const defaultInitialTransformMatrix: TransformMatrix = {
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  skewY: 0,
  translateX: 0,
  translateY: 0,
};

const defaultWheelDelta = (event: GenericWheelEvent): Scale => -event.deltaY > 0 ? { scaleX: ZOOM_STEP_IN_FACTOR, scaleY: ZOOM_STEP_IN_FACTOR } : { scaleX: ZOOM_STEP_OUT_FACTOR, scaleY: ZOOM_STEP_OUT_FACTOR };

const defaultPinchDelta: PinchDelta = ({ offset: [currentScale], lastOffset: [lastS] }) => ({
  scaleX: currentScale - lastS < 0 ? ZOOM_STEP_OUT_FACTOR : ZOOM_STEP_IN_FACTOR,
  scaleY: currentScale - lastS < 0 ? ZOOM_STEP_OUT_FACTOR : ZOOM_STEP_IN_FACTOR,
});

interface ZoomInstanceArgs<ElementType> {
  readonly transform: Readonly<ZoomTransform<ElementType>>;
  readonly core: Readonly<ZoomCoreApi>;
  readonly scaleApi: Readonly<ZoomScaleApi>;
  readonly view: Readonly<ZoomViewApi>;
  readonly gesture: Readonly<ZoomInteractions>;
  readonly initialTransformMatrix: TransformMatrix;
}

// Assembles the public zoom instance; hoisted so Zoom stays short.
const assembleZoomInstance = <ElementType extends Element>(instance: Readonly<ZoomInstanceArgs<ElementType>>): ZoomInstance<ElementType> => ({
  applyInverseToPoint: instance.core.applyInverseToPoint,
  applyToPoint: instance.core.applyToPoint,
  center: instance.view.center,
  clear: instance.view.clear,
  containerRef: instance.transform.containerRef,
  dragEnd: instance.gesture.dragEnd,
  dragMove: instance.gesture.dragMove,
  dragStart: instance.gesture.dragStart,
  handlePinch: instance.gesture.handlePinch,
  handleWheel: instance.gesture.handleWheel,
  initialTransformMatrix: instance.initialTransformMatrix,
  invert: instance.view.invert,
  isDragging: instance.transform.isDragging,
  reset: instance.core.reset,
  scale: instance.scaleApi.scale,
  setTransformMatrix: instance.core.setTransformMatrix,
  setTranslate: instance.scaleApi.setTranslate,
  toString: instance.view.toString,
  toStringInvert: instance.view.toStringInvert,
  transformMatrix: instance.transform.transformMatrix,
  translate: instance.scaleApi.translate,
  translateTo: instance.scaleApi.translateTo,
});

const Zoom = <ElementType extends Element>({
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
}: ZoomProps<ElementType>): ReactElement => {
  const transform = useZoomTransform<ElementType>(initialTransformMatrix);
  const defaultConstrain = useZoomConstrain({ constrain, scaleXMax, scaleXMin, scaleYMax, scaleYMin });
  const core = useZoomCoreApi<ElementType>({ defaultConstrain, initialTransformMatrix, transform });
  const scaleApi = useZoomScaleApi<ElementType>({ height, setTransformMatrix: core.setTransformMatrix, transform, width });
  const view = useZoomViewApi({
    applyInverseToPoint: core.applyInverseToPoint,
    height,
    setTransformMatrix: core.setTransformMatrix,
    transformMatrix: transform.transformMatrix,
    translate: scaleApi.translate,
    width,
  });
  const gesture = useZoomInteractions<ElementType>({ pinchDelta, scale: scaleApi.scale, setTranslate: scaleApi.setTranslate, transform, wheelDelta });

  useGesture(
    {
      onDrag: gesture.onDrag,
      onDragEnd: gesture.dragEnd,
      onDragStart: gesture.onDragStart,
      onPinch: gesture.handlePinch,
      onWheel: gesture.onWheel,
    },
    {
      drag: { filterTaps: true },
      eventOptions: { passive: false },
      target: transform.containerRef,
    },
  );

  const zoom = assembleZoomInstance<ElementType>({ core, gesture, initialTransformMatrix, scaleApi, transform, view });

  return children(zoom);
}

export type {
  ScaleSignature,
  ProvidedZoom,
  ZoomState,
  ZoomInstance,
  ZoomProps,
};
export type { PinchDelta } from "./zoom-gesture-api";
export type { GenericWheelEvent, InteractionEvent } from "./zoom-point";
export type { TransformMatrix, Point, Translate, Scale } from "./zoom-math";
export { Zoom };
export default Zoom;
