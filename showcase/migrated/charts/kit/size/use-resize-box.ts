// The one ResizeObserver wrapper of the kit: `observeResize` for effects with their own timing, `useResizeBox` for a rounded content box in state.
import { useEffect, useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

/** Observes `el`; `onEntry` gets the latest entry of each delivery. Returns the disconnect. */
export const observeResize = (el: Element, onEntry: (entry: ResizeObserverEntry | undefined) => void): (() => void) => {
  const observer = new ResizeObserver((entries) => { onEntry(entries.at(-1)); });
  observer.observe(el);
  return (): void => { observer.disconnect(); };
};

interface ResizeBox {
  readonly width: number;
  readonly height: number;
  /** False until the first observer delivery. */
  readonly observed: boolean;
}

/** Content box of `ref`, rounded to whole pixels, `initial` until the first delivery (bklit's react-use-measure first hop). */
export const useResizeBox = (ref: RefObject<HTMLElement | null>, initial?: { readonly width: number; readonly height: number }, measureBeforePaint = false): ResizeBox => {
  const [box, setBox] = useState<ResizeBox>({ width: initial?.width ?? 0, height: initial?.height ?? 0, observed: false });
  // Opt-in: the first box lands in the layout-effect commit, before first paint, not on the first observer delivery.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!measureBeforePaint || !el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    setBox({ width: Math.round(rect.width), height: Math.round(rect.height), observed: true });
  }, [ref, measureBeforePaint]);
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    return observeResize(el, (entry) => {
      const width = Math.round(entry?.contentRect.width ?? 0);
      const height = Math.round(entry?.contentRect.height ?? 0);
      setBox((prev) => (prev.observed && prev.width === width && prev.height === height ? prev : { width, height, observed: true }));
    });
  }, [ref]);
  return box;
};
