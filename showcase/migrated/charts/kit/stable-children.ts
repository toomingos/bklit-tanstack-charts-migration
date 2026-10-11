// A parent that owns hover state re-renders the chart with brand-new `children` but an identical carrier table:
// keep the previous table (and every memo keyed on it) instead of rebuilding the definition.
import { useRef } from "react";
import type { ReactNode } from "react";
import { isFunction, isRecord } from "./guards";
import { keepDeclarationIndex, readChildren } from "./read-children";
import type { ChildTable } from "./read-children";

const MAX_DEPTH = 12;

type Props = Readonly<Record<string, unknown>>;

/** Structural equality for carrier props. Functions are never compared (inline formatters change identity every render), only their presence;
 * `useStableTable` routes them through latest-ref trampolines. */
const carrierEqual = (a: unknown, b: unknown, depth = 0): boolean => {
  if (Object.is(a, b)) {
    return true;
  }
  if (depth > MAX_DEPTH || a === null || b === null) {
    return false;
  }
  if (isFunction(a)) {
    return isFunction(b);
  }
  if (!(isRecord(a) && isRecord(b))) {
    return false;
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keys = Object.keys(a).filter((key) => !key.startsWith("_"));
  const other = Object.keys(b).filter((key) => !key.startsWith("_"));
  if (keys.length !== other.length) {
    return false;
  }
  return keys.every((key) => key in b && carrierEqual(a[key], b[key], depth + 1));
};

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

type Path = readonly (string | number)[];

// oxlint-disable-next-line anti-slop/no-unknown-returns -- walks an opaque prop tree; the leaf type is the caller's
const at = (root: unknown, path: Path): unknown => {
  let node = root;
  for (const key of path) {
    if (!isRecord(node)) {
      return undefined;
    }
    node = node instanceof Map ? node.get(key) : node[key];
  }
  return node;
};

const isPlain = (value: Props): boolean => {
  if (Array.isArray(value)) {
    return true;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && !("$$typeof" in value);
};

interface Latest { current: ChildTable | null }

/** Copy of `value` with every function replaced by a trampoline that calls whatever function currently sits at that path in `latest`. */
// oxlint-disable-next-line anti-slop/no-unknown-returns -- clones an opaque prop tree; values keep their runtime type
const trampolined = (value: unknown, path: Path, latest: Latest): unknown => {
  if (isFunction(value)) {
    // oxlint-disable-next-line anti-slop/no-unknown-returns -- forwards the wrapped function's own return value
    return (...args: unknown[]) => {
      const fn = at(latest.current, path);
      return isFunction(fn) ? fn(...args) : undefined;
    };
  }
  if (!isRecord(value) || value instanceof Date || !isPlain(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => trampolined(item, [...path, i], latest));
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trampolined(item, [...path, key], latest)]));
};

const stabilise = (table: ChildTable, latest: Latest): ChildTable => {
  const out = new Map<string, readonly Record<string, unknown>[]>();
  for (const [role, list] of table) {
    out.set(
      role,
      list.map((props, i) =>
        keepDeclarationIndex(props, isPlain(props) ? Object.fromEntries(Object.entries(props).map(([key, item]) => [key, trampolined(item, [role, i, key], latest)])) : props),
      ),
    );
  }
  return out;
};

/** The previous table while the carriers are structurally unchanged; its callbacks are trampolines reading the latest render's table through a ref.
 * `read` defaults to `readChildren`; a chart whose carriers nest (bar's <BarDepthProvider>) passes its own. */
export const useStableTable = (children: ReactNode, read: (children: ReactNode) => ChildTable = readChildren): ChildTable => {
  const stable = useRef<ChildTable | null>(null);
  const source = useRef<ChildTable | null>(null);
  const latest = useRef<ChildTable | null>(null);
  const next = read(children);
  latest.current = next;
  if (stable.current === null || source.current === null || !tablesEqual(source.current, next)) {
    source.current = next;
    stable.current = stabilise(next, latest);
  }
  return stable.current;
};
