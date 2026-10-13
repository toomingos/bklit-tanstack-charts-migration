import { createElement, Fragment } from "react";
import type { ReactElement, ReactNode } from "react";
import type { ChartPoint } from "@tanstack/charts";
import { rowOf } from "./data";
import type { FocusRow } from "./data";
import { SANKEY_LINK_POINT_MARK_ID, SANKEY_NODE_POINT_MARK_ID } from "./focus";
import type { SankeyData, SankeyLinkDatum, SankeyPropLink, SankeyPropNode } from "./types";

// Config carrier: read once by SankeyChart, never rendered.
/** Props of `SankeyTooltip`. */
export interface SankeyTooltipProps {
  /** Custom tooltip content for a node. Receives the node and its index. */
  readonly nodeContent?: (props: { node: SankeyPropNode; index: number }) => ReactNode;
  /** Custom tooltip content for a link. Receives the link and its index. */
  readonly linkContent?: (props: { link: SankeyPropLink; index: number }) => ReactNode;
  /**
   * Formats the values in the default tooltip.
   * @default integer formatting
   */
  readonly formatValue?: (value: number) => string;
  /** Additional class name for the tooltip. */
  readonly className?: string;
}

/** Configures the tooltip shown on hover or keyboard focus. Renders nothing itself; `SankeyChart` reads its props. */
export const SankeyTooltip = (_props: Readonly<SankeyTooltipProps>): ReactElement => createElement(Fragment);
SankeyTooltip.displayName = "SankeyTooltip";

interface SankeyTooltipContent {
  readonly rows: readonly { readonly color: string; readonly label: string; readonly value: string }[];
  readonly title: string;
}

const endName = (end: FocusRow["sourceNode"], key: number | undefined): string => end?.data?.name ?? `Node ${key}`;

export const sankeyTooltipContent = (formatValue: (value: number) => string) => (points: readonly ChartPoint[]): SankeyTooltipContent => {
  const point = points.at(0);
  const row = rowOf(point);
  if (point?.markId === SANKEY_LINK_POINT_MARK_ID) {
    const title = `${endName(row.sourceNode, row.sourceKey)} → ${endName(row.targetNode, row.targetKey)}`;
    return { rows: [{ color: "var(--chart-foreground-muted)", label: "Flow", value: formatValue(row.data?.value ?? 0) }], title };
  }
  return {
    rows: [{ color: "var(--chart-line-primary)", label: "Sessions", value: formatValue(row.value ?? 0) }],
    title: row.data?.name ?? `Node ${point?.datumIndex ?? 0}`,
  };
};

// Custom ReactNode tooltip bodies (nodeContent / linkContent) ride the native tooltip's body slot.
// Always a body renderer: the native body wrapper carries the shared bklit panel + spring enter (styles.css).
export const sankeyTooltipBody = (data: SankeyData, config: SankeyTooltipProps | undefined) =>
  ({ points, defaultBody }: { readonly points: readonly ChartPoint[]; readonly defaultBody: ReactNode }): ReactNode => {
    const point = points.at(0);
    const row = rowOf(point);
    if (point?.markId === SANKEY_LINK_POINT_MARK_ID && config?.linkContent) {
      // SAFETY: a link point's datum is the sankey link row, a SankeyLinkDatum.
      const link = row.data as SankeyLinkDatum;
      const index = row.data ? data.links.indexOf(link) : 0;
      return config.linkContent({ index, link: { ...link, index } });
    }
    if (point?.markId.startsWith(SANKEY_NODE_POINT_MARK_ID) === true && config?.nodeContent) {
      const index = row.key ?? 0;
      return config.nodeContent({ index, node: { ...data.nodes[index], index, name: data.nodes[index]?.name ?? "", value: row.value } });
    }
    return defaultBody;
  };
