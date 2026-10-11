import { Children, Fragment, isValidElement } from "react";
import type { ReactNode } from "react";
import { RadarArea } from "./area";
import type { RadarAreaProps } from "./area";
import { RadarAxis } from "./axis";
import type { RadarAxisProps } from "./axis";
import { RadarGrid } from "./grid";
import type { RadarGridProps } from "./grid";
import { RadarLabels } from "./labels";
import type { RadarLabelsProps } from "./labels";

interface Extracted {
  grid?: RadarGridProps;
  axis?: RadarAxisProps;
  labels?: RadarLabelsProps;
  areas: RadarAreaProps[];
}

interface FragmentProps { readonly children?: ReactNode }

const absorb = (out: Extracted, child: ReactNode, visit: (node: ReactNode) => void): void => {
  if (isValidElement<FragmentProps>(child) && child.type === Fragment) { visit(child.props.children); return; }
  if (isValidElement<RadarGridProps>(child) && child.type === RadarGrid) { out.grid = child.props; return; }
  if (isValidElement<RadarAxisProps>(child) && child.type === RadarAxis) { out.axis = child.props; return; }
  if (isValidElement<RadarLabelsProps>(child) && child.type === RadarLabels) { out.labels = child.props; return; }
  if (isValidElement<RadarAreaProps>(child) && child.type === RadarArea) { out.areas.push(child.props); }
};

export const extract = (children: ReactNode): Extracted => {
  const out: Extracted = { areas: [] };
  const visit = (node: ReactNode): void => {
    for (const child of Children.toArray(node)) { absorb(out, child, visit); }
  };
  visit(children);
  return out;
};
