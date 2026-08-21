"use client";

import * as React from "react";
import { resolveNearestIndex } from "./bisect";

export interface ChartSelection {
  startX: number;
  endX: number;
  startIndex: number;
  endIndex: number;
  active: boolean;
}

export function useSegmentVisibility(selection: ChartSelection | null): boolean {
  return selection?.active === true && Math.abs(selection.endX - selection.startX) > 5;
}

export function useChartSelection(params: {
  enabled: boolean;
  innerWidth: number;
  marginLeft: number;
  data: Array<Record<string, unknown>>;
  xDataKey: string;
  xScale: { invert: (px: number) => Date } | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Called when a pointer drag is armed (pointerdown) — bklit parity:
   * use-chart-interaction.ts clears the tooltip on mousedown. */
  onDragStart?: () => void;
  /** Called when the drag disarms (pointerup / pointerleave / touchend). */
  onDragEnd?: () => void;
}): { selection: ChartSelection | null; clearSelection: () => void } {
  const { enabled, innerWidth, marginLeft, data, xDataKey, xScale, containerRef, onDragStart, onDragEnd } = params;
  const [selection, setSelection] = React.useState<ChartSelection | null>(null);
  const draggingRef = React.useRef(false);
  const dragStartXRef = React.useRef(0);
  const onDragStartRef = React.useRef(onDragStart);
  const onDragEndRef = React.useRef(onDragEnd);
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;

  const resolveIndexFromX = React.useCallback(
    (pixelX: number): number => {
      const s = xScale;
      if (!s || data.length === 0) return 0;
      const targetMs = s.invert(pixelX).getTime();
      const accessor = (d: Record<string, unknown>) => {
        const v = d[xDataKey];
        if (v instanceof Date) return v.getTime();
        if (typeof v === "number") return new Date(v).getTime();
        if (typeof v === "string") {
          const parsed = new Date(v as string);
          return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
        }
        return 0;
      };
      const idx = resolveNearestIndex(data as unknown as Array<Record<string, unknown>>, accessor as unknown as (d: Record<string, unknown>) => number, targetMs);
      if (idx < 0) return 0;
      return idx;
    },
    [xScale, data, xDataKey],
  );

  const getChartX = React.useCallback(
    (clientX: number): number | null => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return clientX - rect.left - marginLeft;
    },
    [containerRef, marginLeft],
  );

  React.useEffect(() => {
    if (!enabled || innerWidth <= 0) return;
    const el = containerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const chartX = getChartX(e.clientX);
      if (chartX === null) return;
      draggingRef.current = true;
      dragStartXRef.current = chartX;
      onDragStartRef.current?.();
      setSelection(null);
      (e.target as Element).setPointerCapture?.((e as unknown as { pointerId: number }).pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const chartX = getChartX(e.clientX);
      if (chartX === null) return;
      const sX = Math.min(dragStartXRef.current, chartX);
      const eX = Math.max(dragStartXRef.current, chartX);
      setSelection({
        startX: sX,
        endX: eX,
        startIndex: resolveIndexFromX(sX),
        endIndex: resolveIndexFromX(eX),
        active: true,
      });
    };

    const onPointerUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        onDragEndRef.current?.();
      }
      setSelection(null);
    };

    const onPointerLeave = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        onDragEndRef.current?.();
      }
      setSelection(null);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        onDragStartRef.current?.();
        const x0 = getChartX(e.touches[0]!.clientX);
        const x1 = getChartX(e.touches[1]!.clientX);
        if (x0 === null || x1 === null) return;
        const sX = Math.min(x0, x1);
        const eX = Math.max(x0, x1);
        setSelection({ startX: sX, endX: eX, startIndex: resolveIndexFromX(sX), endIndex: resolveIndexFromX(eX), active: true });
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const x0 = getChartX(e.touches[0]!.clientX);
        const x1 = getChartX(e.touches[1]!.clientX);
        if (x0 === null || x1 === null) return;
        const sX = Math.min(x0, x1);
        const eX = Math.max(x0, x1);
        setSelection({ startX: sX, endX: eX, startIndex: resolveIndexFromX(sX), endIndex: resolveIndexFromX(eX), active: true });
      }
    };
    const onTouchEnd = () => {
      onDragEndRef.current?.();
      setSelection(null);
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("touchstart", onTouchStart as EventListener, { passive: false });
    el.addEventListener("touchmove", onTouchMove as EventListener, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("touchstart", onTouchStart as EventListener);
      el.removeEventListener("touchmove", onTouchMove as EventListener);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, innerWidth, getChartX, resolveIndexFromX, containerRef]);

  const clearSelection = React.useCallback(() => setSelection(null), []);

  return { selection, clearSelection };
}

export const ChartSelectionContext = React.createContext<ChartSelection | null>(null);

export function useChartSelectionContext(): ChartSelection | null {
  return React.useContext(ChartSelectionContext);
}

export interface SegmentComponent {
  key: string;
  type: "segmentBackground" | "segmentLineFrom" | "segmentLineTo";
  props: Record<string, unknown>;
}

export function extractSegmentComponents(children: React.ReactNode): SegmentComponent[] {
  const out: SegmentComponent[] = [];
  const visit = (node: React.ReactNode) => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      const role = (child.type as unknown as Record<symbol, string | undefined>)[Symbol.for("migrated.chartRole")];
      if (role === "segmentBackground" || role === "segmentLineFrom" || role === "segmentLineTo") {
        out.push({ key: String(out.length), type: role as SegmentComponent["type"], props: child.props as Record<string, unknown> });
      } else {
        const cp = child.props as { children?: React.ReactNode } | undefined;
        if (cp?.children) visit(cp.children);
      }
    }
  };
  visit(children);
  return out;
}
