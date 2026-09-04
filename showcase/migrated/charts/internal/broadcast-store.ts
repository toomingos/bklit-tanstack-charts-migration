// Value + listener Set. No-comparator stores notify on every set (pie controlled re-dispatch); with one, only on change.
export interface BroadcastStore<Value> {
  get: () => Value
  // Without a comparator always notifies; with one, only when `equals` is false.
  set: (next: Value) => void
  // Writes without notifying; pair with notify() for single-broadcast multi-field writes.
  setSilent: (next: Value) => void
  notify: () => void
  subscribe: (listener: () => void) => () => void
}

export const createBroadcastStore = <Value>(options: Readonly<{
  initial: Value;
  equals?: ((current: Value, next: Value) => boolean) | null;
}>): BroadcastStore<Value> => {
  const { equals } = options;
  let value = options.initial;

  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) {listener();}
  };

  return {
    get(): Value {
      return value;
    },
    notify(): void {
      notify();
    },
    set(next: Value): void {
      if (equals?.(value, next) === true) {return;}
      value = next;
      notify();
    },
    setSilent(next: Value): void {
      value = next;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
