// First width on bklit's chain, then followed by the host's own observer. Pie, ring and heatmap build pixel geometry from the width before mounting
// (annular hit targets and centre in the definition, grow outlines and the centre overlay outside it), so TanStack's host cannot size them
// (pie-chart.tsx buildPieDefinition `targets`, ring-chart.tsx `center`, heatmap/chart.tsx computeMetrics). Rule: TanStack-native host sizing only
// brings a first-layout paint; a measure of our own would be a generic React optimisation, so these mount on the ParentSize chain instead.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { observeParentSize } from "./parent-size-arm";
import { observeResize } from "./use-resize-box";

/** Width the pie and ring charts assume until the first measure. */
export const INITIAL_WIDTH_PX = 320;

interface FluidWidthOptions {
  /** Width used until the first measure. */
  readonly initialWidth: number;
  /** Smallest width change that is applied. */
  readonly epsilon: number;
  /** False for fixed-size charts: nothing is measured and `ready` is true from the start. */
  readonly enabled?: boolean;
  /** Below this width the chart renders a fallback box, a different host element, so the observer re-attaches on crossing it. */
  readonly collapseBelow?: number;
}

interface FluidWidth {
  readonly width: number;
  readonly ready: boolean;
}

export const useFluidWidth = (hostRef: RefObject<HTMLElement | null>, options: FluidWidthOptions): FluidWidth => {
  const { initialWidth, epsilon, enabled = true, collapseBelow = 0 } = options;
  const [width, setWidth] = useState(initialWidth);
  const latest = useRef(initialWidth);
  const [ready, setReady] = useState(!enabled);
  const collapsed = width < collapseBelow;
  const apply = (next: number): void => {
    if (Number.isFinite(next) && next > 0 && Math.abs(latest.current - next) > epsilon) {
      latest.current = next;
      setWidth(next);
    }
  };
  // The first width is ParentSize's: the first ResizeObserver delivery, then one frame (@visx/responsive useParentSize.js:44-58; debounce 10 ms, `leading: true`).
  useEffect(() => {
    const host = hostRef.current;
    if (!enabled || ready || host === null) { return undefined; }
    return observeParentSize(host, (measured) => {
      if (measured > 0) { latest.current = measured; setWidth(measured); }
      setReady(true);
    });
  }, [enabled, ready, hostRef]);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!enabled || !ready || host === null || typeof ResizeObserver === "undefined") { return undefined; }
    return observeResize(host, (entry) => { apply(entry?.contentRect.width ?? 0); });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-attach only on these keys; `apply` reads refs and the render's epsilon
  }, [enabled, ready, hostRef, collapsed]);
  return { ready, width };
};
