"use client";

import { Children, Fragment, createContext, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import type { ChartValue } from "@tanstack/charts";
import { resolveNearestIndex } from "./bisect";
import { createSelectionHandlers, subscribeSelectionListeners } from "./chart-selection-events";
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

interface DragCallbacks {
  readonly onDragEnd?: () => void;
  readonly onDragStart?: () => void;
}

interface UseChartSelectionParams {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly data: ChartDatum[];
  readonly enabled: boolean;
  readonly innerWidth: number;
  readonly invertSceneX: (sceneX: number) => Readonly<ChartValue> | undefined;
  readonly marginLeft: number;
  readonly onDragEnd?: () => void;
  readonly onDragStart?: () => void;
  readonly resolveScenePos: (clientX: number, clientY: number) => { x: number; y: number } | null;
  readonly xDataKey: string;
}

interface SyncedCallbacksParams {
  readonly onDragEnd?: () => void;
  readonly onDragStart?: () => void;
}

// Resolves a datum's x value to epoch milliseconds for nearest-index lookup.
const datumTimeMs = (datum: Readonly<ChartDatum>, xDataKey: string): number => {
  const rawValue: unknown = datum[xDataKey];
  if (rawValue instanceof Date) {return rawValue.getTime();}
  if (isNumber(rawValue)) {return new Date(rawValue).getTime();}
  if (isString(rawValue)) {
    const parsed = new Date(rawValue);
    return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
  }
  return 0;
};

// Owns the mutable drag refs so the selection hook body stays small.
const useSelectionDragRefs = (): SelectionDragRefs => {
  const draggingRef = useRef(false);
  const dragStartSceneXRef = useRef(0);
  return { dragStartSceneXRef, draggingRef };
};

// Mirrors the latest drag callbacks into state during render so handlers read fresh values.
const useSyncedDragCallbacks = (params: Readonly<SyncedCallbacksParams>): DragCallbacks => {
  const { onDragEnd, onDragStart } = params;
  const [dragCallbacks, setDragCallbacks] = useState(() => ({ onDragEnd, onDragStart }));
  const [prevDragCallbacks, setPrevDragCallbacks] = useState({ onDragEnd, onDragStart });
  if (prevDragCallbacks.onDragStart !== onDragStart || prevDragCallbacks.onDragEnd !== onDragEnd) {
    setPrevDragCallbacks({ onDragEnd, onDragStart });
    setDragCallbacks({ onDragEnd, onDragStart });
  }
  return dragCallbacks;
};

interface SelectionDragRefs {
  readonly dragStartSceneXRef: RefObject<number>;
  readonly draggingRef: RefObject<boolean>;
}

const useChartSelection = (params: Readonly<UseChartSelectionParams>): ChartSelectionResult => {
  const { containerRef, data, enabled, innerWidth, invertSceneX, marginLeft, onDragEnd, onDragStart, resolveScenePos, xDataKey } = params;
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const { dragStartSceneXRef, draggingRef } = useSelectionDragRefs();
  const dragCallbacks = useSyncedDragCallbacks({ onDragEnd, onDragStart });
  const resolveIndexFromScene = useCallback(
    (sceneX: number): number => {
      if (data.length === 0) {return 0;}
      const targetMs = toTimeMs(invertSceneX(sceneX));
      const resolvedIndex = resolveNearestIndex(data, (datum: Readonly<ChartDatum>): number => datumTimeMs(datum, xDataKey), targetMs);
      if (resolvedIndex < 0) {return 0;}
      return resolvedIndex;
    },
    [invertSceneX, data, xDataKey],
  );

  useEffect((): (() => void) | undefined => {
    if (!enabled || innerWidth <= 0) {return undefined;}
    const chartElement = containerRef.current;
    if (!chartElement) {return undefined;}
    const handlers = createSelectionHandlers({ dragCallbacks, dragStartSceneXRef, draggingRef, marginLeft, resolveIndexFromScene, resolveScenePos, setSelection });
    return subscribeSelectionListeners(chartElement, handlers);
  }, [enabled, innerWidth, marginLeft, resolveScenePos, resolveIndexFromScene, containerRef, dragCallbacks, draggingRef, dragStartSceneXRef]);

  const clearSelection = useCallback(() =>{  setSelection(null); }, []);

  return { clearSelection, selection };
}

const ChartSelectionContext = createContext<ChartSelection | null>(null);

interface SegmentComponent {
  key: string;
  type: "segmentBackground" | "segmentLineFrom" | "segmentLineTo";
  props: ChartDatum;
}

interface SegmentChildVisit {
  readonly child: ReactNode;
  readonly out: SegmentComponent[];
  readonly visit: (node: ReactNode) => void;
}

interface SegmentElementVisit {
  readonly child: ReactElement<{ children?: ReactNode } & ChartDatum>;
  readonly out: SegmentComponent[];
  readonly visit: (node: ReactNode) => void;
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
  if (!isValidElement<{ children?: ReactNode } & ChartDatum>(child)) {return;}
  if (child.type === Fragment) {
    visit(child.props.children);
  } else {
    collectSegmentElement({ child, out, visit });
  }
};

const extractSegmentComponents = (children: ReactNode): SegmentComponent[] => {
  const out: SegmentComponent[] = [];
  const visit = (node: ReactNode): void => {
    for (const child of Children.toArray(node)) {
      collectSegmentChild({ child, out, visit });
    }
  };
  visit(children);
  return out;
}

export { useChartSelection, ChartSelectionContext, extractSegmentComponents };
export type { ChartSelection, DragCallbacks, SegmentComponent };
