import { Children, Fragment, isValidElement } from "react";
import type { ReactNode } from "react";
import { roleOf } from "./children-extract";
import type { ReferenceAreaProps } from "../reference-area";

// Props bag for a collected <ReferenceArea> child: open-ended keys (any prop may be present).
// Value contract is the owner's own prop types.
type ReferenceAreaPropValue = ReferenceAreaProps[keyof ReferenceAreaProps];

type ReferenceAreaChildAction =
  | { readonly kind: "none" }
  | { readonly kind: "push"; readonly props: Record<string, ReferenceAreaPropValue> }
  | { readonly kind: "visit"; readonly node: ReactNode };

const referenceAreaPushProps = (child: ReactNode): Record<string, ReferenceAreaPropValue> | undefined => {
  if (!isValidElement<Record<string, ReferenceAreaPropValue>>(child)) {return undefined;}
  if (roleOf(child.type) !== "referenceArea") {return undefined;}
  return child.props;
};

const referenceAreaDescentNode = (child: ReactNode): ReactNode => {
  if (!isValidElement<{ children?: ReactNode }>(child)) {return undefined;}
  if (child.type === Fragment) {return child.props.children;}
  if (roleOf(child.type) === "referenceArea") {return undefined;}
  return child.props.children;
};

const classifyReferenceAreaChild = (child: ReactNode): ReferenceAreaChildAction => {
  const pushed = referenceAreaPushProps(child);
  if (pushed !== undefined) {return { kind: "push", props: pushed };}
  const descent = referenceAreaDescentNode(child);
  if (descent === undefined || descent === null) {return { kind: "none" };}
  return { kind: "visit", node: descent };
};

export const extractReferenceAreaProps = (children: ReactNode): Record<string, ReferenceAreaPropValue>[] => {
  const out: Record<string, ReferenceAreaPropValue>[] = [];
  const visit = (node: ReactNode): void => {
    for (const child of Children.toArray(node)) {
      const action = classifyReferenceAreaChild(child);
      if (action.kind === "push") {out.push(action.props);}
      if (action.kind === "visit") {visit(action.node);}
    }
  };
  visit(children);
  return out;
}
