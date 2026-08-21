"use client";

import * as React from "react";
import type { BrushSelection } from "./brush-selection";

export interface BrushHost {
  containerRef: React.RefObject<HTMLElement | null>;
  margin: { top: number; right: number; bottom: number; left: number };
  trackExtent: [Date, Date];
}

export const BrushHostContext = React.createContext<BrushHost | null>(null);

export type BrushDragState =
  | "idle"
  | "creating"
  | "dragging-handle-left"
  | "dragging-handle-right"
  | "dragging-body";

export interface UseBrushDragOptions {
  initialSelection?: BrushSelection | null;
  onSelectionChange?: (selection: BrushSelection | null) => void;
}

export interface UseBrushDragResult {
  extent: { x0: number; x1: number } | null;
  state: BrushDragState;
  innerWidth: number;
  innerHeight: number;
}

function pixelExtentToSelection(
  x0: number,
  x1: number,
  trackExtent: [Date, Date],
  innerWidth: number,
): BrushSelection | null {
  if (x0 === x1) return null;
  if (innerWidth <= 0) return null;
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  if (a === b) return null;
  const startMs = trackExtent[0].getTime();
  const endMs = trackExtent[1].getTime();
  const span = endMs - startMs;
  if (span === 0) return null;
  const t0 = a / innerWidth;
  const t1 = b / innerWidth;
  const ms0 = startMs + t0 * span;
  const ms1 = startMs + t1 * span;
  const s = Math.min(ms0, ms1);
  const e = Math.max(ms0, ms1);
  if (s === e) return null;
  return { start: new Date(s), end: new Date(e) };
}

function selectionToPixelExtent(
  selection: BrushSelection,
  trackExtent: [Date, Date],
  innerWidth: number,
): { x0: number; x1: number } | null {
  if (innerWidth <= 0) return null;
  const startMs = trackExtent[0].getTime();
  const endMs = trackExtent[1].getTime();
  const span = endMs - startMs;
  if (span === 0) return null;
  const sMs = selection.start.getTime();
  const eMs = selection.end.getTime();
  const x0Raw = ((sMs - startMs) / span) * innerWidth;
  const x1Raw = ((eMs - startMs) / span) * innerWidth;
  const x0 = Math.max(0, Math.min(innerWidth, x0Raw));
  const x1 = Math.max(0, Math.min(innerWidth, x1Raw));
  const nx0 = Math.min(x0, x1);
  const nx1 = Math.max(x0, x1);
  return { x0: nx0, x1: nx1 };
}

export function useBrushDrag(
  host: BrushHost,
  opts: UseBrushDragOptions,
): UseBrushDragResult {
  const { initialSelection, onSelectionChange } = opts;

  const [innerDims, setInnerDims] = React.useState({ width: 0, height: 0 });
  const innerWidth = innerDims.width;
  const innerHeight = innerDims.height;

  const [extent, setExtent] = React.useState<{ x0: number; x1: number } | null>(null);
  const [state, setState] = React.useState<BrushDragState>("idle");

  const extentRef = React.useRef<{ x0: number; x1: number } | null>(null);
  const stateRef = React.useRef<BrushDragState>("idle");
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  const trackExtentRef = React.useRef(host.trackExtent);
  const innerWidthRef = React.useRef(0);
  const innerHeightRef = React.useRef(0);

  extentRef.current = extent;
  stateRef.current = state;
  onSelectionChangeRef.current = onSelectionChange;
  trackExtentRef.current = host.trackExtent;
  innerWidthRef.current = innerWidth;
  innerHeightRef.current = innerHeight;

  React.useEffect(() => {
    const el = host.containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(0, rect.width - host.margin.left - host.margin.right);
      const h = Math.max(0, rect.height - host.margin.top - host.margin.bottom);
      setInnerDims((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [host.containerRef, host.margin.left, host.margin.right, host.margin.top, host.margin.bottom]);

  const draggingRef = React.useRef(false);
  const dragInfoRef = React.useRef<{
    mode: BrushDragState;
    anchorX?: number;
    grabOffset?: number;
    width?: number;
    fixedLeft?: number;
    fixedRight?: number;
  } | null>(null);

  React.useEffect(() => {
    if (innerWidth <= 0) return;
    if (stateRef.current !== "idle") return;
    if (initialSelection) {
      const px = selectionToPixelExtent(initialSelection, host.trackExtent, innerWidth);
      if (!px) {
        setExtent(null);
        return;
      }
      if (px.x0 === px.x1) {
        setExtent(null);
        return;
      }
      setExtent((prev) => (prev && prev.x0 === px.x0 && prev.x1 === px.x1 ? prev : px));
    } else {
      const full = innerWidth > 0 ? { x0: 0, x1: innerWidth } : null;
      setExtent((prev) => {
        if (!full && !prev) return prev;
        if (full && prev && prev.x0 === full.x0 && prev.x1 === full.x1) return prev;
        return full;
      });
    }
  }, [
    initialSelection,
    host.trackExtent,
    innerWidth,
  ]);

  React.useEffect(() => {
    const el = host.containerRef.current;
    if (!el || innerWidth <= 0) return;

    const HANDLE_HIT_PX = 8;

    const getPlotX = (clientX: number): number => {
      const rect = el.getBoundingClientRect();
      const raw = clientX - rect.left - host.margin.left;
      return Math.max(0, Math.min(innerWidthRef.current, raw));
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const curExtent = extentRef.current;
      const plotX = getPlotX(e.clientX);
      let mode: BrushDragState = "creating";
      const info: {
        mode: BrushDragState;
        anchorX?: number;
        grabOffset?: number;
        width?: number;
        fixedLeft?: number;
        fixedRight?: number;
      } = { mode: "creating", anchorX: plotX };

      if (curExtent) {
        const left = Math.min(curExtent.x0, curExtent.x1);
        const right = Math.max(curExtent.x0, curExtent.x1);
        // repos/bklit-ui/packages/ui/src/charts/chart-brush-handle.tsx — visx invisible handle rects are 8px; pick 8px and document it.
        if (Math.abs(plotX - left) <= HANDLE_HIT_PX) {
          mode = "dragging-handle-left";
          info.mode = mode;
          info.fixedRight = right;
          delete info.anchorX;
        } else if (Math.abs(plotX - right) <= HANDLE_HIT_PX) {
          mode = "dragging-handle-right";
          info.mode = mode;
          info.fixedLeft = left;
          delete info.anchorX;
        } else if (plotX > left && plotX < right) {
          mode = "dragging-body";
          info.mode = mode;
          info.grabOffset = plotX - left;
          info.width = right - left;
          info.fixedLeft = left;
          delete info.anchorX;
        } else {
          mode = "creating";
          info.mode = mode;
          info.anchorX = plotX;
        }
      }

      dragInfoRef.current = info;
      draggingRef.current = true;
      setState(mode);
      stateRef.current = mode;

      if (mode === "creating") {
        const nx0 = plotX;
        const nx1 = plotX;
        setExtent({ x0: nx0, x1: nx1 });
      }

      const onPointerMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return;
        const infoNow = dragInfoRef.current;
        if (!infoNow) return;
        const w = innerWidthRef.current;
        if (w <= 0) return;
        const curPlotX = getPlotX(ev.clientX);
        let nx0 = 0;
        let nx1 = 0;
        if (infoNow.mode === "creating") {
          const anchor = infoNow.anchorX ?? 0;
          nx0 = Math.min(anchor, curPlotX);
          nx1 = Math.max(anchor, curPlotX);
        } else if (infoNow.mode === "dragging-handle-left") {
          const fixedRight = infoNow.fixedRight ?? extentRef.current?.x1 ?? w;
          nx0 = Math.max(0, Math.min(w, curPlotX));
          nx1 = Math.max(0, Math.min(w, fixedRight));
          if (nx0 > nx1) {
            const tmp = nx0;
            nx0 = nx1;
            nx1 = tmp;
          }
        } else if (infoNow.mode === "dragging-handle-right") {
          const fixedLeft = infoNow.fixedLeft ?? extentRef.current?.x0 ?? 0;
          nx0 = Math.max(0, Math.min(w, fixedLeft));
          nx1 = Math.max(0, Math.min(w, curPlotX));
          if (nx0 > nx1) {
            const tmp = nx0;
            nx0 = nx1;
            nx1 = tmp;
          }
        } else if (infoNow.mode === "dragging-body") {
          const grab = infoNow.grabOffset ?? 0;
          const bw = infoNow.width ?? 0;
          let newLeft = curPlotX - grab;
          newLeft = Math.max(0, Math.min(w - bw, newLeft));
          nx0 = newLeft;
          nx1 = newLeft + bw;
        }
        nx0 = Math.max(0, Math.min(w, nx0));
        nx1 = Math.max(0, Math.min(w, nx1));
        const sx0 = Math.min(nx0, nx1);
        const sx1 = Math.max(nx0, nx1);
        setExtent({ x0: sx0, x1: sx1 });
        const sel = pixelExtentToSelection(sx0, sx1, trackExtentRef.current, w);
        onSelectionChangeRef.current?.(sel);
      };

      const onPointerUp = (ev: PointerEvent) => {
        if (!draggingRef.current) return;
        const infoNow = dragInfoRef.current;
        const w = innerWidthRef.current;
        let finalExtent = extentRef.current;
        if (infoNow && w > 0) {
          const curPlotX = getPlotX((ev as PointerEvent).clientX);
          let nx0 = finalExtent?.x0 ?? 0;
          let nx1 = finalExtent?.x1 ?? 0;
          if (infoNow.mode === "creating") {
            const anchor = infoNow.anchorX ?? 0;
            nx0 = Math.min(anchor, curPlotX);
            nx1 = Math.max(anchor, curPlotX);
          } else if (infoNow.mode === "dragging-handle-left") {
            const fixedRight = infoNow.fixedRight ?? finalExtent?.x1 ?? w;
            nx0 = Math.max(0, Math.min(w, curPlotX));
            nx1 = Math.max(0, Math.min(w, fixedRight));
          } else if (infoNow.mode === "dragging-handle-right") {
            const fixedLeft = infoNow.fixedLeft ?? finalExtent?.x0 ?? 0;
            nx0 = Math.max(0, Math.min(w, fixedLeft));
            nx1 = Math.max(0, Math.min(w, curPlotX));
          } else if (infoNow.mode === "dragging-body") {
            const grab = infoNow.grabOffset ?? 0;
            const bw = infoNow.width ?? 0;
            let newLeft = curPlotX - grab;
            newLeft = Math.max(0, Math.min(w - bw, newLeft));
            nx0 = newLeft;
            nx1 = newLeft + bw;
          }
          nx0 = Math.max(0, Math.min(w, nx0));
          nx1 = Math.max(0, Math.min(w, nx1));
          const sx0 = Math.min(nx0, nx1);
          const sx1 = Math.max(nx0, nx1);
          finalExtent = { x0: sx0, x1: sx1 };
        }

        draggingRef.current = false;
        dragInfoRef.current = null;
        setState("idle");
        stateRef.current = "idle";

        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        if (!finalExtent || w <= 0) {
          setExtent(null);
          onSelectionChangeRef.current?.(null);
          return;
        }
        const fx0 = Math.min(finalExtent.x0, finalExtent.x1);
        const fx1 = Math.max(finalExtent.x0, finalExtent.x1);
        if (fx0 === fx1) {
          setExtent(null);
          // repos/bklit-ui/packages/ui/src/charts/chart-brush.tsx:271-291 boundsToSelection returns null on zero width — clear signal
          onSelectionChangeRef.current?.(null);
          return;
        }
        const sx0 = Math.max(0, Math.min(w, fx0));
        const sx1 = Math.max(0, Math.min(w, fx1));
        const sorted = { x0: Math.min(sx0, sx1), x1: Math.max(sx0, sx1) };
        setExtent(sorted);
        const sel = pixelExtentToSelection(sorted.x0, sorted.x1, trackExtentRef.current, w);
        onSelectionChangeRef.current?.(sel);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };

    el.addEventListener("pointerdown", onPointerDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
    };
  }, [host.containerRef, host.margin.left, innerWidth, host.trackExtent]);

  return { extent, state, innerWidth, innerHeight };
}
