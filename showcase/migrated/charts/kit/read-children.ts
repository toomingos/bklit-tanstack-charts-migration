// Reads config-carrier children into a role -> props[] table (fragments flattened).
// Anything without a chart role (e.g. legacy children owned by other charts) is ignored.
import { Children, createElement, Fragment, isValidElement } from "react";
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

// Declaration position of each carrier's props (bklit paints children in JSX order).
const declarationIndex = new WeakMap<WeakKey, number>();

export const readChildren = (children: ReactNode): ChildTable => {
  const table = new Map<string, Record<string, unknown>[]>();
  let index = 0;
  const visit = (node: ReactNode): void => {
    Children.forEach(node, (child) => {
      if (!isValidElement<CarrierProps>(child)) {
        return;
      }
      if (child.type === Fragment) {
        visit(child.props.children);
        return;
      }
      const role = roleOfType(child.type);
      if (role === undefined) {
        return;
      }
      declarationIndex.set(child.props, index);
      index += 1;
      const list = table.get(role);
      if (list === undefined) {
        table.set(role, [child.props]);
      } else {
        list.push(child.props);
      }
    });
  };
  visit(children);
  return table;
};

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

/** Children that are not config carriers (no chart role), such as a `useChart()` bridge: not compiled into the definition,
 * rendered inside the chart's context provider. */
export const passthroughChildren = (children: ReactNode): ReactNode[] => {
  const out: ReactNode[] = [];
  const visit = (node: ReactNode): void => {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode }>(child)) {
        return;
      }
      if (child.type === Fragment) {
        visit(child.props.children);
        return;
      }
      if (!isString(child.type) && roleOfType(child.type) === undefined) {
        out.push(createElement(Fragment, { key: out.length }, child));
      }
    });
  };
  visit(children);
  return out;
};

export const displayNameOf = (type: ReactElement["type"]): string | undefined => {
  if (isString(type)) {
    return undefined;
  }
  const displayName = "displayName" in type ? type.displayName : undefined;
  return isString(displayName) ? displayName : type.name;
};
