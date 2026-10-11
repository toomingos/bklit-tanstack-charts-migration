import { Children, Fragment, isValidElement } from "react";
import type { ReactNode } from "react";
import { CHART_ROLE } from "../kit/role";
import { stringValue } from "./narrow";

const SERIES_ROLES: ReadonlySet<string | undefined> = new Set(["line", "area", "seriesBar"]);

interface MarkLike {
  readonly id?: string;
}

/** dataKeys in tree order (bklit upserts: a later config for the same key keeps its slot). */
export function childOrder(children: ReactNode): string[] {
  const keys: string[] = [];
  const visit = (node: ReactNode): void => {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode; dataKey?: string }>(child)) {
        return;
      }
      if (child.type === Fragment) {
        visit(child.props.children);
        return;
      }
      // SAFETY: carriers tag their component with CHART_ROLE (kit/role.ts); any other element type reads as undefined.
      const role = (child.type as { readonly [CHART_ROLE]?: string })[CHART_ROLE];
      const key = stringValue(child.props.dataKey);
      if (SERIES_ROLES.has(role) && key !== undefined && !keys.includes(key)) {
        keys.push(key);
      }
    });
  };
  visit(children);
  return keys;
}

/** Paint order follows the JSX tree (the kit emits areas, then lines, then extras). */
export function orderSeriesMarks<M extends MarkLike>(marks: readonly M[], order: readonly string[]): M[] {
  const rank = (mark: M): number => {
    const id = mark.id ?? "";
    const match = /^(?:line|area|pattern|bar):(.+?)(?::fill(?::fade(?:-left|-right)?)?|:tail)?$/u.exec(id);
    if (id.startsWith("grid-")) {
      return -2;
    }
    if (!match || id.endsWith(":dot")) {
      return -1;
    }
    const index = order.indexOf(match[1]);
    return index === -1 ? order.length : index;
  };
  const guides = marks.filter((m) => rank(m) === -2);
  const series = marks.filter((m) => rank(m) >= 0);
  const rest = marks.filter((m) => rank(m) === -1);
  // Stable: within one dataKey an area stays beneath its line (kit order).
  series.sort((a, b) => rank(a) - rank(b));
  return [...guides, ...series, ...rest];
}
