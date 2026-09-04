import type { SceneLabel, SceneNode } from "@tanstack/charts";
import type { SankeyLink as NativeSankeyLink, SankeyNode as NativeSankeyNode } from "@tanstack/charts/network/sankey";
import { SANKEY_LABEL_OFFSET, SANKEY_VALUE_LABEL_GAP } from "./sankey-layout";
import type { LaidOutNode } from "./sankey-layout";
import { intFmt } from "./formatters";

// Sankey label scene nodes (name + value labels per node). Label scene keys
// The sankey:nlabel/vlabel:i keys are part of the WAAPI reveal's DOM contract.
const SANKEY_BASELINE_SHIFT_EM = 0.35;
const SANKEY_LABEL_ROTATE_CW = 90;
const SANKEY_DIMMED_VALUE_OPACITY_SCALE = 0.8;
const SANKEY_VALUE_LABEL_FILL_OPACITY = 0.6;
const SANKEY_NAME_FONT_SIZE = 13;
const SANKEY_VALUE_FONT_SIZE = 11;
const SANKEY_LABEL_FILL = "var(--foreground)";

type SankeyNodeData = {
  readonly name: string;
  readonly category?: string;
} & Partial<Record<string, unknown>>;

type SankeyLinkData = {
  readonly source: number;
  readonly target: number;
  readonly value: number;
} & Partial<Record<string, unknown>>;

type NodeRow = NativeSankeyNode<SankeyNodeData, SankeyLinkData>;
type LinkRow = NativeSankeyLink<SankeyNodeData, SankeyLinkData>;

interface LaidOutLink {
  readonly sourceIndex: number;
  readonly targetIndex: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  width: number;
}

const toLaidOutNode = (row: Readonly<NodeRow>): LaidOutNode => (
  {
    ...(row.data),
    index: row.index,
    value: row.value,
    x0: row.x0,
    x1: row.x1,
    y0: row.y0,
    y1: row.y1,
  }
);

const sankeyDisplayValue = (category: string | undefined, nodeIndex: number, links: readonly { readonly sourceIndex: number; readonly targetIndex: number; readonly value?: number }[]): number => {
  let total = 0;
  for (const linkRow of links) {
    const isSourceMatch = category === "source" && linkRow.sourceIndex === nodeIndex;
    const isTargetMatch = category !== "source" && linkRow.targetIndex === nodeIndex;
    if (isSourceMatch || isTargetMatch) {total += linkRow.value ?? 0;}
  }
  return total;
}

const resolveLabelSideOffset = (isLeftSide: boolean, halfGap: number): number => {
  if (isLeftSide) {return halfGap;}
  return -halfGap;
};

interface SankeyPushLabelParams {
  readonly sink: SceneNode[];
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly anchor: "start" | "middle" | "end";
  readonly fontSize: number;
  readonly extra: Readonly<{ key: string } & Partial<SceneLabel>>;
}

// Typeof checks live only in the predicate below; call sites use the guard.
// Generic parameter (same shape as composed-data-math) keeps `unknown` call sites compiling.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

const pushSankeyLabel = (params: Readonly<SankeyPushLabelParams>): void => {
  const { sink, x, y, text, anchor, fontSize, extra } = params;
  // No renderer dy support: emulate the 0.35em baseline offset via anchor displacement.
  const baselineShift = fontSize * SANKEY_BASELINE_SHIFT_EM;
  const rotate = isNumber(extra.rotate) ? extra.rotate : 0;
  let ex = x;
  let ey = y;
  if (rotate === -SANKEY_LABEL_ROTATE_CW) {
    ex = x + baselineShift;
  } else if (rotate === SANKEY_LABEL_ROTATE_CW) {
    ex = x - baselineShift;
  } else {
    ey = y + baselineShift;
  }
  sink.push({
    anchor,
    fontSize,
    kind: "label" as const,
    text,
    x: ex,
    y: ey,
    ...extra,
  });
};

interface SankeyNodeFrame {
  readonly nodeX: number;
  readonly nodeW: number;
  readonly centerY: number;
  readonly isLeftSide: boolean;
  readonly nodeName: string;
}

interface SankeyNodeFrameParams {
  readonly node: Omit<Readonly<LaidOutNode>, "name"> & { readonly name?: string };
  readonly index: number;
  readonly chartX: number;
  readonly chartWidth: number;
}

const resolveSankeyNodeFrame = (params: Readonly<SankeyNodeFrameParams>): SankeyNodeFrame => {
  const { node, index, chartX, chartWidth } = params;
  const nodeX = node.x0 ?? 0;
  const nodeY = node.y0 ?? 0;
  const nodeW = Math.max(0, (node.x1 ?? 0) - nodeX);
  const nodeH = Math.max(0, (node.y1 ?? 0) - nodeY);
  // LaidOutNode already carries name/category from the node datum generic.
  // No assertion is needed to read them.
  return {
    centerY: nodeY + nodeH / 2,
    isLeftSide: nodeX - chartX < chartWidth / 2,
    nodeName: node.name ?? `Node ${index}`,
    nodeW,
    nodeX,
  };
};

interface SankeyOrientedLabelParams {
  readonly sink: SceneNode[];
  readonly markId: string;
  readonly index: number;
  readonly frame: Readonly<SankeyNodeFrame>;
  readonly displayVal: number;
  readonly nameOpacity: number;
  readonly valueFillOpacity: number;
  readonly showValueLabels: boolean;
}

const pushVerticalSankeyLabels = (params: Readonly<SankeyOrientedLabelParams>): void => {
  const { sink, markId, index, frame, displayVal, nameOpacity, valueFillOpacity, showValueLabels } = params;
  const rotate = frame.isLeftSide ? -SANKEY_LABEL_ROTATE_CW : SANKEY_LABEL_ROTATE_CW;
  const halfGap = SANKEY_VALUE_LABEL_GAP / 2;
  const labelX = frame.isLeftSide ? frame.nodeX - SANKEY_LABEL_OFFSET : frame.nodeX + frame.nodeW + SANKEY_LABEL_OFFSET;
  pushSankeyLabel({
    anchor: "middle",
    extra: {
      className: "bkm-sankey__label-name",
      fontWeight: 500,
      key: `${markId}:nlabel:${index}`,
      rotate,
      style: { fill: SANKEY_LABEL_FILL, opacity: nameOpacity },
    },
    fontSize: SANKEY_NAME_FONT_SIZE,
    sink,
    text: frame.nodeName,
    x: labelX + (showValueLabels ? resolveLabelSideOffset(frame.isLeftSide, halfGap) : 0),
    y: frame.centerY,
  });
  if (showValueLabels) {
    pushSankeyLabel({
      anchor: "middle",
      extra: {
        className: "bkm-sankey__label-value",
        key: `${markId}:vlabel:${index}`,
        rotate,
        style: { fill: SANKEY_LABEL_FILL, fillOpacity: valueFillOpacity },
      },
      fontSize: SANKEY_VALUE_FONT_SIZE,
      sink,
      text: `${intFmt(displayVal)} sessions`,
      x: labelX + (frame.isLeftSide ? -halfGap : halfGap),
      y: frame.centerY,
    });
  }
};

const pushHorizontalSankeyLabels = (params: Readonly<SankeyOrientedLabelParams>): void => {
  const { sink, markId, index, frame, displayVal, nameOpacity, valueFillOpacity, showValueLabels } = params;
  const anchor = frame.isLeftSide ? "end" : "start";
  const labelX = frame.isLeftSide ? frame.nodeX - SANKEY_LABEL_OFFSET : frame.nodeX + frame.nodeW + SANKEY_LABEL_OFFSET;
  pushSankeyLabel({
    anchor,
    extra: {
      className: "bkm-sankey__label-name",
      fontWeight: 500,
      key: `${markId}:nlabel:${index}`,
      style: { fill: SANKEY_LABEL_FILL, opacity: nameOpacity },
    },
    fontSize: SANKEY_NAME_FONT_SIZE,
    sink,
    text: frame.nodeName,
    x: labelX,
    y: frame.centerY,
  });
  if (showValueLabels) {
    pushSankeyLabel({
      anchor,
      extra: {
        className: "bkm-sankey__label-value",
        key: `${markId}:vlabel:${index}`,
        style: { fill: SANKEY_LABEL_FILL, fillOpacity: valueFillOpacity },
      },
      fontSize: SANKEY_VALUE_FONT_SIZE,
      sink,
      text: `${intFmt(displayVal)} sessions`,
      x: labelX,
      y: frame.centerY + SANKEY_VALUE_LABEL_GAP,
    });
  }
};

interface SankeyLabelNodesParams {
  readonly laidOutNodes: readonly Readonly<LaidOutNode>[];
  readonly links: readonly Readonly<LinkRow>[];
  readonly chartX: number;
  readonly chartWidth: number;
  readonly markId: string;
  readonly showLabels: boolean;
  readonly showValueLabels: boolean;
  readonly labelOrientation: "horizontal" | "vertical";
  readonly nodeConnected: readonly boolean[];
  readonly anyHovered: boolean;
  readonly fadedNodeOpacity: number;
}

interface SankeyNodeLabelParams {
  readonly sink: SceneNode[];
  readonly markId: string;
  readonly index: number;
  readonly node: Readonly<LaidOutNode>;
  readonly links: readonly Readonly<LinkRow>[];
  readonly chartX: number;
  readonly chartWidth: number;
  readonly showValueLabels: boolean;
  readonly labelOrientation: "horizontal" | "vertical";
  readonly nodeConnected: readonly boolean[];
  readonly anyHovered: boolean;
  readonly fadedNodeOpacity: number;
}

const pushSankeyNodeLabels = (params: Readonly<SankeyNodeLabelParams>): void => {
  const frame = resolveSankeyNodeFrame({ chartWidth: params.chartWidth, chartX: params.chartX, index: params.index, node: params.node });
  const displayVal = sankeyDisplayValue(params.node.category, params.index, params.links);
  // Dim value labels via fillOpacity (resting 0.6 lives there); opacity belongs to the reveal.
  const isDimmed = params.anyHovered && !params.nodeConnected[params.index];
  const oriented: SankeyOrientedLabelParams = {
    displayVal,
    frame,
    index: params.index,
    markId: params.markId,
    nameOpacity: isDimmed ? params.fadedNodeOpacity : 1,
    showValueLabels: params.showValueLabels,
    sink: params.sink,
    valueFillOpacity: isDimmed ? params.fadedNodeOpacity * SANKEY_DIMMED_VALUE_OPACITY_SCALE : SANKEY_VALUE_LABEL_FILL_OPACITY,
  };
  if (params.labelOrientation === "vertical") {
    pushVerticalSankeyLabels(oriented);
  } else {
    pushHorizontalSankeyLabels(oriented);
  }
};

const buildSankeyLabelNodes = (params: Readonly<SankeyLabelNodesParams>): SceneNode[] => {
  const labelNodes: SceneNode[] = [];
  if (!params.showLabels) {return labelNodes;}
  for (let i = 0; i < params.laidOutNodes.length; i += 1) {
    const node = params.laidOutNodes.at(i);
    if (node !== undefined) {
      pushSankeyNodeLabels({
        anyHovered: params.anyHovered,
        chartWidth: params.chartWidth,
        chartX: params.chartX,
        fadedNodeOpacity: params.fadedNodeOpacity,
        index: i,
        labelOrientation: params.labelOrientation,
        links: params.links,
        markId: params.markId,
        node,
        nodeConnected: params.nodeConnected,
        showValueLabels: params.showValueLabels,
        sink: labelNodes,
      });
    }
  }
  return labelNodes;
};

export { buildSankeyLabelNodes, toLaidOutNode };
export type { LaidOutLink, LinkRow, NodeRow, SankeyLabelNodesParams, SankeyLinkData, SankeyNodeData };
