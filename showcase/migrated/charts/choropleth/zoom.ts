"use client";

// Choropleth pan/zoom: zoomX is x-scale-only (docs: interactions-and-selections "Zoom and pan") and geo marks have no x/y scales,
// so d3-zoom (the docs' sanctioned escape hatch) drives the *projection* and geoShape repaints natively.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { select } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import type { D3ZoomEvent, ZoomBehavior , ZoomTransform } from "d3-zoom";
import { erase } from "../kit/cartesian/erased-types";
import type { ProjectionHolder } from "./focus";
import { writeVar } from "../kit/host-write";

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

const identityMatrix = (): TransformMatrix => ({ scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, translateX: 0, translateY: 0 });

const toMatrix = (t: ZoomTransform): TransformMatrix => ({
  scaleX: t.k, scaleY: t.k, skewX: 0, skewY: 0, translateX: t.x, translateY: t.y,
});

const fromMatrix = (m: Readonly<TransformMatrix>): ZoomTransform =>
  zoomIdentity.translate(m.translateX, m.translateY).scale(m.scaleX);

/** bklit-compatible zoom facade (subset of visx ProvidedZoom + state). */
interface ChoroplethZoomInstance {
  readonly transformMatrix: TransformMatrix;
  readonly initialTransformMatrix: TransformMatrix;
  readonly isDragging: boolean;
  readonly scale: (s: { scaleX: number; scaleY?: number; point?: Point }) => void;
  readonly translate: (t: { translateX: number; translateY: number }) => void;
  readonly translateTo: (point: Point) => void;
  readonly setTransformMatrix: (matrix: TransformMatrix) => void;
  readonly reset: () => void;
  readonly center: () => void;
  readonly clear: () => void;
  readonly applyToPoint: (point: Point) => Point;
  readonly applyInverseToPoint: (point: Point) => Point;
  readonly toString: () => string;
}

interface ChoroplethZoomContextValue {
  readonly zoom: ChoroplethZoomInstance | null;
}

const ChoroplethZoomContext = createContext<ChoroplethZoomContextValue>({ zoom: null });
const useChoroplethZoom = (): ChoroplethZoomContextValue => useContext(ChoroplethZoomContext);

// bklit wheel step: 5% per tick (d3 scales by 2^delta).
const WHEEL_IN = Math.log2(1.05);
const WHEEL_OUT = Math.log2(0.95);
// bklit pinch (visx defaultPinchDelta): every pinch event steps the scale by 1.1 (spreading, or no change) or 0.9 (closing) about the
// touch midpoint. use-gesture emits the pinch start event, one event per touchmove (two on the second) and one when the gesture ends.
const PINCH_IN = 1.1;
const PINCH_OUT = 0.9;
const PINCH_DOUBLE_MOVE = 2;

interface UseGeoZoomOptions {
  readonly enabled: boolean;
  readonly min: number;
  readonly max: number;
  readonly initial: TransformMatrix;
  readonly hostRef: RefObject<HTMLDivElement | null>;
  readonly holder: ProjectionHolder;
  /** A wheel tick zoomed the map; receives the wheel event's client position (the pointer rests there). */
  readonly onWheelZoom?: (clientX: number, clientY: number) => void;
}

interface Spread {
  readonly distance: number;
  readonly mid: Point;
}

interface GeoZoomState {
  readonly transform: ZoomTransform;
  readonly instance: ChoroplethZoomInstance | null;
}

// CSS custom properties are not in CSSProperties; this widens it with the three the zoom writes.
type ZoomVars = CSSProperties & { readonly "--bkm-zk": number; readonly "--bkm-zx": string; readonly "--bkm-zy": string };

/** Host custom properties carrying the transform; CSS maps them onto the marks layer (no definition rebuild, no React work per frame). */
const zoomStyle = (m: Readonly<TransformMatrix>): ZoomVars => ({ "--bkm-zk": m.scaleX, "--bkm-zx": `${m.translateX}px`, "--bkm-zy": `${m.translateY}px` });

/** The DOM event behind a d3-zoom event (typed `any` upstream); null for programmatic transforms. */
type SourceEvent = Readonly<Pick<WheelEvent, "clientX" | "clientY" | "type" | "view">>;
const sourceOf = (event: D3ZoomEvent<HTMLDivElement, unknown>): SourceEvent | null | undefined =>
  // SAFETY: d3-zoom's sourceEvent is the pointer, mouse or wheel event that started the gesture, or null.
  erase(event.sourceEvent);

// A mouse event with no view (dispatched, or fired while the document tears down) would reach d3-drag's view.document and throw.
const mouseGesture = (event: Event): boolean => {
  if (event.type === "wheel") {
    return true;
  }
  return !(event instanceof MouseEvent) || (event.view !== null && !event.ctrlKey);
};

const applyTransform = (host: HTMLElement, holder: ProjectionHolder, t: ZoomTransform): void => {
  holder.transform = { k: t.k, x: t.x, y: t.y };
  writeVar(host, "--bkm-zk", String(t.k));
  writeVar(host, "--bkm-zx", `${t.x}px`);
  writeVar(host, "--bkm-zy", `${t.y}px`);
};

const useGeoZoom = ({ enabled, min, max, initial, hostRef, holder, onWheelZoom }: Readonly<UseGeoZoomOptions>): GeoZoomState => {
  const [transform, setTransform] = useState<ZoomTransform>(() => fromMatrix(initial));
  const [isDragging, setIsDragging] = useState(false);
  const behaviorRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const wheelRef = useRef(onWheelZoom);
  wheelRef.current = onWheelZoom;

  // oxlint-disable-next-line react-doctor/effect-needs-cleanup -- the cleanup below unbinds `.zoom` and the touch listeners
  useEffect(() => {
    const host = hostRef.current;
    if (!enabled || host === null) {return undefined;}
    let dragAnchorPending = false;
    // The window a mouse drag is running on: d3-zoom put its move/up and d3-drag's selection guards there.
    let gestureView: Window | null = null;
    let lastTransform: ZoomTransform = fromMatrix(initialRef.current);
    const selection = select(host);
    const setDragging = (on: boolean): void => {
      setIsDragging(on);
    };
    const isControl = (target: EventTarget | null): boolean => target instanceof Element && target.closest("button, a, input, select, textarea") !== null;
    // d3-zoom owns the mouse (drag, wheel); touch is handled below to follow bklit's use-gesture (pan with the first move as anchor, stepped pinch).
    const behavior = d3Zoom<HTMLDivElement, unknown>()
      .scaleExtent([min, max])
      .filter((event: Event) => !event.type.startsWith("touch") && !isControl(event.target) && mouseGesture(event))
      .wheelDelta((event: WheelEvent) => (event.deltaY > 0 ? WHEEL_OUT : WHEEL_IN))
      .on("start", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        const source = sourceOf(event);
        if (source?.type === "mousedown") {
          gestureView = source.view;
          setDragging(true);
          dragAnchorPending = true;
        }
      })
      .on("zoom", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        const source = sourceOf(event);
        // bklit's visx/use-gesture drag anchors on the first move event, so that first delta never pans: undo it once per drag.
        if (dragAnchorPending && source?.type === "mousemove") {
          dragAnchorPending = false;
          const {k} = event.transform;
          behavior.translateBy(selection, (lastTransform.x - event.transform.x) / k, (lastTransform.y - event.transform.y) / k);
          return;
        }
        lastTransform = event.transform;
        applyTransform(host, holder, event.transform);
        if (source?.type === "wheel") {
          wheelRef.current?.(source.clientX, source.clientY);
        }
        setTransform(event.transform);
      })
      .on("end", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
        if (sourceOf(event)?.type === "mouseup") {
          gestureView = null;
          setDragging(false);
        }
      });
    behaviorRef.current = behavior;
    selection.call(behavior);
    selection.on("dblclick.zoom", null);
    behavior.transform(selection, fromMatrix(initialRef.current));

    // Touch: one finger pans (first move anchors, like the mouse), two fingers pinch in fixed 1.1 / 0.9 steps about their midpoint.
    let panLast: Point | null = null;
    let pinchStart = 0;
    let pinchMoves = 0;
    let pinchFactor = PINCH_IN;
    const local = (touch: Touch): Point => {
      const box = host.getBoundingClientRect();
      return { x: touch.clientX - box.left, y: touch.clientY - box.top };
    };
    const spread = (touches: TouchList): Spread => {
      // Both touches exist: the handler is entered only with two touches.
      const a = local(touches[0]);
      const b = local(touches[1]);
      return { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };
    let pinchMid: Point = { x: 0, y: 0 };
    const pinchStep = (steps: number): void => {
      for (let i = 0; i < steps; i += 1) {
        const k = lastTransform.k * pinchFactor;
        if (k < min || k > max) {return;}
        behavior.scaleBy(selection, pinchFactor, [pinchMid.x, pinchMid.y]);
      }
    };
    const pinchTo = (touches: TouchList, steps: number): void => {
      const { distance, mid } = spread(touches);
      pinchFactor = distance < pinchStart ? PINCH_OUT : PINCH_IN;
      pinchMid = mid;
      pinchStep(steps);
    };
    const onTouchStart = (event: TouchEvent): void => {
      if (isControl(event.target)) {return;}
      if (event.touches.length === 1) {
        setDragging(true);
        dragAnchorPending = true;
        panLast = local(event.touches[0]);
        return;
      }
      if (event.touches.length === 2) {
        panLast = null;
        dragAnchorPending = false;
        setDragging(false);
        pinchStart = spread(event.touches).distance;
        pinchMoves = 0;
        pinchTo(event.touches, 1);
      }
    };
    const onTouchMove = (event: TouchEvent): void => {
      if (event.cancelable) {event.preventDefault();}
      if (event.touches.length === 2) {
        pinchMoves += 1;
        pinchTo(event.touches, pinchMoves === PINCH_DOUBLE_MOVE ? 2 : 1);
        return;
      }
      if (event.touches.length === 1 && panLast !== null) {
        const point = local(event.touches[0]);
        if (dragAnchorPending) {
          dragAnchorPending = false;
        } else {
          behavior.translateBy(selection, (point.x - panLast.x) / lastTransform.k, (point.y - panLast.y) / lastTransform.k);
        }
        panLast = point;
      }
    };
    const onTouchEnd = (event: TouchEvent): void => {
      if (event.touches.length < 2 && pinchStart > 0) {
        pinchStart = 0;
        pinchStep(1);
      }
      panLast = null;
      dragAnchorPending = false;
      setDragging(false);
    };
    host.addEventListener("touchstart", onTouchStart, { passive: true });
    host.addEventListener("touchmove", onTouchMove, { passive: false });
    host.addEventListener("touchend", onTouchEnd);
    host.addEventListener("touchcancel", onTouchEnd);
    return (): void => {
      selection.on(".zoom", null);
      // A drag still held at unmount would leave its window listeners behind; their mouseup would run against a dead chart.
      if (gestureView !== null) {select(gestureView).on("mousemove.zoom mouseup.zoom dragstart.drag selectstart.drag", null);}
      host.removeEventListener("touchstart", onTouchStart);
      host.removeEventListener("touchmove", onTouchMove);
      host.removeEventListener("touchend", onTouchEnd);
      host.removeEventListener("touchcancel", onTouchEnd);
      behaviorRef.current = null;
    };
  }, [enabled, min, max, hostRef, holder]);

  const instance = useMemo((): ChoroplethZoomInstance | null => {
    if (!enabled) {return null;}
    const run = (fn: (sel: ReturnType<typeof select<HTMLDivElement, unknown>>, b: ZoomBehavior<HTMLDivElement, unknown>) => void): void => {
      const host = hostRef.current;
      const behavior = behaviorRef.current;
      if (host !== null && behavior !== null) {fn(select(host), behavior);}
    };
    const setMatrix = (m: TransformMatrix): void => { run((sel, b) => { b.transform(sel, fromMatrix(m)); }); };
    return {
      applyInverseToPoint: ({ x, y }) => { const [ix, iy] = transform.invert([x, y]); return { x: ix, y: iy }; },
      applyToPoint: ({ x, y }) => { const [ax, ay] = transform.apply([x, y]); return { x: ax, y: ay }; },
      center: () => { setMatrix(identityMatrix()); },
      clear: () => { setMatrix(identityMatrix()); },
      initialTransformMatrix: initial,
      isDragging,
      reset: () => { setMatrix(initial); },
      scale: ({ scaleX, point }) => {
        run((sel, b) => { if (point) {b.scaleBy(sel, scaleX, [point.x, point.y]);} else {b.scaleBy(sel, scaleX);} });
      },
      setTransformMatrix: setMatrix,
      toString: () => `matrix(${transform.k}, 0, 0, ${transform.k}, ${transform.x}, ${transform.y})`,
      transformMatrix: toMatrix(transform),
      translate: ({ translateX, translateY }) => { run((sel, b) => { b.translateBy(sel, translateX / transform.k, translateY / transform.k); }); },
      translateTo: ({ x, y }) => { run((sel, b) => { b.translateTo(sel, x, y); }); },
    };
  }, [enabled, hostRef, initial, isDragging, transform]);

  return { instance, transform };
};

export { ChoroplethZoomContext, identityMatrix, useChoroplethZoom, useGeoZoom, zoomStyle };
export type { TransformMatrix };
