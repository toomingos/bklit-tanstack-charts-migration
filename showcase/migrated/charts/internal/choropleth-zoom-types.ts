// Choropleth zoom public type surface (legacy zoom shape, gesture engine now d3-zoom).
// Moved verbatim from internal/zoom-engine.ts, internal/zoom-math.ts and internal/zoom-point.ts (V3.2).
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  TouchEvent as ReactTouchEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import type { UserHandlers } from "@use-gesture/react";

interface TransformMatrix {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly skewX: number;
  readonly skewY: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

type Translate = Pick<TransformMatrix, "translateX" | "translateY">;
type Scale = Pick<TransformMatrix, "scaleX" | "scaleY">;

type GenericWheelEvent = ReactWheelEvent | WheelEvent;
type InteractionEvent =
  | ReactMouseEvent
  | ReactTouchEvent
  | ReactPointerEvent
  | MouseEvent
  | TouchEvent
  | PointerEvent;

interface ScaleSignature {
  readonly scaleX: TransformMatrix["scaleX"];
  readonly scaleY?: TransformMatrix["scaleY"];
  readonly point?: Point;
}

interface ProvidedZoom<ElementType> {
  readonly center: () => void;
  readonly clear: () => void;
  readonly scale: (scale: ScaleSignature) => void;
  readonly translate: (translate: Translate) => void;
  readonly translateTo: (point: Point) => void;
  readonly setTranslate: (translate: Translate) => void;
  readonly setTransformMatrix: (matrix: TransformMatrix) => void;
  readonly reset: () => void;
  readonly handleWheel: (event: GenericWheelEvent) => void;
  readonly handlePinch: UserHandlers["onPinch"];
  readonly dragEnd: () => void;
  readonly dragMove: (event: InteractionEvent, options?: { readonly offsetX?: number; readonly offsetY?: number }) => void;
  readonly dragStart: (event: InteractionEvent) => void;
  readonly toString: () => string;
  readonly invert: () => TransformMatrix;
  readonly toStringInvert: () => string;
  readonly applyToPoint: ({ x, y }: Point) => Point;
  readonly applyInverseToPoint: ({ x, y }: Point) => Point;
  readonly containerRef: RefObject<ElementType | null>;
}

interface ZoomState {
  readonly initialTransformMatrix: TransformMatrix;
  readonly transformMatrix: TransformMatrix;
  readonly isDragging: boolean;
}

type ZoomInstance<ElementType> = ProvidedZoom<ElementType> & ZoomState;

export type {
  ScaleSignature,
  ProvidedZoom,
  ZoomState,
  ZoomInstance,
  GenericWheelEvent,
  InteractionEvent,
  TransformMatrix,
  Point,
  Translate,
  Scale,
};
