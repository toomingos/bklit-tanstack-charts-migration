// Generic broadcast store: value + listener Set + notify, extracted from the
// per-chart hover coordinators (pie-hover-chrome.ts, heatmap-hover-chrome.ts).
// Extraction-only — every concrete coordinator keeps its own interface and
// notify semantics:
//   - pie (and its ring/funnel alias re-exports) constructs it with NO
//     comparator → every set notifies (no dedup), preserving pie's
//     controlled-mode re-dispatch behavior;
//   - heatmap constructs per-field stores WITH comparators replicating its
//     exact guards, and uses `setSilent` + one explicit `notify()` for
//     clearInteraction so all three fields broadcast ONCE, as before.
export interface BroadcastStore<T> {
  get(): T;
  /** Sets the value and notifies subscribers. With a comparator configured,
      notifies only when `equals(current, next)` is false; without one, always
      notifies. */
  set(next: T): void;
  /** Writes without notifying. For multi-field broadcasts that must produce
      exactly ONE notification (heatmap clearInteraction). */
  setSilent(next: T): void;
  /** Manually notifies subscribers — pairs with `setSilent` for one-broadcast
      multi-field writes. */
  notify(): void;
  subscribe(listener: () => void): () => void;
}

export function createBroadcastStore<T>(options: {
  initial: T;
  equals?: ((current: T, next: T) => boolean) | null;
}): BroadcastStore<T> {
  const equals = options.equals ?? null;
  let value = options.initial;

  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    get(): T {
      return value;
    },
    set(next: T): void {
      if (equals !== null && equals(value, next)) return;
      value = next;
      notify();
    },
    setSilent(next: T): void {
      value = next;
    },
    notify(): void {
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
