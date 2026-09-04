"use client";

import * as React from "react";
import type { ChartValue } from "@tanstack/charts";
import { resolveNearestIndex } from "./bisect";
import { roleOf } from "./children-extract";
import type { ChartDatum } from "./types";

interface ChartSelection {
  startX: number;
  endX: number;
  startIndex: number;
  endIndex: number;
  active: boolean;
}

interface ChartSelectionResult {
  selection: ChartSelection | null;
  clearSelection: () => void;
}

const isNumber = <Subject>(value: Subject): value is Subject & number => typeof value === "number";
const isString = <Subject>(value: Subject): value is Subject & string => typeof value === "string";

const toTimeMs = (inverted: Readonly<ChartValue> | undefined): number => {
  if (inverted instanceof Date) {return inverted.getTime();}
  if (isNumber(inverted)) {return inverted;}
  if (inverted === undefined) {return 0;}
  const parsed = new Date(inverted);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
};

const useChartSelection = (params: {
  enabled: boolean;
  innerWidth: number;
  marginLeft: number;
  data: ChartDatum[];
  xDataKey: string;
  resolveScenePos: (clientX: number, clientY: number) => { x: number; y: number } | null;
  invertSceneX: (sceneX: number) => Readonly<ChartValue> | undefined;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}): ChartSelectionResult => {
  const { enabled, innerWidth, marginLeft, data, xDataKey, resolveScenePos, invertSceneX, containerRef, onDragStart, onDragEnd } = params;
  const [selection, setSelection] = React.useState<ChartSelection | null>(null);
  const draggingRef = React.useRef(false);
  const dragStartSceneXRef = React.useRef(0);
  const [dragCallbacks, setDragCallbacks] = React.useState(() => ({ onDragEnd, onDragStart }));
  const [prevDragCallbacks, setPrevDragCallbacks] = React.useState({ onDragEnd, onDragStart });
  if (prevDragCallbacks.onDragStart !== onDragStart || prevDragCallbacks.onDragEnd !== onDragEnd) {
    setPrevDragCallbacks({ onDragEnd, onDragStart });
    setDragCallbacks({ onDragEnd, onDragStart });
  }

  const resolveIndexFromScene = React.useCallback(
    (sceneX: number): number => {
      if (data.length === 0) {return 0;}
      const inverted = invertSceneX(sceneX);
      const targetMs = toTimeMs(inverted);
      const accessor = (datum: Readonly<ChartDatum>): number => {
        const rawValue: unknown = datum[xDataKey];
        if (rawValue instanceof Date) {return rawValue.getTime();}
        if (isNumber(rawValue)) {return new Date(rawValue).getTime();}
        if (isString(rawValue)) {
          const parsed = new Date(rawValue);
          return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
        }
        return 0;
      };
      const idx = resolveNearestIndex(data, accessor, targetMs);
      if (idx < 0) {return 0;}
      return idx;
    },
    [invertSceneX, data, xDataKey],
  );

  React.useEffect((): (() => void) | undefined => {
    if (!enabled || innerWidth <= 0) {return undefined;}
    const el = containerRef.current;
    if (!el) {return undefined;}

    const onPointerDown = (pointerEvent: PointerEvent): void => {
      if (pointerEvent.button !== 0) {return;}
      const pos = resolveScenePos(pointerEvent.clientX, pointerEvent.clientY);
      if (!pos) {return;}
      draggingRef.current = true;
      dragStartSceneXRef.current = pos.x;
      dragCallbacks.onDragStart?.();
      setSelection(null);
      const captureTarget = pointerEvent.target;
      if (captureTarget instanceof Element) {
        captureTarget.setPointerCapture(pointerEvent.pointerId);
      }
    };

    const onPointerMove = (pointerEvent: PointerEvent): void => {
      if (!draggingRef.current) {return;}
      const pos = resolveScenePos(pointerEvent.clientX, pointerEvent.clientY);
      if (!pos) {return;}
      const sScene = Math.min(dragStartSceneXRef.current, pos.x);
      const eScene = Math.max(dragStartSceneXRef.current, pos.x);
      setSelection({
        active: true,
        endIndex: resolveIndexFromScene(eScene),
        endX: eScene - marginLeft,
        startIndex: resolveIndexFromScene(sScene),
        startX: sScene - marginLeft,
      });
    };

    const onPointerUp = (): void => {
      if (draggingRef.current) {
        draggingRef.current = false;
        dragCallbacks.onDragEnd?.();
      }
      setSelection(null);
    };

    const onPointerLeave = onPointerUp;

    const onTouchStart = (touchEvent: TouchEvent): void => {
      if (touchEvent.touches.length === 2) {
        touchEvent.preventDefault();
        dragCallbacks.onDragStart?.();
        const p0 = resolveScenePos(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
        const p1 = resolveScenePos(touchEvent.touches[1].clientX, touchEvent.touches[1].clientY);
        if (!p0 || !p1) {return;}
        const sScene = Math.min(p0.x, p1.x);
        const eScene = Math.max(p0.x, p1.x);
        setSelection({
          active: true,
          endIndex: resolveIndexFromScene(eScene),
          endX: eScene - marginLeft,
          startIndex: resolveIndexFromScene(sScene),
          startX: sScene - marginLeft,
        });
      }
    };
    const onTouchMove = (touchEvent: TouchEvent): void => {
      if (touchEvent.touches.length === 2) {
        touchEvent.preventDefault();
        const p0 = resolveScenePos(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
        const p1 = resolveScenePos(touchEvent.touches[1].clientX, touchEvent.touches[1].clientY);
        if (!p0 || !p1) {return;}
        const sScene = Math.min(p0.x, p1.x);
        const eScene = Math.max(p0.x, p1.x);
        setSelection({
          active: true,
          endIndex: resolveIndexFromScene(eScene),
          endX: eScene - marginLeft,
          startIndex: resolveIndexFromScene(sScene),
          startX: sScene - marginLeft,
        });
      }
    };
    const onTouchEnd = (): void => {
      dragCallbacks.onDragEnd?.();
      setSelection(null);
    };
    const dispatchTouchStart = (event: Event): void => {
      if (event instanceof TouchEvent) {onTouchStart(event);}
    };
    const dispatchTouchMove = (event: Event): void => {
      if (event instanceof TouchEvent) {onTouchMove(event);}
    };

    el.addEventListener("pointerdown", onPointerDown);
    globalThis.addEventListener("pointermove", onPointerMove);
    globalThis.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("touchstart", dispatchTouchStart, { passive: false });
    el.addEventListener("touchmove", dispatchTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return (): void => {
      el.removeEventListener("pointerdown", onPointerDown);
      globalThis.removeEventListener("pointermove", onPointerMove);
      globalThis.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("touchstart", dispatchTouchStart);
      el.removeEventListener("touchmove", dispatchTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, innerWidth, marginLeft, resolveScenePos, resolveIndexFromScene, containerRef, dragCallbacks]);

  const clearSelection = React.useCallback(() =>{  setSelection(null); }, []);

  return { clearSelection, selection };
}

const ChartSelectionContext = React.createContext<ChartSelection | null>(null);

interface SegmentComponent {
  key: string;
  type: "segmentBackground" | "segmentLineFrom" | "segmentLineTo";
  props: ChartDatum;
}

interface SegmentChildVisit {
  readonly child: React.ReactNode;
  readonly out: SegmentComponent[];
  readonly visit: (node: React.ReactNode) => void;
}

interface SegmentElementVisit {
  readonly child: React.ReactElement<{ children?: React.ReactNode } & ChartDatum>;
  readonly out: SegmentComponent[];
  readonly visit: (node: React.ReactNode) => void;
}

// Non-fragment element step: role-bearing children collect, others recurse into their children.
const collectSegmentElement = (params: Readonly<SegmentElementVisit>): void => {
  const { child, out, visit } = params;
  const role = roleOf(child.type);
  if (role === "segmentBackground" || role === "segmentLineFrom" || role === "segmentLineTo") {
    out.push({ key: String(out.length), props: child.props, type: role });
  } else {
    const nestedChildren = child.props.children;
    if (nestedChildren !== undefined && nestedChildren !== null) {visit(nestedChildren);}
  }
};

// One step of the segment-component walk: fragments recurse, elements collect.
const collectSegmentChild = (params: Readonly<SegmentChildVisit>): void => {
  const { child, out, visit } = params;
  if (!React.isValidElement<{ children?: React.ReactNode } & ChartDatum>(child)) {return;}
  if (child.type === React.Fragment) {
    visit(child.props.children);
  } else {
    collectSegmentElement({ child, out, visit });
  }
};

const extractSegmentComponents = (children: React.ReactNode): SegmentComponent[] => {
  const out: SegmentComponent[] = [];
  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      collectSegmentChild({ child, out, visit });
    }
  };
  visit(children);
  return out;
}

export { useChartSelection, ChartSelectionContext, extractSegmentComponents };
export type { ChartSelection, SegmentComponent };
