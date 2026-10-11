// Reads config-carrier children into a role -> props[] table (fragments flattened).
// Anything without a chart role (e.g. legacy children owned by other charts) is ignored.
import { Children, Fragment, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { isFunction, isRecord, isString } from "./guards";
import { CHART_ROLE } from "./role";

export type ChildTable = ReadonlyMap<string, readonly Record<string, unknown>[]>;

type CarrierProps = Record<string, unknown> & { children?: ReactNode };

const roleOfType = (type: unknown): string | undefined => {
  if (!(isFunction(type) || isRecord(type))) {
    return undefined;
  }
  // SAFETY: a role is a plain own-property marker; reading it off any function or object is sound.
  const role = (type as { readonly [CHART_ROLE]?: unknown })[CHART_ROLE];
  return isString(role) ? role : undefined;
};

// Declaration position of each carrier's props: its element's top-level position (bklit paints children in JSX order).
const declarationIndex = new WeakMap<WeakKey, number>();

/** Calls `visit` for each element child in JSX order (fragments flattened) with its top-level position, counted over every element. */
const forEachTopLevel = (children: ReactNode, visit: (child: ReactElement<CarrierProps>, position: number) => void): void => {
  let position = 0;
  const walk = (node: ReactNode): void => {
    Children.forEach(node, (child) => {
      if (!isValidElement<CarrierProps>(child)) {
        return;
      }
      if (child.type === Fragment) {
        walk(child.props.children);
        return;
      }
      visit(child, position);
      position += 1;
    });
  };
  walk(children);
};

export const readChildren = (children: ReactNode): ChildTable => {
  const table = new Map<string, Record<string, unknown>[]>();
  forEachTopLevel(children, (child, position) => {
    const role = roleOfType(child.type);
    if (role === undefined) {
      return;
    }
    declarationIndex.set(child.props, position);
    const list = table.get(role);
    if (list === undefined) {
      table.set(role, [child.props]);
    } else {
      list.push(child.props);
    }
  });
  return table;
};

/** Registered carriers (rendered inside user components) merged into the static table at their declaration position. */
export const declareAt = <T extends WeakKey>(props: T, position: number): T => {
  declarationIndex.set(props, position);
  return props;
};

export const declarationOf = (props: WeakKey): number => declarationIndex.get(props) ?? Number.POSITIVE_INFINITY;

/** A derived copy of a carrier's props keeps its declaration position. */
export const keepDeclarationIndex = <T extends WeakKey>(from: WeakKey, to: T): T => {
  const at = declarationIndex.get(from);
  if (at !== undefined) {declarationIndex.set(to, at);}
  return to;
};

/** True when `props` was declared before every carrier of `roles` (or no such carrier exists). */
export const declaredBefore = (table: ChildTable, props: WeakKey, roles: readonly string[]): boolean => {
  const at = declarationIndex.get(props) ?? Number.POSITIVE_INFINITY;
  return roles.every((role) => (table.get(role) ?? []).every((other) => at < (declarationIndex.get(other) ?? Number.POSITIVE_INFINITY)));
};

/** All props for one role, typed by the caller. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the caller names the role's prop shape
export const propsFor = <Props>(table: ChildTable, role: string): readonly Props[] =>
  // SAFETY: the role is the discriminant; carriers of one role always share one prop shape.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see SAFETY above
  (table.get(role) ?? []) as readonly Props[];

/** Children that are not config carriers (user components, custom SVG, a `useChart()` bridge) with their top-level position: rendered in the chart's SVG slot. */
export const customChildren = (children: ReactNode): { readonly position: number; readonly node: ReactElement }[] => {
  const out: { readonly position: number; readonly node: ReactElement }[] = [];
  forEachTopLevel(children, (child, position) => {
    if (roleOfType(child.type) === undefined) {
      out.push({ position, node: child });
    }
  });
  return out;
};

export const displayNameOf = (type: ReactElement["type"]): string | undefined => {
  if (isString(type)) {
    return undefined;
  }
  const displayName = "displayName" in type ? type.displayName : undefined;
  return isString(displayName) ? displayName : type.name;
};
