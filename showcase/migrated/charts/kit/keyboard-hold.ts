import { erase } from "./erase";
import type { AnyInteraction as Interaction, AnyPoint as Point } from "./erased-types";
import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

const NAVIGATION_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"]);

const samePoint = (a: Point | null, b: Point | null): boolean =>
  a === b || (a !== null && b !== null && a.key === b.key && a.markId === b.markId && a.datumIndex === b.datumIndex);

/** A keyboard-held focus survives a pointer pass: the last point a navigation key focused is put back through `setControlledFocus` when the pointer pass ends, before the renderer's
 * leave clear (renderer.ts:700-751), so the next arrow continues from it. A resting pointer owns the focus once the keyboard lets go (lead ruling). Gap #42. */
export function useKeyboardFocusHold(hostRef: RefObject<HTMLElement | null>, getInteraction: () => Interaction | null | undefined): ((point: Point | null) => void) & { readonly isHeld: () => boolean; readonly markKeyboard: () => void; readonly setKeyboardFocus: (point: Point) => void } {
  const getRef = useRef(getInteraction);
  getRef.current = getInteraction;
  const held = useRef<Point | null>(null);
  const current = useRef<Point | null>(null);
  const keyboardInput = useRef(false);
  const restoredByUs = useRef(false);
  const onFocus = useCallback((point: Point | null): void => {
    current.current = point;
    if (point !== null && keyboardInput.current) {
      held.current = point;
      restoredByUs.current = false;
    }
  }, []);
  // For charts whose own React key handler moves the focus and stops the key before the host listener sees it (heatmap grid arrows).
  const markKeyboard = useCallback((): void => { keyboardInput.current = true; }, []);
  // For charts that place the focus themselves after a key press (sunburst's Enter zoom): a `setControlledFocus` focus is controller-owned, so the renderer's keyboard blur clear skips it (renderer.ts:738);
  // routing it here records it as keyboard-held, so a blur clears it (or hands it to a resting pointer) like an arrow-held one.
  const setKeyboardFocus = useCallback((point: Point): void => {
    held.current = point;
    current.current = point;
    restoredByUs.current = true;
    // TanStack's controller types only 'pointer' | 'programmatic'; the renderer takes any ChartFocusSource (renderer.ts:641).
    getRef.current()?.setControlledFocus(point, erase({ source: "keyboard" }));
  }, []);
  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return undefined;
    }
    // A pointer move reached the renderer since the hold was last put back, so the renderer counts the focus as pointer-owned.
    let pointerTook = false;
    // The resting pointer (client coordinates; null once it leaves or for touch), whether a key press owns the focus since the last
    // move that resolved a point, and whether the focus is the one a blur handed to the pointer.
    let pointer: { x: number; y: number } | null = null;
    let keyboardOwns = false;
    let handedToPointer = false;
    const restore = (): void => {
      const point = held.current;
      if (point === null || (samePoint(current.current, point) && !pointerTook)) {
        return;
      }
      pointerTook = false;
      restoredByUs.current = true;
      // TanStack's controller types only 'pointer' | 'programmatic'; the renderer takes any ChartFocusSource (renderer.ts:641).
      // Also hands ownership over (focusOwner 'controlled'), so the renderer's pointer-owned leave clear (renderer.ts:718-728) skips it.
      getRef.current()?.setControlledFocus(point, erase({ source: "keyboard" }));
    };
    const key = (event: KeyboardEvent): void => {
      keyboardInput.current = NAVIGATION_KEYS.has(event.key);
      keyboardOwns ||= keyboardInput.current;
    };
    const move = (event: PointerEvent): void => {
      keyboardInput.current = false;
      if (event.pointerType === "touch") {
        return;
      }
      pointer = { x: event.clientX, y: event.clientY };
      handedToPointer = false;
      const interaction = getRef.current();
      if (held.current === null && !keyboardOwns) {
        return;
      }
      const resolved = interaction ? interaction.resolvePointer(event.clientX, event.clientY) : null;
      if (resolved !== null) {
        keyboardOwns = false;
      }
      if (held.current === null) {
        return;
      }
      if (interaction && resolved === null) {
        // Nothing under the pointer: the renderer would empty the focus; keep it, and put the held point back if a point had taken over.
        event.stopPropagation();
        restore();
        return;
      }
      pointerTook = true;
    };
    const down = (event: PointerEvent): void => {
      keyboardInput.current = false;
      if (event.pointerType !== "touch") {
        held.current = null;
        restoredByUs.current = false;
        pointerTook = false;
      }
    };
    // The renderer clears a pointer-owned focus on the surface's mouseleave (renderer.ts:718-728, bound on the container at :919); pointerleave fires before mouseleave and this host
    // capture listener runs first, so the held point takes over: the clear finds it controller-owned, skips, and no onFocusChange(null) fires.
    const leave = (event: PointerEvent | MouseEvent): void => {
      const {target} = event;
      if (target === el && !("pointerType" in event && event.pointerType === "touch")) {
        pointer = null;
        if (handedToPointer) {
          handedToPointer = false;
          getRef.current()?.setControlledFocus(null, { source: "pointer" });
        }
      }
      if (held.current === null || ("pointerType" in event && event.pointerType === "touch") || !(target instanceof Element)) {
        return;
      }
      // `ts-chart-surface` is the core surface class, with no public handle for it (UPSTREAM-GAPS #36, #42).
      if (target === el || target.classList.contains("ts-chart-surface")) {
        restore();
      }
    };
    const enter = (event: PointerEvent): void => {
      if (event.pointerType !== "touch") {
        pointer = { x: event.clientX, y: event.clientY };
      }
    };
    const blur = (event: FocusEvent): void => {
      if (event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) {
        return;
      }
      const wasHeld = held.current !== null;
      held.current = null;
      // Focus left: no later focus change comes from a key, so none is recorded as the held point.
      keyboardInput.current = false;
      if (restoredByUs.current) {
        // A controller-set focus is not keyboard-owned, so the renderer's blur clear skips it (renderer.ts:738).
        restoredByUs.current = false;
        getRef.current()?.setControlledFocus(null, { source: "pointer" });
      }
      if (!(keyboardOwns || wasHeld) || pointer === null) {
        return;
      }
      keyboardOwns = false;
      const interaction = getRef.current();
      const resolved = interaction?.resolvePointer(pointer.x, pointer.y) ?? null;
      if (interaction && resolved !== null) {
        handedToPointer = true;
        interaction.setControlledFocus(resolved, { source: "pointer" });
      }
    };
    el.addEventListener("keydown", key, true);
    el.addEventListener("pointermove", move, true);
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointerleave", leave, true);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("mouseleave", leave, true);
    el.addEventListener("focusout", blur);
    return (): void => {
      el.removeEventListener("keydown", key, true);
      el.removeEventListener("pointermove", move, true);
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointerleave", leave, true);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("mouseleave", leave, true);
      el.removeEventListener("focusout", blur);
    };
  }, [hostRef]);
  const isHeld = useCallback((): boolean => held.current !== null, []);
  return Object.assign(onFocus, { isHeld, markKeyboard, setKeyboardFocus });
}
