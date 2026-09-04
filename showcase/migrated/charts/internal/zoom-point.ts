import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import type { Point } from "./zoom-math";

// DOM event/point probing for the vendored @visx/zoom port in ./zoom-engine.
// Split out so zoom-engine.tsx stays under the size limits.

type GenericWheelEvent = ReactWheelEvent | WheelEvent;
type InteractionEvent =
  | ReactMouseEvent
  | ReactTouchEvent
  | ReactPointerEvent
  | MouseEvent
  | TouchEvent
  | PointerEvent;

type EventType = InteractionEvent | GenericWheelEvent;

const isElementNode = <Elem>(elem: Elem): elem is Elem & Element => Boolean(elem) && elem instanceof Element;


const isSVGElementNode = <Elem>(elem: Elem): elem is Elem & SVGElement => elem instanceof SVGElement || (typeof elem === "object" && elem !== null && "ownerSVGElement" in elem);


const isSVGSVGElementNode = <Elem>(elem: Elem): elem is Elem & SVGSVGElement => elem instanceof SVGSVGElement || (typeof elem === "object" && elem !== null && "createSVGPoint" in elem);


const isSVGGraphicsElementNode = <Elem>(elem: Elem): elem is Elem & SVGGraphicsElement => elem instanceof SVGGraphicsElement || (typeof elem === "object" && elem !== null && "getScreenCTM" in elem);


const isTouchEventType = <EventValue>(event: EventValue): event is EventValue & (TouchEvent | ReactTouchEvent) => typeof event === "object" && event !== null && "changedTouches" in event;


const isMouseEventType = <EventValue>(event: EventValue): event is EventValue & (MouseEvent | ReactMouseEvent) => typeof event === "object" && event !== null && "clientX" in event;


const isEventType = <EventValue>(event: EventValue): event is EventValue & EventType => {
  if (event instanceof Event) {return true;}
  if (typeof event !== "object" || event === null) {return false;}
  return "nativeEvent" in event && event.nativeEvent instanceof Event;
};


const DEFAULT_POINT: Point = { x: 0, y: 0 };

// First-touch client position; hoisted so getXAndYFromEvent stays short.
const pointFromTouchEvent = (event: TouchEvent | ReactTouchEvent): Point => event.changedTouches.length > 0
    ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
    : { ...DEFAULT_POINT };

// Element-center fallback for events without client coordinates; hoisted so getXAndYFromEvent stays short.
const pointFromElementCenter = (target: EventTarget | null): Point => {
  const boundingClientRect = target instanceof Element ? target.getBoundingClientRect() : undefined;
  if (!boundingClientRect) {return { ...DEFAULT_POINT };}
  return {
    x: boundingClientRect.x + boundingClientRect.width / 2,
    y: boundingClientRect.y + boundingClientRect.height / 2,
  };
};

const getXAndYFromEvent = (event?: EventType | null): Point => {
  if (!event) {return { ...DEFAULT_POINT };}
  const { target } = event;
  if (isTouchEventType(event)) {
    return pointFromTouchEvent(event);
  }
  if (isMouseEventType(event)) {
    return { x: event.clientX, y: event.clientY };
  }
  return pointFromElementCenter(target);
};

// SVG viewport transform of client coordinates; hoisted so localPointGeneric stays short.
const pointInSvgTransform = (svg: SVGSVGElement, screenCTM: DOMMatrix, coords: Point): Point => {
  let point = svg.createSVGPoint();
  point.x = coords.x;
  point.y = coords.y;
  point = point.matrixTransform(screenCTM.inverse());
  return { x: point.x, y: point.y };
};

// Plain {x,y} return: call sites only read .x/.y, never Point methods.
const localPointGeneric = (node: Element | undefined, event: EventType | undefined): Point | undefined => {
  if (node === undefined || event === undefined) {return undefined;}
  const coords = getXAndYFromEvent(event);

  const svg = isSVGElementNode(node) ? (node).ownerSVGElement : node;
  const screenCTM = isSVGGraphicsElementNode(svg) ? svg.getScreenCTM() : undefined;
  if (isSVGSVGElementNode(svg) && screenCTM) {
    return pointInSvgTransform(svg, screenCTM, coords);
  }

  const rect = node.getBoundingClientRect();
  return {
    x: coords.x - rect.left - node.clientLeft,
    y: coords.y - rect.top - node.clientTop,
  };
}

const localPoint = (nodeOrEvent: Element | EventType, maybeEvent?: EventType): Point | undefined => {
  if (isElementNode(nodeOrEvent) && maybeEvent) {
    return localPointGeneric(nodeOrEvent, maybeEvent);
  }
  if (isEventType(nodeOrEvent)) {
    const event = nodeOrEvent;
    const node = event.target;
    if (node instanceof Element) {return localPointGeneric(node, event);}
  }
  return undefined;
}

export type { EventType, GenericWheelEvent, InteractionEvent };
export { getXAndYFromEvent, localPoint };
