// The live chart's focus plumbing: the keyboard hold, the pointer crosshair's glide, the edge hold and the host CSS vars the
// tick fade (live-tick-fade.ts) and liveline.css read. Everything writes the host element only.
import { erase } from "../kit/cartesian/erased-types";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ChartPoint, ChartRendererRenderContext, ChartScene } from "@tanstack/charts";
import { useKeyboardFocusHold } from "../kit/cartesian/keyboard-hold";
import { useInteractionHandle, useTouchInert } from "../kit/cartesian/touch-focus";
import { liveRowOf } from "./definition";
import type { LiveRow } from "./definition";
import { useEdgeHold } from "./live-edge";
import type { Frame, FrameState } from "./live-frame";
import { useCrosshairGlide } from "./live-glide";
import type { GlideView } from "./live-glide";
import { clearAttribute, clearVar, raiseAttribute, writeVar } from "../kit/host-write";

interface UseLiveFocusArgs {
  readonly hostRef: { readonly current: HTMLDivElement | null };
  readonly frame: Frame | null;
  readonly state: { readonly current: FrameState };
  readonly hoverBounds: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
  readonly left: number;
  readonly top: number;
  readonly innerHeight: number;
  readonly pxPerMs: number;
  /** Whether the chart is built (the pointer listeners and the touch guard need the host's chart). */
  readonly hosted: boolean;
  readonly setSceneWidth: (update: (current: number) => number) => void;
}

interface LiveFocus {
  readonly onRender: (context: ChartRendererRenderContext<never, never, never>) => void;
  readonly onFocusChange: (point: { x: number; datum?: unknown } | null) => void;
}

export function useLiveFocus({ hostRef, frame, state, hoverBounds, left, top, innerHeight, pxPerMs, hosted, setSceneWidth }: UseLiveFocusArgs): LiveFocus {
  const sceneRef = useRef<ChartScene<never, never, never> | null>(null);
  // bklit's tick fade sits at the crosshair, here the renderer's focus. Core defers focus-state label opacity while the roll runs,
  // so the focus x goes into host CSS vars and TICK_FADE_CSS fades against it; the pointer only refines a pointer-owned focus.
  const boundsRef = useRef(hoverBounds);
  boundsRef.current = hoverBounds;
  const layoutRef = useRef({ left, x0: 0, pxPerMs });
  layoutRef.current = { left, x0: frame?.xDomain[0] ?? 0, pxPerMs };
  /** Focused row time (plot clock ms) while focus is keyboard-held, else null; `pointerFocus` while the pointer owns it. */
  const focusRef = useRef<{ row: number | null; pointer: boolean }>({ row: null, pointer: false });
  const writeRowFx = useCallback(() => {
    const el = hostRef.current;
    const t = focusRef.current.row;
    if (!el || t === null) {
      return;
    }
    const g = layoutRef.current;
    writeVar(el, "--bkm-kx", (g.left + (t - g.x0) * g.pxPerMs).toFixed(2));
    writeVar(el, "--bkm-pl", boundsRef.current.left.toFixed(2));
  }, []);
  const { interaction: liveInteraction, onRender: onInteractionRender } = useInteractionHandle();
  const onLiveRender = useCallback(
    (context: Parameters<typeof onInteractionRender>[0]): void => {
      onInteractionRender(context);
      sceneRef.current = context.scene;
      setSceneWidth((current) => (context.scene.width > 0 && Math.round(context.scene.width) !== current ? Math.round(context.scene.width) : current));
    },
    [onInteractionRender],
  );
  // The hold is keyed by the held row's time (`t<ms>`, smoothed rows `t<ms>~j`; charts-core interaction.ts:97 restoreChartFocusPoint), checked by base key.
  // A row the roll or data dropped clamps to the row at or left of the plot's left edge (from `scene.points`), handed to `setControlledFocus`, which applies `group`.
  const frameRowsRef = useRef<readonly LiveRow[]>([]);
  frameRowsRef.current = frame?.rows ?? [];
  const holdInteraction = useCallback(() => {
    const i = liveInteraction.current;
    if (!i) {
      return null;
    }
    // The row at or left of the plot's left edge, from the scene's own points; core's `group` (liveFocus) then pins it at the edge.
    const atPlotLeft = (): ChartPoint<never, never, never> | null => {
      const rows = (sceneRef.current?.points ?? [])
        .filter((p) => p.markId === "live:line" && liveRowOf(p)?.key !== "live:cursor" && liveRowOf(p)?.pad !== true)
        .sort((x, y) => x.x - y.x);
      const { left: plotLeft } = boundsRef.current;
      return rows.findLast((p) => p.x <= plotLeft) ?? rows.at(0) ?? null;
    };
    // SAFETY: the wrapper keeps every method of the interaction controller and only intercepts setControlledFocus.
    return {
      ...i,
      resolvePointer: i.resolvePointer.bind(i),
      setControlledFocus: (point: Parameters<typeof i.setControlledFocus>[0], options: Parameters<typeof i.setControlledFocus>[1]) => {
        // SAFETY: the focus point is a scene point or a pointer resolution; both carry the row as their datum.
        const held = liveRowOf(point as { datum?: unknown } | null);
        // The pointer's interpolated row (a blur handing the focus back to a resting pointer) is not a held row.
        if (point === null || !held || held.key === "live:cursor") {
          i.setControlledFocus(point, options);
          return;
        }
        const base = held.key.split("~")[0];
        if (frameRowsRef.current.some((r) => r.key === base && !r.pad)) {
          i.setControlledFocus(point, options);
          return;
        }
        const edge = atPlotLeft();
        if (edge !== null) {
          i.setControlledFocus(edge, options);
        }
      },
    } as typeof i;
  }, [liveInteraction]);
  const holdFocus = useKeyboardFocusHold(hostRef, holdInteraction);
  const glideFrameRef = useRef<GlideView>({ frame: null, top: 0, height: 0 });
  glideFrameRef.current = { frame, top, height: innerHeight };
  const { glideTo, stopGlide } = useCrosshairGlide({ hostRef, view: glideFrameRef, state, layoutRef });
  const { holdEdge, stopEdge, edgeAtRef } = useEdgeHold({ hostRef, focusRef, view: glideFrameRef, layoutRef, boundsRef });
  const handleFocusChange = useCallback(
    (point: { x: number; datum?: unknown } | null) => {
      const el = hostRef.current;
      // The pointer's interpolated `live:cursor` row is not a keyboard row: the hold only sees real rows (null for the cursor).
      holdFocus(erase(liveRowOf(point)?.key === "live:cursor" ? null : point));
      if (!el) {
        return;
      }
      const row = liveRowOf(point);
      // bklit dims the live dot and badge to 0.25 while its tooltip shows (live-line.tsx:112,245): any focus here shows one.
      if (!point || !row) {
        stopGlide();
        stopEdge();
        edgeAtRef.current = false;
        focusRef.current = { row: null, pointer: false };
        clearVar(el, "--bkm-fx");
        clearVar(el, "--bkm-kx");
        clearVar(el, "--bkm-pl");
        clearAttribute(el, "data-bkm-kfx");
        clearAttribute(el, "data-bkm-live-scrubbing");
        return;
      }
      if (row.key === "live:cursor") {
        // liveFocus resolves a pointer focus at the pointer x itself.
        if (!focusRef.current.pointer) {
          stopGlide();
          glideTo(point.x);
        }
        stopEdge();
        edgeAtRef.current = false;
        focusRef.current = { row: null, pointer: true };
        raiseAttribute(el, "data-bkm-live-scrubbing");
        clearAttribute(el, "data-bkm-kfx");
        clearVar(el, "--bkm-kx");
        writeVar(el, "--bkm-fx", point.x.toFixed(1));
        return;
      }
      stopGlide();
      focusRef.current = { row: row.t, pointer: false };
      clearVar(el, "--bkm-fx");
      writeRowFx();
      raiseAttribute(el, "data-bkm-kfx");
      raiseAttribute(el, "data-bkm-live-scrubbing");
      holdEdge();
    },
    [writeRowFx, holdFocus, stopGlide, glideTo, stopEdge, holdEdge],
  );
  // A held row's resting x moves with every tick: re-laid out in the commit that restarts the roll's --bkm-fxr.
  useLayoutEffect(() => {
    writeRowFx();
    holdEdge();
  }, [frame, writeRowFx, holdEdge]);
  // bklit's live chart has mouse handlers only (onMouseMove / onMouseLeave): a touch never reaches its hover, so none reaches ours.
  useTouchInert(hostRef, hosted);
  // Gap #45: `updateFocus` drops `onFocusChange` while the focus identity is unchanged (`sameChartPointIdentity`, charts-core interaction.ts:71-86),
  // so a pointer move refines the x of a pointer-owned focus; leaving needs no handler (the renderer drops that focus).
  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return;
    }
    // Host box cached until scroll/resize: a per-move read after the --bkm-fx / --bkm-pgx writes forces layout
    // every pointermove (UPSTREAM-GAPS #21).
    let box: DOMRect | null = null;
    const drop = (): void => {
      box = null;
    };
    const resized = new ResizeObserver(drop);
    resized.observe(el);
    const move = (e: PointerEvent): void => {
      const b = boundsRef.current;
      box ??= el.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      if (focusRef.current.pointer && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
        writeVar(el, "--bkm-fx", x.toFixed(1));
        glideTo(x);
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerenter", drop);
    window.addEventListener("scroll", drop, { capture: true, passive: true });
    window.addEventListener("resize", drop);
    return (): void => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerenter", drop);
      window.removeEventListener("scroll", drop, { capture: true });
      window.removeEventListener("resize", drop);
      resized.disconnect();
    };
  }, [hosted, glideTo]);

  return { onRender: onLiveRender, onFocusChange: handleFocusChange };
}
