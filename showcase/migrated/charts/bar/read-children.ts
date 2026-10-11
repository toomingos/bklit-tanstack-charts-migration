// Like the kit's `readChildren`, but also descends into <BarDepthProvider>.
import { Children, Fragment, isValidElement } from "react";
import type { ReactNode } from "react";
import { readChildren } from "../kit/read-children";
import type { ChildTable } from "../kit/read-children";
import { CHART_ROLE } from "../kit/role";
import type { CarrierComponent } from "../kit/role";

export function readBarChildren(children: ReactNode): ChildTable {
  const flat: ReactNode[] = [];
  const visit = (node: ReactNode): void => {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode }>(child)) {
        return;
      }
      if (child.type === Fragment) {
        visit(child.props.children);
        return;
      }
      flat.push(child);
      if ((child.type as CarrierComponent<object>)[CHART_ROLE] === "barDepthProvider") {
        visit(child.props.children);
      }
    });
  };
  visit(children);
  return readChildren(flat);
}
