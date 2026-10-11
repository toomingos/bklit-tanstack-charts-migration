// Main-plot drag range published as host attributes and CSS vars, beside hover focus (bklit use-chart-interaction.ts:176-270).
// UPSTREAM-GAPS #40: brushX owns the whole plot and cannot coexist with hover focus.
import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import { useInteractionHandle, useTouchFocus } from "./touch-focus";
import type { InteractionHandle } from "./touch-focus";

/** Plot geometry (svg px) the drag listeners read; the owner assigns it every render. */
export interface DragGeom {
  left: number;
  top: number;
  innerWidth: number;
  innerHeight: number;
}

interface DragHost {
  readonly drag: (edges: readonly [number, number] | null) => void;
  readonly press: (on: boolean) => void;
}

/** bklit's drag selection (use-chart-interaction handleMouseDown/Move/Up): a press clears tooltip, crosshair and pill (:207-218); the first drag move re-shows them at the press x
 * (re-anchor :315-325, line-chart.tsx:183). Native pointermove is swallowed while dragging; visuals are host attrs / CSS vars from `host.drag`. `onSelect` gets plot-space edges, or null on release. */
interface DragSelect {
  readonly clear: () => void;
  readonly interaction: InteractionHandle["interaction"];
  readonly onRender: InteractionHandle["onRender"];
}

export function useDragSelect(
  hostRef: RefObject<HTMLElement | null>,
  geom: MutableRefObject<DragGeom>,
  host: DragHost,
  onSelect?: (edges: { startX: number; endX: number } | null) => void,
): DragSelect {
  const { interaction, onRender } = useInteractionHandle();
  const { drag: dragHost, press: pressHost } = host;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const dragStartX = useRef<number | null>(null);
  const swallowClick = useRef(false);
  // Press point (client px) whose chrome the first drag move re-shows; null once re-shown or when nothing is pending.
  const reanchor = useRef<{ x: number; y: number } | null>(null);
  const publish = useCallback(
    (startX: number, endX: number): void => {
      dragHost([geom.current.left + startX, geom.current.left + endX]);
      onSelectRef.current?.({ startX, endX });
    },
    [dragHost, geom],
  );
  const end = useCallback((): void => {
    dragHost(null);
    onSelectRef.current?.(null);
  }, [dragHost]);
  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return undefined;
    }
    const plotX = (event: PointerEvent): number | null => {
      // Scene coordinates from the public controller (dom-types.ts:83-87, interactions-and-selections.md:385).
      const scene = interaction.current?.clientToScene(event.clientX, event.clientY);
      if (!scene) {
        return null;
      }
      const g = geom.current;
      const x = scene.x - g.left;
      const y = scene.y - g.top;
      return x >= 0 && x <= g.innerWidth && y >= 0 && y <= g.innerHeight ? x : null;
    };
    // A mousedown would focus the chart surface, whose focus handler lands the keyboard focus on the first point.
    const mouseDown = (event: MouseEvent): void => {
      if (event.button === 0 && dragStartX.current !== null) {
        event.preventDefault();
      }
    };
    el.addEventListener("mousedown", mouseDown, true);
    const down = (event: PointerEvent): void => {
      swallowClick.current = false;
      const x = event.button === 0 && event.pointerType !== "touch" && el.hasAttribute("data-bkm-ready") ? plotX(event) : null;
      if (x !== null) {
        dragStartX.current = x;
        swallowClick.current = true;
        end();
        // bklit handleMouseDown clears the tooltip at once; the renderer's own pointerdown must not re-focus the hover under the
        // pointer, so the press hides the chrome (`data-bkm-press`, instant like clearTooltip) and nulls the native focus.
        pressHost(true);
        interaction.current?.setControlledFocus(null, { source: "pointer" });
        reanchor.current = { x: event.clientX, y: event.clientY };
        event.stopPropagation();
      }
    };
    const move = (event: PointerEvent): void => {
      const anchor = dragStartX.current;
      if (event.pointerType === "touch" || anchor === null) {
        return;
      }
      event.stopPropagation();
      const x = plotX(event);
      if (x === null) {
        return;
      }
      const pending = reanchor.current;
      if (pending) {
        // The first selection update re-anchors the hover at the last hovered x (the press point): a fresh native show, so the
        // tooltip fades and springs in like bklit's remounted TooltipBox.
        reanchor.current = null;
        interaction.current?.setControlledFocus(interaction.current.resolvePointer(pending.x, pending.y), { source: "pointer" });
      }
      publish(Math.min(anchor, x), Math.max(anchor, x));
    };
    const stop = (): void => {
      dragStartX.current = null;
      reanchor.current = null;
      end();
    };
    // The click that ends a press must not re-focus the chart at the pointer: bklit keeps the tooltip at the press-start x until
    // the next move, drag or not (a press without a move included), so the renderer never sees it.
    const click = (event: MouseEvent): void => {
      if (swallowClick.current) {
        swallowClick.current = false;
        event.stopPropagation();
      }
    };
    el.addEventListener("click", click, true);
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move, true);
    // bklit handleMouseLeave clears the tooltip and ends the drag (use-chart-interaction.ts:198-205). The renderer never saw this
    // press's moves (swallowed above), so it has no pointer to leave: a leave during a press clears the native focus itself.
    const leave = (): void => {
      if (dragStartX.current !== null) {
        interaction.current?.setControlledFocus(null, { source: "pointer" });
      }
      stop();
    };
    el.addEventListener("pointerleave", leave);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return (): void => {
      el.removeEventListener("click", click, true);
      el.removeEventListener("mousedown", mouseDown, true);
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move, true);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [hostRef, geom, publish, end, pressHost, interaction]);
  // bklit use-chart-interaction touch handling (kit/cartesian/touch-focus.ts); two fingers also drag the range.
  useTouchFocus(hostRef, interaction, (clientXs) => {
    const scenes = clientXs?.map((clientX) => interaction.current?.clientToScene(clientX, 0)?.x);
    const known = scenes?.filter((x): x is number => x !== undefined);
    if (!scenes || !known || known.length !== scenes.length) {
      end();
      pressHost(true);
      return;
    }
    const xs = known.map((x) => x - geom.current.left);
    pressHost(true);
    publish(Math.min(...xs), Math.max(...xs));
  });
  const clear = useCallback((): void => {
    dragStartX.current = null;
    reanchor.current = null;
    end();
  }, [end]);
  return { clear, interaction, onRender };
}
