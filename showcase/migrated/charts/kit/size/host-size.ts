// Width-keyed definitions are built once, at the real size: the chart renders an empty host of the same className / style,
// this measures it in a layout effect (before first paint, ResizeObserver while hidden at width 0), and only then the chart mounts.
import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { observeResize } from "./use-resize-box";

interface HostSize {
  readonly width: number;
  readonly height: number;
}

interface HostSizeState {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly size: HostSize | null;
}

export const useHostSize = (): HostSizeState => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<HostSize | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    const measure = (): boolean => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) {
        return false;
      }
      setSize({ width: rect.width, height: rect.height });
      return true;
    };
    if (measure()) {
      return undefined;
    }
    const stop = observeResize(el, () => {
      if (measure()) {
        stop();
      }
    });
    return stop;
  }, []);
  return { ref, size };
};
