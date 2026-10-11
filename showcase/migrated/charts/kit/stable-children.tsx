// A parent that owns hover state re-renders the chart with brand-new `children` but an identical carrier table:
// keep the previous table (and every memo keyed on it) instead of rebuilding the definition.
import { useMemo, useRef, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import { carrierEqual, isPlain, trampolined } from "./carrier-props";
import type { Props } from "./carrier-props";
import { createCarrierRegistry, SettleMark, SlotScope, warnOnce } from "./carrier-registry";
import type { CarrierRegistry, RegisteredCarrier } from "./carrier-registry";
import { customChildren, displayNameOf, declarationOf, declareAt, keepDeclarationIndex, readChildren } from "./read-children";
import type { ChildTable } from "./read-children";

/** Props a role reads only at mount (bklit/visx `initialBrushPosition`): the brush strip echoes every preview back into `initialSelection`, which must not rebuild its definition. */
const MOUNT_ONLY_PROPS = new Map([["brush", "initialSelection"]]);

const without = (props: Props, skip: string): Props => Object.fromEntries(Object.entries(props).filter(([key]) => key !== skip));

const carriersEqualFor = (role: string, a: Props, b: Props): boolean => {
  const skip = MOUNT_ONLY_PROPS.get(role);
  if (skip === undefined) {
    return carrierEqual(a, b);
  }
  return carrierEqual(without(a, skip), without(b, skip));
};

const tablesEqual = (a: ChildTable, b: ChildTable): boolean => {
  if (a.size !== b.size) {
    return false;
  }
  for (const [role, list] of a) {
    const next = b.get(role);
    if (!next || next.length !== list.length || !list.every((props, i) => carriersEqualFor(role, props, next[i]))) {
      return false;
    }
  }
  return true;
};

interface Latest { current: ChildTable | null }

const stabilise = (table: ChildTable, latest: Latest): ChildTable => {
  const out = new Map<string, readonly Record<string, unknown>[]>();
  for (const [role, list] of table) {
    out.set(
      role,
      list.map((props, i) =>
        keepDeclarationIndex(props, isPlain(props) ? Object.fromEntries(Object.entries(props).map(([key, item]) => [key, trampolined(item, [role, i, key], () => latest.current)])) : props),
      ),
    );
  }
  return out;
};

/** The static table plus the carriers registered from inside user components, each in JSX order. */
const withRegistered = (table: ChildTable, registered: readonly RegisteredCarrier[]): ChildTable => {
  if (registered.length === 0) {
    return table;
  }
  const out = new Map<string, readonly Record<string, unknown>[]>(table);
  for (const { role, position, props } of registered) {
    const merged = [...(out.get(role) ?? []), declareAt({ ...props }, position)];
    out.set(role, merged.toSorted((a, b) => declarationOf(a) - declarationOf(b)));
  }
  return out;
};

// Elements that only exist in HTML: inside the chart's <svg> they draw nothing.
const HTML_ONLY = new Set(["div", "span", "p", "button", "img", "ul", "ol", "li", "input", "label", "section", "table", "h1", "h2", "h3", "h4", "h5", "h6"]);

interface ChildTableResult {
  readonly table: ChildTable;
  /** Custom children (user components, SVG): render them in the chart's `<FocusLayer>` SVG slot. */
  readonly custom: ReactElement[];
  /** False until the first custom children have registered their carriers: hold the first definition for it. */
  readonly ready: boolean;
}

const useRegistry = (): CarrierRegistry => {
  const ref = useRef<CarrierRegistry | null>(null);
  ref.current ??= createCarrierRegistry();
  return ref.current;
};

/** The previous table while the carriers are structurally unchanged; its callbacks are trampolines reading the latest render's table through a ref.
 * `read` defaults to `readChildren`; a chart whose carriers nest (bar's <BarDepthProvider>) passes its own. */
export const useChildTable = (children: ReactNode, read: (children: ReactNode) => ChildTable = readChildren): ChildTableResult => {
  const registry = useRegistry();
  const registered = useSyncExternalStore(registry.subscribe, registry.snapshot, registry.snapshot);
  const settled = useSyncExternalStore(registry.subscribe, registry.settled, registry.settled);
  const stable = useRef<ChildTable | null>(null);
  const source = useRef<ChildTable | null>(null);
  const latest = useRef<ChildTable | null>(null);
  const next = withRegistered(read(children), registered);
  latest.current = next;
  if (stable.current === null || source.current === null || !tablesEqual(source.current, next)) {
    source.current = next;
    stable.current = stabilise(next, latest);
  }
  const custom = useMemo((): ReactElement[] => {
    const own = customChildren(children);
    if (own.length === 0) {
      return [];
    }
    for (const { node } of own) {
      if (typeof node.type === "string" && HTML_ONLY.has(node.type)) {
        warnOnce(`<${node.type}> is a chart child: children render inside the chart's <svg>, where HTML elements draw nothing. Wrap it in <foreignObject> or use an SVG element.`);
      }
    }
    return [
      ...own.map(({ node, position }) => <SlotScope key={position} registry={registry} position={position}>{node}</SlotScope>),
      <SettleMark key="settle" registry={registry} />,
    ];
  }, [children, registry]);
  return { table: stable.current, custom, ready: settled || custom.length === 0 };
};

/** For charts that read carriers only: user components and custom SVG among the children are never rendered, so say so in development. */
export const warnUnrenderedChildren = (children: ReactNode, chart: string): void => {
  for (const { node } of customChildren(children)) {
    const name = typeof node.type === "string" ? node.type : displayNameOf(node.type) ?? "component";
    warnOnce(`<${name}> is a child of ${chart}, which reads only its own components (e.g. <Line>): wrapper components and custom SVG are not rendered there, so it is ignored.`);
  }
};
