// Hover lives in a ref store (no definition rebuild or re-resolve on focus): only this <FocusLayer> leaf subscribes, owning the public `useChart()` context
// and the passthrough children, while the RendererChart never re-renders. Visual emphasis is fixed host-attribute CSS (`hoverStaticCss`).
import { Children, useCallback, useRef, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
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

/** Nothing to provide to without passthrough children: no subscription, so a focus change commits nothing here. */
export function FocusLayer<T extends { readonly index: number }>(props: FocusLayerProps<T>): ReactElement | null {
  return Children.count(props.children) > 0 ? <FocusProvider {...props} /> : null;
}

function FocusProvider<T extends { readonly index: number }>({ store, useContextValue, children }: FocusLayerProps<T>): ReactElement {
  const focused = useFocused(store);
  const context = useContextValue(focused);
  return (
    <ChartProvider value={context}>
      {children}
    </ChartProvider>
  );
}
