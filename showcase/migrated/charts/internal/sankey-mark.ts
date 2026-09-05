import type { RefObject } from "react";
import { link } from "@tanstack/charts/link";
import { rect } from "@tanstack/charts/rect";
import { text } from "@tanstack/charts/text";
import type { ChartPoint, ChartSpatialIndex, ChartValue } from "@tanstack/charts";
import { sankeyDiagram } from '@tanstack/charts/network/sankey';
import { d3Curve } from "@tanstack/charts/d3/shape";
import { curveBumpX } from "d3-shape";
import type { LaidOutNode } from './sankey-layout';
import { SANKEY_LABEL_OFFSET, SANKEY_VALUE_LABEL_GAP } from "./sankey-layout";
import {
  formatSankeyValueLabel,
  resolveSankeyNodeFrame,
  sankeyDisplayValue,
  toLaidOutNode,
  SANKEY_DIMMED_VALUE_OPACITY_SCALE,
  SANKEY_LABEL_FILL,
  SANKEY_LABEL_ROTATE_CW,
  SANKEY_NAME_FONT_SIZE,
  SANKEY_VALUE_FONT_SIZE,
  SANKEY_VALUE_LABEL_FILL_OPACITY,
} from "./sankey-label-nodes";
import type { LaidOutLink, LinkRow, NodeRow, SankeyLinkData, SankeyNodeData } from "./sankey-label-nodes";
import { resolveSankeyFlowStroke } from "./sankey-flow-style";
import type { SankeyLabelOrientation } from "./sankey-node";
import { computeNodeHoverConnected, computeLinkHoverConnected, findHoveredSankeyTarget } from "./sankey-hover-chrome";
import { withStates } from "./with-states";

// Scene keys sankey:nlabel/vlabel:i are the WAAPI reveal's DOM contract.
const SANKEY_NODE_MARK_ID = "sankey-node";
const SANKEY_LINK_MARK_ID = "sankey:flow";
const SANKEY_NODE_POINT_MARK_ID = `sankey:${SANKEY_NODE_MARK_ID}`;
const SANKEY_NAME_LABEL_MARK_ID = "nlabel";
const SANKEY_VALUE_LABEL_MARK_ID = "vlabel";

// Rect fill is constant. Per-datum paint rides the color channel instead.
const sankeyIdentityColorScale = Object.assign(
  (value: string): string => value,
  { copy: () => sankeyIdentityColorScale },
);

interface SankeyMarkConfig {
  readonly strokeOpacity: number;
  readonly strokeOverride: string | undefined;
  readonly useGradient: boolean;
  readonly nodeColorFn: (node: Readonly<LaidOutNode>, index: number) => string;
  readonly lineCap: number;
  readonly nodeWidth: number;
  readonly nodePadding: number;
  readonly showLabels?: boolean;
  readonly showValueLabels?: boolean;
  readonly labelOrientation?: SankeyLabelOrientation;
  readonly hoveredNodeIndex: number | null;
  readonly hoveredLinkIndex: number | null;
  readonly fadedNodeOpacity: number;
  readonly fadedLinkOpacity: number;
}

interface CreateSankeyMarkParams {
  readonly data: Readonly<{ nodes: readonly SankeyNodeData[]; links: readonly SankeyLinkData[] }>;
  readonly config: SankeyMarkConfig;
  readonly laidOutNodesRef: RefObject<LaidOutNode[] | null>;
  readonly laidOutLinksRef: RefObject<LaidOutLink[] | null>;
}

const SANKEY_CURVE = d3Curve(curveBumpX);

// Fraction-to-percent scale for alpha-baked dim fills.
const PERCENT_SCALE = 100;
// Connected-flow hover boost (legacy sankey-link.tsx getTargetOpacity).
const SANKEY_HOVER_STROKE_BOOST = 1.3;

// Legacy alphabetic `dy=0.35em` minus the package's fixed middle baseline (0.2656em, Geist, measured; D536).
// Applied in screen space like legacy: +x at -90, -x at +90, +y unrotated.
const SANKEY_LABEL_BASELINE_RESIDUAL_EM = 0.0844;

interface SankeyLabelBaselineShift {
  readonly dx: number;
  readonly dy: number;
}

const sankeyLabelBaselineShift = (fontSize: number, rotate: number): SankeyLabelBaselineShift => {
  const shift = fontSize * SANKEY_LABEL_BASELINE_RESIDUAL_EM;
  if (rotate === -SANKEY_LABEL_ROTATE_CW) {return { dx: shift, dy: 0 };}
  if (rotate === SANKEY_LABEL_ROTATE_CW) {return { dx: -shift, dy: 0 };}
  return { dx: 0, dy: shift };
};

// Alpha-baked fills match the legacy element opacity.
// Single-paint elements (node rects, labels) carry no stroke.
const applySankeyDimAlpha = (color: string, alpha: number): string => {
  if (alpha >= 1) {return color;}
  return `color-mix(in srgb, ${color} ${Math.round(alpha * PERCENT_SCALE)}%, transparent)`;
};

interface SankeyLabelPlacement {
  readonly nameX: number;
  readonly nameY: number;
  readonly valueX: number;
  readonly valueY: number;
  readonly anchor: "start" | "middle" | "end";
  readonly rotate: number;
  readonly nameText: string;
  readonly valueText: string;
  readonly nameFill: string;
  readonly valueFill: string;
}

interface SankeyLabelPlacementParams {
  readonly laidOutNodes: readonly Readonly<LaidOutNode>[];
  readonly links: readonly Readonly<LinkRow>[];
  readonly chartX: number;
  readonly chartWidth: number;
  readonly labelOrientation: "horizontal" | "vertical";
  readonly nodeConnected: readonly boolean[];
  readonly anyHovered: boolean;
  readonly fadedNodeOpacity: number;
  readonly showValueLabels: boolean;
}

// The package text mark centers on a middle baseline natively.
// It replaces the legacy 0.35em alphabetic-baseline emulation.
const placeSankeyLabels = (params: Readonly<SankeyLabelPlacementParams>): SankeyLabelPlacement[] => {
  const { laidOutNodes, links, chartX, chartWidth, labelOrientation, nodeConnected, anyHovered, fadedNodeOpacity, showValueLabels } = params;
  return laidOutNodes.map((node, index) => {
    const frame = resolveSankeyNodeFrame({ chartWidth, chartX, index, node });
    const displayVal = sankeyDisplayValue(node.category, index, links);
    const isDimmed = anyHovered && !(nodeConnected[index] ?? false);
    const nameFill = isDimmed ? applySankeyDimAlpha(SANKEY_LABEL_FILL, fadedNodeOpacity) : SANKEY_LABEL_FILL;
    let valueFill = applySankeyDimAlpha(SANKEY_LABEL_FILL, SANKEY_VALUE_LABEL_FILL_OPACITY);
    if (isDimmed) {
      valueFill = applySankeyDimAlpha(SANKEY_LABEL_FILL, fadedNodeOpacity * SANKEY_DIMMED_VALUE_OPACITY_SCALE);
    }
    const nameText = frame.nodeName;
    const valueText = formatSankeyValueLabel(displayVal);
    if (labelOrientation === "vertical") {
      const rotate = frame.isLeftSide ? -SANKEY_LABEL_ROTATE_CW : SANKEY_LABEL_ROTATE_CW;
      const halfGap = SANKEY_VALUE_LABEL_GAP / 2;
      const labelX = frame.isLeftSide ? frame.nodeX - SANKEY_LABEL_OFFSET : frame.nodeX + frame.nodeW + SANKEY_LABEL_OFFSET;
      let nameShift = 0;
      if (showValueLabels) {
        nameShift = frame.isLeftSide ? halfGap : -halfGap;
      }
      return {
        anchor: "middle",
        nameFill,
        nameText,
        nameX: labelX + nameShift,
        nameY: frame.centerY,
        rotate,
        valueFill,
        valueText,
        valueX: labelX + (frame.isLeftSide ? -halfGap : halfGap),
        valueY: frame.centerY,
      };
    }
    const anchor = frame.isLeftSide ? "end" : "start";
    const labelX = frame.isLeftSide ? frame.nodeX - SANKEY_LABEL_OFFSET : frame.nodeX + frame.nodeW + SANKEY_LABEL_OFFSET;
    return {
      anchor,
      nameFill,
      nameText,
      nameX: labelX,
      nameY: frame.centerY,
      rotate: 0,
      valueFill,
      valueText,
      valueX: labelX,
      valueY: frame.centerY + SANKEY_VALUE_LABEL_GAP,
    };
  });
};

interface SankeyHoverState {
  readonly nodeConnected: readonly boolean[];
  readonly linkConnected: readonly boolean[];
  readonly anyHovered: boolean;
}

const resolveSankeyHoverState = (params: Readonly<{ hoveredNodeIndex: number | null; hoveredLinkIndex: number | null; nodeCount: number; links: readonly Readonly<LinkRow>[] }>): SankeyHoverState => {
  const linkPairs = params.links.map((linkRow: Readonly<LinkRow>) => ({ source: linkRow.sourceIndex, target: linkRow.targetIndex }));
  if (params.hoveredNodeIndex === null) {
    return computeLinkHoverConnected(params.hoveredLinkIndex, params.nodeCount, linkPairs);
  }
  return computeNodeHoverConnected(params.hoveredNodeIndex, params.nodeCount, linkPairs);
};

const snapshotSankeyLayout = (params: Readonly<{ nodes: readonly Readonly<NodeRow>[]; links: readonly Readonly<LinkRow>[]; laidOutNodesRef: RefObject<LaidOutNode[] | null>; laidOutLinksRef: { current: LaidOutLink[] | null } }>): LaidOutNode[] => {
  const laidOutNodes = params.nodes.map((node) => toLaidOutNode(node));
  params.laidOutNodesRef.current = laidOutNodes;
  params.laidOutLinksRef.current = params.links.map((linkRow: Readonly<LinkRow>) => ({
    sourceIndex: linkRow.sourceIndex,
    targetIndex: linkRow.targetIndex,
    width: linkRow.width,
    x1: linkRow.x1,
    x2: linkRow.x2,
    y1: linkRow.y1,
    y2: linkRow.y2,
  }));
  return laidOutNodes;
};

// Legacy pick order as a ChartSpatialIndex (focus-and-interaction.md: spatial indexes).
const createSankeySpatialIndex = <TDatum, TXValue extends ChartValue, TYValue extends ChartValue>(
  points: readonly ChartPoint<TDatum, TXValue, TYValue>[],
  nodes: readonly LaidOutNode[],
  links: readonly LaidOutLink[],
): ChartSpatialIndex<TDatum, TXValue, TYValue> => ({
  findNearest: (x, y) => {
    const hit = findHoveredSankeyTarget({ x, y }, nodes, links);
    if (!hit) {return null;}
    const markId = hit.type === "node" ? SANKEY_NODE_POINT_MARK_ID : SANKEY_LINK_MARK_ID;
    return points.find((point) => point.markId === markId && point.datumIndex === hit.index) ?? null;
  },
});

const createSankeyMark = (params: Readonly<CreateSankeyMarkParams>): ReturnType<typeof sankeyDiagram> => {
  const { config } = params;
  const shouldUseGradient = config.useGradient && (config.strokeOverride ?? "") === "";

  return sankeyDiagram({
    id: "sankey",
    /*
     * Key order is load-bearing: accessors must precede marks so const generics resolve TNode/TLink first.
     * Alphabetical order widens mark datum X/Y and breaks the renderer prop type in sankey-chart.tsx.
     */
    motion: false,
    nodes: params.data.nodes,
    links: params.data.links,
    nodeKey: (_node, { index }) => index,
    source: (linkDatum) => linkDatum.source,
    target: (linkDatum) => linkDatum.target,
    value: (linkDatum) => linkDatum.value,
    align: "center",
    nodeWidth: config.nodeWidth,
    nodePadding: config.nodePadding,
    marks: ({ chart, nodes, links }) => {
      const laidOutNodes = snapshotSankeyLayout({ laidOutLinksRef: params.laidOutLinksRef, laidOutNodesRef: params.laidOutNodesRef, links, nodes });
      const { nodeConnected, linkConnected, anyHovered } =
        resolveSankeyHoverState({ hoveredLinkIndex: config.hoveredLinkIndex, hoveredNodeIndex: config.hoveredNodeIndex, links, nodeCount: laidOutNodes.length });

      const nodeFill = (index: number): string =>
        config.nodeColorFn(laidOutNodes[index], index);

      const flowMark = withStates(link(links, {
        curve: SANKEY_CURVE,
        id: "flow",
        lineCap: "butt",
        motion: false,
        stroke: (flowRow, { index }: Readonly<{ index: number }>) => resolveSankeyFlowStroke({ laidOutNodes, nodeColorFn: config.nodeColorFn, shouldUseGradient, strokeOverride: config.strokeOverride }, flowRow, index),
        strokeOpacity: config.strokeOpacity,
        strokeWidth: (flowRow) => Math.max(1, flowRow.width),
        x1: "x1",
        x2: "x2",
        y1: "y1",
        y2: "y2",
      }), links, [{
        style: { strokeOpacity: config.fadedLinkOpacity },
        transition: { duration: 150, easing: "ease-out", type: "tween" },
        when: (context): boolean => !context.matches("group") && !(linkConnected[context.index] ?? false),
      }, {
        // Legacy sankey-link.tsx: highlighted flows paint at min(1, strokeOpacity * 1.3).
        style: { strokeOpacity: Math.min(1, config.strokeOpacity * SANKEY_HOVER_STROKE_BOOST) },
        transition: { duration: 150, easing: "ease-out", type: "tween" },
        when: (context): boolean => anyHovered && (linkConnected[context.index] ?? false),
      }]);

      const nodeMark = withStates(rect(nodes, {
        color: (_row, { index }: Readonly<{ index: number }>) => nodeFill(index),
        id: SANKEY_NODE_MARK_ID,
        inset: 0,
        key: "key",
        motion: false,
        radius: config.lineCap,
        x1: "x0",
        x2: "x1",
        y1: "y0",
        y2: "y1",
      }), nodes, [{
        style: { opacity: config.fadedNodeOpacity },
        transition: { duration: 150, easing: "ease-out", type: "tween" },
        when: (context): boolean => !context.matches("group") && !(nodeConnected[context.index] ?? false),
      }]);

      if (config.showLabels === false) {
        return [flowMark, nodeMark] as const;
      }
      const placements = placeSankeyLabels({
        anyHovered,
        chartWidth: chart.width,
        chartX: chart.x,
        fadedNodeOpacity: config.fadedNodeOpacity,
        labelOrientation: config.labelOrientation ?? "horizontal",
        laidOutNodes,
        links,
        nodeConnected,
        showValueLabels: config.showValueLabels !== false,
      });
      const nameMark = text(nodes, {
        anchor: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.anchor ?? "middle",
        dx: (_row, { index }: Readonly<{ index: number }>) => sankeyLabelBaselineShift(SANKEY_NAME_FONT_SIZE, placements[index]?.rotate ?? 0).dx,
        dy: (_row, { index }: Readonly<{ index: number }>) => sankeyLabelBaselineShift(SANKEY_NAME_FONT_SIZE, placements[index]?.rotate ?? 0).dy,
        fill: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.nameFill ?? SANKEY_LABEL_FILL,
        fontSize: SANKEY_NAME_FONT_SIZE,
        fontWeight: 500,
        id: SANKEY_NAME_LABEL_MARK_ID,
        key: "key",
        motion: false,
        rotate: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.rotate ?? 0,
        text: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.nameText ?? "",
        x: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.nameX ?? 0,
        y: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.nameY ?? 0,
      });
      if (config.showValueLabels === false) {
        return [flowMark, nodeMark, nameMark] as const;
      }
      const valueMark = text(nodes, {
        anchor: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.anchor ?? "middle",
        dx: (_row, { index }: Readonly<{ index: number }>) => sankeyLabelBaselineShift(SANKEY_VALUE_FONT_SIZE, placements[index]?.rotate ?? 0).dx,
        dy: (_row, { index }: Readonly<{ index: number }>) => sankeyLabelBaselineShift(SANKEY_VALUE_FONT_SIZE, placements[index]?.rotate ?? 0).dy,
        fill: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.valueFill ?? SANKEY_LABEL_FILL,
        fontSize: SANKEY_VALUE_FONT_SIZE,
        id: SANKEY_VALUE_LABEL_MARK_ID,
        key: "key",
        motion: false,
        rotate: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.rotate ?? 0,
        text: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.valueText ?? "",
        x: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.valueX ?? 0,
        y: (_row, { index }: Readonly<{ index: number }>) => placements[index]?.valueY ?? 0,
      });
      return [flowMark, nodeMark, nameMark, valueMark] as const;
    },
  });
}

export { createSankeyMark, createSankeySpatialIndex, sankeyIdentityColorScale, SANKEY_LINK_MARK_ID, SANKEY_NODE_POINT_MARK_ID };
export type { SankeyMarkConfig };
export type { LaidOutLink } from "./sankey-label-nodes";
