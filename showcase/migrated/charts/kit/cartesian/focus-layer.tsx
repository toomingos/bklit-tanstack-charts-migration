// Hover lives in a ref store (no definition rebuild or re-resolve on focus): only this <FocusLayer> leaf subscribes, owning the public `useChart()` context
// and the custom children (an SVG over the plot, in plot-space like bklit's), while the RendererChart never re-renders. Visual emphasis is fixed host-attribute CSS (`hoverStaticCss`).
// UPSTREAM-GAPS #55: the renderer has no slot for user SVG, so custom children paint above the chart marks, not in JSX order.
import { Children, useCallback, useRef, useSyncExternalStore } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ChartProvider } from "./chart-context";
import type { ChartContextValue } from "./chart-context";

interface FocusStore<T extends { readonly index: number }> {
  get: () => T | null;
  /** Deduped by `index` (null/null is a no-op); notifies subscribers only on a real change. */
  set: (next: T | null) => void;
  subscribe: (cb: () => void) => () => void;
}

function createFocusStore<T extends { readonly index: number }>(): FocusStore<T> {
  let value: T | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (next === value || (next && value && next.index === value.index)) {
        return;
      }
      value = next;
      listeners.forEach((l) => { l(); });
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/** One stable store per chart instance. */
export function useFocusStore<T extends { readonly index: number }>(): FocusStore<T> {
  const ref = useRef<FocusStore<T> | null>(null);
  ref.current ??= createFocusStore<T>();
  return ref.current;
}

/** Subscribe to the focus; only the calling component re-renders. */
function useFocused<T extends { readonly index: number }>(store: FocusStore<T>): T | null {
  const nothing = useCallback(() => null, []);
  return useSyncExternalStore(store.subscribe, store.get, nothing);
}

interface FocusLayerProps<T extends { readonly index: number }> {
  readonly store: FocusStore<T>;
  /** Called as a hook inside the layer: derive the public context for the current focus. */
  readonly useContextValue: (focused: T | null) => ChartContextValue;
  readonly children?: ReactNode;
}

/** Nothing to provide to without custom children: no subscription, so a focus change commits nothing here. */
export function FocusLayer<T extends { readonly index: number }>(props: FocusLayerProps<T>): ReactElement | null {
  return Children.count(props.children) > 0 ? <FocusProvider {...props} /> : null;
}

const SLOT_STYLE: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" };

function FocusProvider<T extends { readonly index: number }>({ store, useContextValue, children }: FocusLayerProps<T>): ReactElement {
  const focused = useFocused(store);
  const context = useContextValue(focused);
  return (
    <ChartProvider value={context}>
      <svg aria-hidden="true" data-bkm-slot="" style={SLOT_STYLE}>
        <g transform={`translate(${context.margin.left},${context.margin.top})`}>{children}</g>
      </svg>
    </ChartProvider>
  );
}
