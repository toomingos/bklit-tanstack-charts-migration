import { Fragment, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { HeatmapSeparator } from "./heatmap-components";
import type { HeatmapSeparatorProps } from "./heatmap-components";

// Child-traversal helpers for the heatmap surface, extracted so heatmap-chart-surface.tsx exports only its component.

// This is a type guard for React-element-props-shaped objects that expose a children field.
// It replaces an `as` cast so narrowing is real, not asserted.
// Its parameter is genuinely unknown: it is `ReactElement.props`, whose declared type is the element's own, often unrelated, prop type.
// There is no more specific domain type to accept before this function has established the shape itself.
const hasChildrenProp = <Subject>(props: Subject): props is Subject & { children?: ReactNode } =>
  typeof props === "object" && props !== null && "children" in props;

// This flattens ReactNode children the same way React.Children would, recursing into arrays and un-keyed top-level fragments, without depending on the React.Children API, which react/no-react-children disallows.
// Non-element nodes (strings, booleans, null, and so on) are dropped, matching the original isValidElement filtering every call site already applied.
const flattenChartChildren = (node: Readonly<ReactNode>): ReactElement[] => {
  if (Array.isArray(node)) {
    const items: readonly ReactNode[] = node;
    return items.flatMap((item) => flattenChartChildren(item));
  }
  if (!isValidElement(node)) {
    return [];
  }
  if (node.type === Fragment && hasChildrenProp(node.props)) {
    return flattenChartChildren(node.props.children);
  }
  return [node];
};

const isHeatmapSeparatorChild = (child: Readonly<ReactNode>): child is ReactElement<HeatmapSeparatorProps> =>
  isValidElement(child) && child.type === HeatmapSeparator;

export {
  hasChildrenProp,
  flattenChartChildren,
  isHeatmapSeparatorChild,
};
