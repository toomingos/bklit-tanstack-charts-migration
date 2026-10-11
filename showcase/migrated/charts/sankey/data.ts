import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { displayNameOf } from "../kit/read-children";
import type { ChartPoint } from "@tanstack/charts";
import type { SankeyLinkProps } from "./link";
import type { SankeyNodeProps } from "./node";
import type { SankeyTooltipProps } from "./tooltip";
import type { SankeyData } from "./types";

/** The config carriers a SankeyChart reads from its children, by displayName. */
interface ChildPropsByName {
  readonly SankeyLink: SankeyLinkProps;
  readonly SankeyNode: SankeyNodeProps;
  readonly SankeyTooltip: SankeyTooltipProps;
}

const CARRIER_NAMES: ReadonlySet<string> = new Set<keyof ChildPropsByName>(["SankeyLink", "SankeyNode", "SankeyTooltip"]);

export const childProps = <Name extends keyof ChildPropsByName>(children: ReactNode, name: Name): ChildPropsByName[Name] | undefined => {
  const list: readonly ReactNode[] = Array.isArray(children) ? children : [children];
  const matches = list.filter((child): child is ReactElement<ChildPropsByName[Name]> => (isValidElement(child) ? displayNameOf(child.type) : undefined) === name);
  return matches.at(-1)?.props;
};

/** Whether a child is one of the config carriers (never rendered), as opposed to a `useSankey()` consumer. */
export const isConfigCarrier = (child: ReactNode): boolean => CARRIER_NAMES.has((isValidElement(child) ? displayNameOf(child.type) : undefined) ?? "");

export interface FocusRow {
  readonly key?: number;
  readonly value?: number;
  readonly data?: { readonly name?: string; readonly value?: number };
  readonly sourceNode?: { readonly data?: { readonly name?: string } };
  readonly targetNode?: { readonly data?: { readonly name?: string } };
  readonly sourceKey?: number;
  readonly targetKey?: number;
}

export const rowOf = (point: ChartPoint | undefined): FocusRow => (typeof point?.datum === "object" && point.datum !== null ? point.datum : {});

const valid = (value: number): boolean => Number.isFinite(value) && value >= 0;

// sankeyDiagram throws on a non-finite or negative link value and on a graph with no positive link (bklit draws NaN geometry).
// A bad value becomes a zero-width flow; with no positive flow at all the chart is the empty state.
export const sanitizeSankeyData = (data: SankeyData): SankeyData => {
  if (!data.links.some((link) => valid(link.value) && link.value > 0)) {return { links: [], nodes: [] };}
  return data.links.every((link) => valid(link.value))
    ? data
    : { links: data.links.map((link) => (valid(link.value) ? link : { ...link, value: 0 })), nodes: data.nodes };
};
