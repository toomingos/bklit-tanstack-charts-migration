"use client";

// Choropleth pan/zoom: zoomX is x-scale-only (docs: interactions-and-selections "Zoom and pan") and geo marks have no x/y scales,
// so this small gesture layer (mouse drag, wheel, touch) drives the *projection* and geoShape repaints natively.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import type { ProjectionHolder } from "./focus";
import { writeVar } from "../kit/host-write";

/** Zoom and pan state of the map, in the shape of a 2D affine matrix. */
interface TransformMatrix {
  /** Horizontal scale; the zoom level. */
  readonly scaleX: number;
  /** Vertical scale; keep it equal to `scaleX`. */
  readonly scaleY: number;
  /** Horizontal pan in pixels. */
  readonly translateX: number;
  /** Vertical pan in pixels. */
  readonly translateY: number;
  /** Horizontal skew; unused, keep at 0. */
  readonly skewX: number;
  /** Vertical skew; unused, keep at 0. */
  readonly skewY: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const identityMatrix = (): TransformMatrix => ({ scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, translateX: 0, translateY: 0 });

/** Screen = scene * k + (x, y). */
interface ZoomTransform {
  readonly k: number;
  readonly x: number;
  readonly y: number;
}

const toMatrix = (t: ZoomTransform): TransformMatrix => ({
  scaleX: t.k, scaleY: t.k, skewX: 0, skewY: 0, translateX: t.x, translateY: t.y,
});

const fromMatrix = (m: Readonly<TransformMatrix>): ZoomTransform => ({ k: m.scaleX, x: m.translateX, y: m.translateY });

const invertPoint = (t: ZoomTransform, p: Point): Point => ({ x: (p.x - t.x) / t.k, y: (p.y - t.y) / t.k });

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
/** Returns the zoom controls (`{ zoom }`, with `scale`, `reset`, `translate` and the current `transformMatrix`) for building custom zoom buttons. `zoom` is `null` unless `zoomEnabled` is set on the chart. */
const useChoroplethZoom = (): ChoroplethZoomContextValue => useContext(ChoroplethZoomContext);

// bklit wheel step: 5% per tick.
const WHEEL_IN = 1.05;
const WHEEL_OUT = 0.95;
// A wheel gesture stays active this long after its last tick (d3-zoom/src/zoom.js:68, the engine the migration used before): ticks inside it are always swallowed.
const WHEEL_IDLE_MS = 150;
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

const swallow = (event: Event): void => {
  event.preventDefault();
  event.stopImmediatePropagation();
};

const applyTransform = (host: HTMLElement, holder: ProjectionHolder, t: ZoomTransform): void => {
  holder.transform = { k: t.k, x: t.x, y: t.y };
  writeVar(host, "--bkm-zk", String(t.k));
  writeVar(host, "--bkm-zx", `${t.x}px`);
  writeVar(host, "--bkm-zy", `${t.y}px`);
};

/** Programmatic transform ops of the bound gesture layer; deltas and points are in scene units, like d3-zoom's scaleBy / translateBy / translateTo. */
interface ZoomControl {
  readonly set: (t: ZoomTransform) => void;
  readonly scaleBy: (factor: number, point?: Point) => void;
  readonly translateBy: (dx: number, dy: number) => void;
  readonly translateTo: (point: Point) => void;
}

const useGeoZoom = ({ enabled, min, max, initial, hostRef, holder, onWheelZoom }: Readonly<UseGeoZoomOptions>): GeoZoomState => {
  const [transform, setTransform] = useState<ZoomTransform>(() => fromMatrix(initial));
  const [isDragging, setIsDragging] = useState(false);
  const controlRef = useRef<ZoomControl | null>(null);
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const wheelRef = useRef(onWheelZoom);
  wheelRef.current = onWheelZoom;

  // oxlint-disable-next-line react-doctor/effect-needs-cleanup -- the cleanup below unbinds every listener and timer
  useEffect(() => {
    const host = hostRef.current;
    if (!enabled || host === null) {return undefined;}
    let dragAnchorPending = false;
    let current: ZoomTransform = fromMatrix(initialRef.current);
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    let releaseDrag: (() => void) | null = null;
    const commit = (t: ZoomTransform, afterApply?: () => void): void => {
      current = t;
      applyTransform(host, holder, t);
      afterApply?.();
      setTransform(t);
    };
    const clampK = (k: number): number => Math.max(min, Math.min(max, k));
    const scaleAbout = (t: ZoomTransform, k: number, p: Point): ZoomTransform => {
      const anchor = invertPoint(t, p);
      return { k, x: p.x - anchor.x * k, y: p.y - anchor.y * k };
    };
    const local = (clientX: number, clientY: number): Point => {
      const box = host.getBoundingClientRect();
      return { x: clientX - box.left - host.clientLeft, y: clientY - box.top - host.clientTop };
    };
    const centre = (): Point => ({ x: host.clientWidth / 2, y: host.clientHeight / 2 });
    const isControl = (target: EventTarget | null): boolean => target instanceof Element && target.closest("button, a, input, select, textarea") !== null;

    // Mouse: wheel zooms about the pointer, a drag pans (touch is handled below, following bklit's use-gesture).
    const onWheel = (event: WheelEvent): void => {
      if (isControl(event.target)) {return;}
      const k = clampK(current.k * (event.deltaY > 0 ? WHEEL_OUT : WHEEL_IN));
      if (wheelTimer === undefined && k === current.k) {return;}
      swallow(event);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelTimer = undefined; }, WHEEL_IDLE_MS);
      commit(scaleAbout(current, k, local(event.clientX, event.clientY)), () => { wheelRef.current?.(event.clientX, event.clientY); });
    };
    const onMouseDown = (event: MouseEvent): void => {
      // A mouse event with no view (dispatched, or fired while the document tears down) has no window to track the drag on.
      const view = event.view;
      if (view === null || event.ctrlKey || isControl(event.target)) {return;}
      event.stopImmediatePropagation();
      releaseDrag?.();
      const anchor = invertPoint(current, local(event.clientX, event.clientY));
      let moved = false;
      const onMove = (move: MouseEvent): void => {
        swallow(move);
        moved ||= move.clientX !== event.clientX || move.clientY !== event.clientY;
        // bklit's visx/use-gesture drag anchors on the first move event, so that first delta never pans.
        if (dragAnchorPending) {
          dragAnchorPending = false;
          return;
        }
        const p = local(move.clientX, move.clientY);
        commit({ k: current.k, x: p.x - anchor.x * current.k, y: p.y - anchor.y * current.k });
      };
      const onUp = (up: MouseEvent): void => {
        release();
        swallow(up);
        if (moved) {
          // The click that ends a drag must not reach the map; the capture guard lasts one task (d3-drag/src/nodrag.js:20).
          view.addEventListener("click", swallow, { capture: true });
          setTimeout(() => { view.removeEventListener("click", swallow, { capture: true }); }, 0);
        }
        setIsDragging(false);
      };
      const release = (): void => {
        view.removeEventListener("mousemove", onMove, { capture: true });
        view.removeEventListener("mouseup", onUp, { capture: true });
        view.removeEventListener("dragstart", swallow, { capture: true });
        view.removeEventListener("selectstart", swallow, { capture: true });
        releaseDrag = null;
      };
      releaseDrag = release;
      view.addEventListener("mousemove", onMove, { capture: true });
      view.addEventListener("mouseup", onUp, { capture: true });
      view.addEventListener("dragstart", swallow, { capture: true });
      view.addEventListener("selectstart", swallow, { capture: true });
      setIsDragging(true);
      dragAnchorPending = true;
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    host.addEventListener("mousedown", onMouseDown);
    const control: ZoomControl = {
      scaleBy: (factor, point = centre()) => { commit(scaleAbout(current, clampK(current.k * factor), point)); },
      set: (t) => { commit(t); },
      translateBy: (dx, dy) => { commit({ k: current.k, x: current.x + current.k * dx, y: current.y + current.k * dy }); },
      translateTo: ({ x, y }) => { const c = centre(); commit({ k: current.k, x: c.x - x * current.k, y: c.y - y * current.k }); },
    };
    controlRef.current = control;
    control.set(fromMatrix(initialRef.current));

    // Touch: one finger pans (first move anchors, like the mouse), two fingers pinch in fixed 1.1 / 0.9 steps about their midpoint.
    let panLast: Point | null = null;
    let pinchStart = 0;
    let pinchMoves = 0;
    let pinchFactor = PINCH_IN;
    const touchPoint = (touch: Touch): Point => {
      const box = host.getBoundingClientRect();
      return { x: touch.clientX - box.left, y: touch.clientY - box.top };
    };
    const spread = (touches: TouchList): Spread => {
      // Both touches exist: the handler is entered only with two touches.
      const a = touchPoint(touches[0]);
      const b = touchPoint(touches[1]);
      return { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };
    let pinchMid: Point = { x: 0, y: 0 };
    const pinchStep = (steps: number): void => {
      for (let i = 0; i < steps; i += 1) {
        const k = current.k * pinchFactor;
        if (k < min || k > max) {return;}
        control.scaleBy(pinchFactor, pinchMid);
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
        setIsDragging(true);
        dragAnchorPending = true;
        panLast = touchPoint(event.touches[0]);
        return;
      }
      if (event.touches.length === 2) {
        panLast = null;
        dragAnchorPending = false;
        setIsDragging(false);
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
        const point = touchPoint(event.touches[0]);
        if (dragAnchorPending) {
          dragAnchorPending = false;
        } else {
          control.translateBy((point.x - panLast.x) / current.k, (point.y - panLast.y) / current.k);
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
      setIsDragging(false);
    };
    host.addEventListener("touchstart", onTouchStart, { passive: true });
    host.addEventListener("touchmove", onTouchMove, { passive: false });
    host.addEventListener("touchend", onTouchEnd);
    host.addEventListener("touchcancel", onTouchEnd);
    return (): void => {
      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("mousedown", onMouseDown);
      clearTimeout(wheelTimer);
      // A drag still held at unmount would leave its window listeners behind; their mouseup would run against a dead chart.
      releaseDrag?.();
      host.removeEventListener("touchstart", onTouchStart);
      host.removeEventListener("touchmove", onTouchMove);
      host.removeEventListener("touchend", onTouchEnd);
      host.removeEventListener("touchcancel", onTouchEnd);
      controlRef.current = null;
    };
  }, [enabled, min, max, hostRef, holder]);

  const instance = useMemo((): ChoroplethZoomInstance | null => {
    if (!enabled) {return null;}
    const run = (fn: (control: ZoomControl) => void): void => {
      if (controlRef.current !== null) {fn(controlRef.current);}
    };
    const setMatrix = (m: TransformMatrix): void => { run((c) => { c.set(fromMatrix(m)); }); };
    return {
      applyInverseToPoint: (p) => invertPoint(transform, p),
      applyToPoint: ({ x, y }) => ({ x: x * transform.k + transform.x, y: y * transform.k + transform.y }),
      center: () => { setMatrix(identityMatrix()); },
      clear: () => { setMatrix(identityMatrix()); },
      initialTransformMatrix: initial,
      isDragging,
      reset: () => { setMatrix(initial); },
      scale: ({ scaleX, point }) => { run((c) => { c.scaleBy(scaleX, point); }); },
      setTransformMatrix: setMatrix,
      toString: () => `matrix(${transform.k}, 0, 0, ${transform.k}, ${transform.x}, ${transform.y})`,
      transformMatrix: toMatrix(transform),
      translate: ({ translateX, translateY }) => { run((c) => { c.translateBy(translateX / transform.k, translateY / transform.k); }); },
      translateTo: (p) => { run((c) => { c.translateTo(p); }); },
    };
  }, [enabled, initial, isDragging, transform]);

  return { instance, transform };
};

export { ChoroplethZoomContext, identityMatrix, useChoroplethZoom, useGeoZoom, zoomStyle };
export type { TransformMatrix };
