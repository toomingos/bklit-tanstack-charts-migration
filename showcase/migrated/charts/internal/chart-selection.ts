"use client";

import * as React from "react";
import { resolveNearestIndex } from "./bisect";
import { CHART_ROLE } from "../children";

export interface ChartSelection {
  startX: number;
  endX: number;
  startIndex: number;
  endIndex: number;
  active: boolean;
}

export function useChartSelection(params: {
  enabled: boolean;
  innerWidth: number;
  marginLeft: number;
  data: Array<Record<string, unknown>>;
  xDataKey: string;
  /**
   * Margin-inclusive scene-space pointer resolver — wraps
   * `context.interaction.clientToScene(clientX, clientY)` captured by the
   * host chart's `handleRender`. Returns null before the host has rendered.
   */
  resolveScenePos: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /**
   * Inverts a scene-space x position back to a domain value — wraps
   * `context.scene.scales.x.invert(sceneX)` captured by the host chart's
   * `handleRender`. Replaces the old duplicated plot-local d3 scale.
   */
  invertSceneX: (sceneX: number) => unknown;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Called when a pointer drag is armed (pointerdown) — bklit parity:
   * use-chart-interaction.ts clears the tooltip on mousedown. */
  onDragStart?: () => void;
  /** Called when the drag disarms (pointerup / pointerleave / touchend). */
  onDragEnd?: () => void;
}): { selection: ChartSelection | null; clearSelection: () => void } {
  const { enabled, innerWidth, marginLeft, data, xDataKey, resolveScenePos, invertSceneX, containerRef, onDragStart, onDragEnd } = params;
  const [selection, setSelection] = React.useState<ChartSelection | null>(null);
  const draggingRef = React.useRef(false);
  const dragStartSceneXRef = React.useRef(0);
  const onDragStartRef = React.useRef(onDragStart);
  const onDragEndRef = React.useRef(onDragEnd);
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;

  const resolveIndexFromScene = React.useCallback(
    (sceneX: number): number => {
      if (data.length === 0) return 0;
      const inverted = invertSceneX(sceneX);
      const targetMs =
        inverted instanceof Date
          ? inverted.getTime()
          : typeof inverted === "number"
            ? inverted
            : (() => {
                const parsed = new Date(String(inverted));
                return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
              })();
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
    [invertSceneX, data, xDataKey],
  );

  React.useEffect(() => {
    if (!enabled || innerWidth <= 0) return;
    const el = containerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const pos = resolveScenePos(e.clientX, e.clientY);
      if (!pos) return;
      draggingRef.current = true;
      dragStartSceneXRef.current = pos.x;
      onDragStartRef.current?.();
      setSelection(null);
      (e.target as Element).setPointerCapture?.((e as unknown as { pointerId: number }).pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const pos = resolveScenePos(e.clientX, e.clientY);
      if (!pos) return;
      const sScene = Math.min(dragStartSceneXRef.current, pos.x);
      const eScene = Math.max(dragStartSceneXRef.current, pos.x);
      setSelection({
        startX: sScene - marginLeft,
        endX: eScene - marginLeft,
        startIndex: resolveIndexFromScene(sScene),
        endIndex: resolveIndexFromScene(eScene),
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
        const p0 = resolveScenePos(e.touches[0]!.clientX, e.touches[0]!.clientY);
        const p1 = resolveScenePos(e.touches[1]!.clientX, e.touches[1]!.clientY);
        if (!p0 || !p1) return;
        const sScene = Math.min(p0.x, p1.x);
        const eScene = Math.max(p0.x, p1.x);
        setSelection({
          startX: sScene - marginLeft,
          endX: eScene - marginLeft,
          startIndex: resolveIndexFromScene(sScene),
          endIndex: resolveIndexFromScene(eScene),
          active: true,
        });
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const p0 = resolveScenePos(e.touches[0]!.clientX, e.touches[0]!.clientY);
        const p1 = resolveScenePos(e.touches[1]!.clientX, e.touches[1]!.clientY);
        if (!p0 || !p1) return;
        const sScene = Math.min(p0.x, p1.x);
        const eScene = Math.max(p0.x, p1.x);
        setSelection({
          startX: sScene - marginLeft,
          endX: eScene - marginLeft,
          startIndex: resolveIndexFromScene(sScene),
          endIndex: resolveIndexFromScene(eScene),
          active: true,
        });
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
  }, [enabled, innerWidth, marginLeft, resolveScenePos, resolveIndexFromScene, containerRef]);

  const clearSelection = React.useCallback(() => setSelection(null), []);

  return { selection, clearSelection };
}

export const ChartSelectionContext = React.createContext<ChartSelection | null>(null);

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
      const role = (child.type as unknown as Record<symbol, string | undefined>)[CHART_ROLE];
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
