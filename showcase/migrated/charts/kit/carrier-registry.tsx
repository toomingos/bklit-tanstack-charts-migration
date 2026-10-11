// Carriers nested in user components (`<MyLine/>` returning `<Line/>`) cannot be read from the element tree, so they register here when rendered.
// The chart renders its custom children in the SVG slot; direct carriers stay on the static path (read-children.ts) and never render.
import { createContext, useContext, useId, useLayoutEffect } from "react";
import type { ReactElement, ReactNode } from "react";
import { carrierEqual, trampolined } from "./carrier-props";
import type { Props } from "./carrier-props";

export interface RegisteredCarrier {
  readonly role: string;
  /** Top-level position of the user element that rendered it, plus the fraction (below 1) of its registration order. */
  readonly position: number;
  readonly props: Props;
}

interface Entry {
  role: string;
  slot: number;
  seq: number;
  raw: Props;
  latest: Props;
  props: Props;
}

export interface CarrierRegistry {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => readonly RegisteredCarrier[];
  readonly settled: () => boolean;
  readonly settle: () => void;
  readonly set: (id: string, role: string, slot: number, props: Props) => void;
  readonly remove: (id: string) => void;
}

const NONE: readonly RegisteredCarrier[] = [];

export const createCarrierRegistry = (): CarrierRegistry => {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let sequence = 0;
  let cached: readonly RegisteredCarrier[] = NONE;
  let isSettled = false;
  const changed = (): void => {
    cached = [...entries.values()]
      .toSorted((a, b) => a.slot - b.slot || a.seq - b.seq)
      .map((entry) => ({ role: entry.role, position: entry.slot + entry.seq / (entry.seq + 1), props: entry.props }));
    listeners.forEach((listener) => { listener(); });
  };
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => cached,
    settled: () => isSettled,
    settle: () => {
      if (!isSettled) {
        isSettled = true;
        listeners.forEach((listener) => { listener(); });
      }
    },
    set: (id, role, slot, props) => {
      const entry = entries.get(id);
      if (entry !== undefined) {
        // Inline callbacks change identity every render: the trampolines read the latest, and only a structural change notifies.
        entry.latest = props;
        if (entry.role === role && entry.slot === slot && carrierEqual(entry.raw, props)) {
          return;
        }
      }
      const next: Entry = entry ?? { role, slot, seq: sequence, raw: props, latest: props, props };
      if (entry === undefined) {
        sequence += 1;
        entries.set(id, next);
      }
      next.role = role;
      next.slot = slot;
      next.raw = props;
      // SAFETY: trampolining a record of props yields a record of the same shape.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see SAFETY above
      next.props = trampolined(props, [], () => next.latest) as Props;
      changed();
    },
    remove: (id) => {
      if (entries.delete(id)) {
        changed();
      }
    },
  };
};

const RegistryContext = createContext<CarrierRegistry | null>(null);
const SlotContext = createContext(0);

/** Scopes one custom child: its carriers register against `registry` at the child's top-level position. */
export const SlotScope = ({ registry, position, children }: Readonly<{ registry: CarrierRegistry; position: number; children: ReactNode }>): ReactElement => (
  <RegistryContext.Provider value={registry}>
    <SlotContext.Provider value={position}>{children}</SlotContext.Provider>
  </RegistryContext.Provider>
);

/** Rendered after every custom child: its layout effect runs after theirs, so the chart can wait for the first registrations. */
export const SettleMark = ({ registry }: Readonly<{ registry: CarrierRegistry }>): null => {
  useLayoutEffect(() => { registry.settle(); }, [registry]);
  return null;
};

/** What a carrier component calls: registers its props when it renders inside a custom child. */
export const useCarrierRegistration = (role: string, displayName: string, props: Props): void => {
  const registry = useContext(RegistryContext);
  const slot = useContext(SlotContext);
  const id = useId();
  useLayoutEffect(() => { registry?.set(id, role, slot, props); });
  useLayoutEffect(() => () => { registry?.remove(id); }, [registry, id]);
  if (registry === null && process.env.NODE_ENV !== "production") {
    warnOnce(`<${displayName}> rendered outside a chart that reads wrapped children: it draws nothing. Keep it a direct child of the chart, or use a chart that supports wrapper components.`);
  }
};

const warned = new Set<string>();

/** Dev-only console warning, once per message. */
export const warnOnce = (message: string): void => {
  if (process.env.NODE_ENV === "production" || warned.has(message)) {
    return;
  }
  warned.add(message);
  console.warn(`[charts] ${message}`);
};
