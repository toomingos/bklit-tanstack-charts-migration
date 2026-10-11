// Touch focus lifecycle on host listeners over the public controller (one finger focuses, two fingers or lift clear).
// UPSTREAM-GAPS #39: the renderer has no touch focus lifecycle.
import type { ChartRendererRenderContext } from "@tanstack/charts";
import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { erase } from "./erased-types";
import type { AnyInteraction as Interaction } from "./erased-types";
import { clearAttribute, raiseAttribute } from "../host-write";


/** Native interaction handle of the mounted chart: pass `onRender` to the chart, read `interaction.current` in handlers. */
export interface InteractionHandle {
  readonly interaction: RefObject<Interaction | null>;
  readonly onRender: (context: ChartRendererRenderContext<never, never, never>) => void;
}

/** Captures the renderer's `interaction` controller (`resolvePointer` / `setControlledFocus`) from the chart's `onRender`. */
export function useInteractionHandle(): InteractionHandle {
  const interaction = useRef<Interaction | null>(null);
  const onRender = useCallback((context: ChartRendererRenderContext<never, never, never>): void => {
    interaction.current = erase(context.interaction);
  }, []);
  return { interaction, onRender };
}

/** bklit use-chart-interaction touch handling: one finger focuses the nearest point on touchstart and follows it, two fingers clear the tooltip (client x to `onFingers`), a lift clears both.
 * Inert until `data-bkm-ready` (bklit `canInteract`). Focus goes through `resolvePointer` + `setControlledFocus`; touch `pointerdown` is preventDefaulted, the touch `click` swallowed. */
export function useTouchFocus(
  hostRef: RefObject<HTMLElement | null>,
  interaction: RefObject<Interaction | null>,
  onFingers?: (clientXs: number[] | null) => void,
): void {
  const onFingersRef = useRef(onFingers);
  onFingersRef.current = onFingers;
  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return undefined;
    }
    const fingers = new Map<number, number>();
    const report = (): void => onFingersRef.current?.(fingers.size >= 2 ? [...fingers.values()] : null);
    const down = (event: PointerEvent): void => {
      if (event.pointerType !== "touch" || !el.hasAttribute("data-bkm-ready")) {
        return;
      }
      event.preventDefault();
      fingers.set(event.pointerId, event.clientX);
      if (fingers.size === 1) {
        clearAttribute(el, "data-bkm-press");
        interaction.current?.setControlledFocus(interaction.current.resolvePointer(event.clientX, event.clientY), { source: "pointer" });
      } else if (fingers.size === 2) {
        interaction.current?.setControlledFocus(null, { source: "pointer" });
        report();
      }
    };
    const move = (event: PointerEvent): void => {
      if (event.pointerType !== "touch" || !fingers.has(event.pointerId)) {
        return;
      }
      fingers.set(event.pointerId, event.clientX);
      if (fingers.size >= 2) {
        event.stopPropagation();
        report();
      }
    };
    const end = (event: PointerEvent): void => {
      if (event.pointerType !== "touch" || !fingers.delete(event.pointerId)) {
        return;
      }
      fingers.clear();
      interaction.current?.setControlledFocus(null, { source: "pointer" });
      onFingersRef.current?.(null);
    };
    const swallow = (event: MouseEvent): void => {
      if (event instanceof PointerEvent && event.pointerType === "touch") {
        event.stopPropagation();
      }
    };
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    el.addEventListener("click", swallow, true);
    return (): void => {
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      el.removeEventListener("click", swallow, true);
    };
  }, [hostRef, interaction]);
}

/** bklit scatter / candlestick on charts with no hover host: a touch lift, a second finger or (`hideOnPress`) a mouse press clears the tooltip via `data-bkm-press`; the next focus lifts it.
 * A mouse press is `mousedown` + drag in bklit: hover is frozen until release and the ending click swallowed. */
export function usePressGuard(hostRef: RefObject<HTMLElement | null>, interaction: RefObject<Interaction | null>, hideOnPress: boolean): void {
  useTouchFocus(hostRef, interaction, () => { if (hostRef.current) { raiseAttribute(hostRef.current, "data-bkm-press"); } });
  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return undefined;
    }
    let pressed = false;
    let swallowClick = false;
    const down = (event: PointerEvent): void => {
      swallowClick = false;
      if (event.button !== 0 || event.pointerType === "touch" || !el.hasAttribute("data-bkm-ready")) {
        return;
      }
      pressed = true;
      swallowClick = true;
      event.stopPropagation();
      if (hideOnPress) {
        raiseAttribute(el, "data-bkm-press");
        interaction.current?.setControlledFocus(null, { source: "pointer" });
      }
    };
    const move = (event: PointerEvent): void => {
      if (event.pointerType === "touch") {
        return;
      }
      if (pressed) {
        event.stopPropagation();
      } else {
        clearAttribute(el, "data-bkm-press");
      }
    };
    const up = (): void => {
      pressed = false;
    };
    const click = (event: MouseEvent): void => {
      if (swallowClick) {
        swallowClick = false;
        event.stopPropagation();
      }
    };
    // A mousedown would focus the chart surface, whose focus handler lands the keyboard focus on the first point.
    const mouseDown = (event: MouseEvent): void => {
      if (pressed) {
        event.preventDefault();
      }
    };
    el.addEventListener("mousedown", mouseDown, true);
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move, true);
    el.addEventListener("click", click, true);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return (): void => {
      el.removeEventListener("mousedown", mouseDown, true);
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move, true);
      el.removeEventListener("click", click, true);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [hostRef, interaction, hideOnPress]);
}

/** bklit bar chart has mouse handlers only: touch pointers never reach the renderer, so no touch tooltip. */
export function useTouchInert(hostRef: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !enabled) {
      return undefined;
    }
    const swallow = (event: Event): void => {
      if (event instanceof PointerEvent && event.pointerType === "touch") {
        event.stopPropagation();
      }
    };
    const types = ["pointerdown", "pointermove", "pointerup", "pointerover", "pointerenter", "click"];
    for (const type of types) {
      el.addEventListener(type, swallow, true);
    }
    return (): void => {
      for (const type of types) {
        el.removeEventListener(type, swallow, true);
      }
    };
  }, [hostRef, enabled]);
}

/** Pixels a touch may travel and still count as a tap (past it the page scrolls: bklit's pointer is cancelled). */
const TAP_SLOP_PX = 10;

interface TapFocusOptions {
  /** `tap` (mouse-handler charts): the tapped target is the hover on lift, until a tap lands elsewhere. `press` (pointer-handler charts): the target under each finger is the hover
   * while the finger is down; a lift, cancel or drag past the slop clears it. */
  readonly mode: "tap" | "press";
  readonly enabled?: boolean;
}

/** bklit hover charts with no touch handlers, under touch: a finger never follows, a second finger does nothing in `tap` mode, only enter/leave semantics reach the hover (`TapFocusOptions`).
 * Touch pointers are kept from the renderer; the hover goes through the native controller. A mouse press never focuses the chart surface. */
export function useTapFocus(hostRef: RefObject<HTMLElement | null>, getInteraction: () => Interaction | null | undefined, options: TapFocusOptions): void {
  const getRef = useRef(getInteraction);
  getRef.current = getInteraction;
  const { mode, enabled = true } = options;
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !enabled) {
      return undefined;
    }
    const down = new Map<number, { x: number; y: number }>();
    let tapOk = false;
    const inside = (event: Event): boolean => event.target instanceof Node && el.contains(event.target);
    const focusAt = (x: number, y: number): void => {
      const interaction = getRef.current();
      interaction?.setControlledFocus(interaction.resolvePointer(x, y), { source: "pointer" });
    };
    const clear = (): void => getRef.current()?.setControlledFocus(null, { source: "pointer" });
    const onDown = (event: PointerEvent): void => {
      if (event.pointerType !== "touch") {
        return;
      }
      const within = inside(event);
      if (within) {
        event.stopPropagation();
        event.preventDefault();
      }
      tapOk = down.size === 0;
      down.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (mode === "press" && within) {
        focusAt(event.clientX, event.clientY);
      }
    };
    const onMove = (event: PointerEvent): void => {
      if (event.pointerType !== "touch") {
        return;
      }
      if (inside(event)) {
        event.stopPropagation();
      }
      const origin = down.get(event.pointerId);
      if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > TAP_SLOP_PX) {
        tapOk = false;
        if (mode === "press") {
          clear();
        }
      }
    };
    const onUp = (event: PointerEvent): void => {
      if (event.pointerType !== "touch" || !down.has(event.pointerId)) {
        return;
      }
      const within = inside(event);
      if (within) {
        event.stopPropagation();
      }
      const wasTap = tapOk && down.size === 1;
      down.delete(event.pointerId);
      tapOk = false;
      if (mode === "press") {
        clear();
      } else if (wasTap) {
        if (within) {
          focusAt(event.clientX, event.clientY);
        } else {
          clear();
        }
      }
    };
    const onCancel = (event: PointerEvent): void => {
      if (event.pointerType === "touch" && down.delete(event.pointerId)) {
        tapOk = false;
        if (mode === "press") {
          clear();
        }
      }
    };
    const swallowClick = (event: MouseEvent): void => {
      if (mode === "tap" && event instanceof PointerEvent && event.pointerType === "touch") {
        event.stopPropagation();
      }
    };
    const mouseDown = (event: MouseEvent): void => { event.preventDefault(); };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    el.addEventListener("click", swallowClick, true);
    el.addEventListener("mousedown", mouseDown, true);
    return (): void => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
      el.removeEventListener("click", swallowClick, true);
      el.removeEventListener("mousedown", mouseDown, true);
    };
  }, [hostRef, enabled, mode]);
}

/** bklit choropleth with zoom: its drag (use-gesture) captures the pointer, so hover freezes for a mouse press-drag and the element under the pointer enters on release;
 * the renderer must not see the moves while pressed. */
export function useMousePressFreeze(hostRef: RefObject<HTMLElement | null>, getInteraction: () => Interaction | null | undefined, enabled: boolean): void {
  const getRef = useRef(getInteraction);
  getRef.current = getInteraction;
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !enabled) {
      return undefined;
    }
    let pressed = false;
    const down = (event: PointerEvent): void => {
      pressed = event.button === 0 && event.pointerType === "mouse";
    };
    const move = (event: PointerEvent): void => {
      if (pressed && event.pointerType === "mouse") {
        event.stopPropagation();
      }
    };
    const up = (event: PointerEvent): void => {
      if (!pressed) {
        return;
      }
      pressed = false;
      const interaction = getRef.current();
      if (interaction && event.target instanceof Node && el.contains(event.target)) {
        interaction.setControlledFocus(interaction.resolvePointer(event.clientX, event.clientY), { source: "pointer" });
      }
    };
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    const cancel = (): void => {
      pressed = false;
    };
    window.addEventListener("pointercancel", cancel, true);
    return (): void => {
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
    };
  }, [hostRef, enabled]);
}
