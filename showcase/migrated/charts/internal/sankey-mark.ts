import { createMark } from "@tanstack/charts";
import { link } from "@tanstack/charts/link";
import type { ChartBounds, ChartMark, ChartPoint, MarkInitialization, MarkScene, SceneNode } from "@tanstack/charts";
import { sankeyDiagram } from '@tanstack/charts/network/sankey';
import { d3Curve } from "@tanstack/charts/d3/shape";
import { curveBumpX } from "d3-shape";
import type { LaidOutNode } from './sankey-layout';
import { buildSankeyLabelNodes, toLaidOutNode } from "./sankey-label-nodes";
import { resolveSankeyFlowStroke, resolveSankeyFlowOpacity } from "./sankey-flow-style";
import type { LaidOutLink, LinkRow, NodeRow, SankeyLinkData, SankeyNodeData } from "./sankey-label-nodes";
import type { SankeyLabelOrientation } from "./sankey-node";
import { computeNodeHoverConnected, computeLinkHoverConnected } from "./sankey-hover-chrome";

// Scene keys sankey:node/rect/nlabel/vlabel:i are the WAAPI reveal's DOM contract.
const SANKEY_MARK_ID = "sankey";
const SANKEY_NODE_MARK_ID = "sankey-node";
const SANKEY_LINK_MARK_ID = "sankey:flow";
const SANKEY_NODE_POINT_MARK_ID = `sankey:${SANKEY_NODE_MARK_ID}`;
const SANKEY_GRADIENT_FALLBACK_X2 = 100;

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

interface SankeyGradientDatum {
  index: number;
  id: string;
  x1: number;
  x2: number;
  sourceColor: string;
  targetColor: string;
}

interface CreateSankeyMarkParams {
  readonly data: Readonly<{ nodes: readonly SankeyNodeData[]; links: readonly SankeyLinkData[] }>;
  readonly config: SankeyMarkConfig;
  readonly gradientDataRef: { current: SankeyGradientDatum[] | null };
  readonly laidOutNodesRef: { current: LaidOutNode[] | null };
  readonly laidOutLinksRef: { current: LaidOutLink[] | null };
}

const SANKEY_CURVE = d3Curve(curveBumpX);

interface SankeyNodeSceneInput {
  readonly node: Readonly<LaidOutNode>;
  readonly index: number;
  readonly nodeColorFn: (node: Readonly<LaidOutNode>, index: number) => string;
  readonly lineCap: number;
  readonly anyHovered: boolean;
  readonly connected: boolean;
  readonly fadedNodeOpacity: number;
}

interface SankeyNodeSceneOutput {
  readonly point: ChartPoint<LaidOutNode>;
  readonly scene: SceneNode;
}

const buildSankeyNodeScene = (params: Readonly<SankeyNodeSceneInput>): SankeyNodeSceneOutput => {
  const { node, index, nodeColorFn, lineCap, anyHovered, connected, fadedNodeOpacity } = params;
  const nodeX = node.x0 ?? 0;
  const nodeY = node.y0 ?? 0;
  const nodeW = Math.max(0, (node.x1 ?? 0) - nodeX);
  const nodeH = Math.max(0, (node.y1 ?? 0) - nodeY);
  const nodeFill = nodeColorFn(node, index);
  return {
    point: {
      color: nodeFill,
      datum: node,
      datumIndex: index,
      group: null,
      groupLabel: SANKEY_MARK_ID,
      key: `${SANKEY_MARK_ID}:node:${index}`,
      markId: SANKEY_NODE_MARK_ID,
      x: nodeX + nodeW / 2,
      xValue: index,
      y: nodeY + nodeH / 2,
      yValue: node.value ?? 0,
    },
    scene: {
      ariaHidden: true,
      children: [
        {
          className: "bkm-sankey__node-rect",
          height: nodeH,
          key: `${SANKEY_MARK_ID}:rect:${index}`,
          kind: "rect" as const,
          radius: lineCap,
          style: {
            fill: nodeFill,
            fillOpacity: 1,
            opacity: anyHovered && !connected ? fadedNodeOpacity : 1,
          },
          width: nodeW,
          x: nodeX,
          y: nodeY,
        },
      ],
      className: "bkm-sankey__node",
      key: `${SANKEY_MARK_ID}:node:${index}`,
      kind: "group" as const,
    },
  };
};

interface SankeyBodyMarkInput {
  readonly config: SankeyMarkConfig;
  readonly laidOutNodes: readonly Readonly<LaidOutNode>[];
  readonly links: readonly Readonly<LinkRow>[];
  readonly nodeConnected: readonly boolean[];
  readonly anyHovered: boolean;
}

const assembleSankeyBodyScene = (params: Readonly<{ nodeScenes: readonly SceneNode[]; labelNodes: readonly SceneNode[]; nodePoints: readonly ChartPoint<LaidOutNode>[] }>): MarkScene<LaidOutNode> => ({
  nodes: [
    {
      ariaHidden: true,
      children: [...params.nodeScenes],
      className: "bkm-sankey__nodes",
      key: `${SANKEY_MARK_ID}:nodes`,
      kind: "group" as const,
    },
    ...(params.labelNodes.length > 0
      ? [
          {
            ariaHidden: true,
            children: [...params.labelNodes],
            className: "bkm-sankey__labels",
            key: `${SANKEY_MARK_ID}:labels`,
            kind: "group" as const,
          },
        ]
      : []),
  ],
  points: [...params.nodePoints],
});

const createSankeyBodyMark = (params: Readonly<SankeyBodyMarkInput>): ChartMark<LaidOutNode> => createMark((): MarkInitialization<LaidOutNode> => ({
    channels: {},
    id: SANKEY_MARK_ID,
    render: ({ chart }: Readonly<{ chart: Readonly<ChartBounds> }>): MarkScene<LaidOutNode> => {
      const nodePoints: ChartPoint<LaidOutNode>[] = [];
      const nodeScenes: SceneNode[] = params.laidOutNodes.map((node: Readonly<LaidOutNode>, index: number) => {
        const { point, scene } = buildSankeyNodeScene({
          anyHovered: params.anyHovered,
          connected: params.nodeConnected[index] ?? false,
          fadedNodeOpacity: params.config.fadedNodeOpacity,
          index,
          lineCap: params.config.lineCap,
          node,
          nodeColorFn: params.config.nodeColorFn,
        });
        nodePoints.push(point);
        return scene;
      });

      const labelNodes = buildSankeyLabelNodes({
        anyHovered: params.anyHovered,
        chartWidth: chart.width,
        chartX: chart.x,
        fadedNodeOpacity: params.config.fadedNodeOpacity,
        labelOrientation: params.config.labelOrientation ?? "horizontal",
        laidOutNodes: params.laidOutNodes,
        links: params.links,
        markId: SANKEY_MARK_ID,
        nodeConnected: params.nodeConnected,
        showLabels: params.config.showLabels !== false,
        showValueLabels: params.config.showValueLabels !== false,
      });

      return assembleSankeyBodyScene({ labelNodes, nodePoints, nodeScenes });
    },
  }), false);

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

const refreshSankeyGradients = (params: Readonly<{ shouldUseGradient: boolean; links: readonly Readonly<LinkRow>[]; laidOutNodes: readonly Readonly<LaidOutNode>[]; nodeColorFn: (node: Readonly<LaidOutNode>, index: number) => string; gradientDataRef: { current: SankeyGradientDatum[] | null } }>): void => {
  if (!params.shouldUseGradient) {
    params.gradientDataRef.current = null;
    return;
  }
  params.gradientDataRef.current = params.links.map((linkRow: Readonly<LinkRow>, index: number) => {
    const srcNode = params.laidOutNodes[linkRow.sourceIndex];
    const tgtNode = params.laidOutNodes[linkRow.targetIndex];
    return {
      id: `sankey-grad-${index}`,
      index,
      sourceColor: params.nodeColorFn(srcNode, linkRow.sourceIndex),
      targetColor: params.nodeColorFn(tgtNode, linkRow.targetIndex),
      x1: srcNode.x1 ?? 0,
      x2: tgtNode.x0 ?? SANKEY_GRADIENT_FALLBACK_X2,
    };
  });
};

const snapshotSankeyLayout = (params: Readonly<{ nodes: readonly Readonly<NodeRow>[]; links: readonly Readonly<LinkRow>[]; laidOutNodesRef: { current: LaidOutNode[] | null }; laidOutLinksRef: { current: LaidOutLink[] | null } }>): LaidOutNode[] => {
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

const createSankeyMark = (params: Readonly<CreateSankeyMarkParams>): ReturnType<typeof sankeyDiagram> => {
  const { config } = params;
  const shouldUseGradient = config.useGradient && (config.strokeOverride ?? "") === "";

  return sankeyDiagram({
    id: "sankey",
    // Key order is load-bearing: sankeyDiagram's 7 const generics infer
    // TNode/TLink from the nodeKey/source/target/value accessors, and the
    // Marks callbacks' contextual types depend on that inference resolving
    // First — alphabetical order widens the mark datum X/Y and breaks the
    // RendererChart renderer prop type in sankey-chart.tsx (sort-keys waiver).
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
    marks: ({ nodes, links }) => {
      const laidOutNodes = snapshotSankeyLayout({ laidOutLinksRef: params.laidOutLinksRef, laidOutNodesRef: params.laidOutNodesRef, links, nodes });
      const { nodeConnected, linkConnected, anyHovered } =
        resolveSankeyHoverState({ hoveredLinkIndex: config.hoveredLinkIndex, hoveredNodeIndex: config.hoveredNodeIndex, links, nodeCount: laidOutNodes.length });
      refreshSankeyGradients({ gradientDataRef: params.gradientDataRef, laidOutNodes, links, nodeColorFn: config.nodeColorFn, shouldUseGradient });

      return [
        link(links, {
          curve: SANKEY_CURVE,
          id: "flow",
          lineCap: "butt",
          motion: false,
          stroke: (flowRow, { index }: Readonly<{ index: number }>) => resolveSankeyFlowStroke({ laidOutNodes, nodeColorFn: config.nodeColorFn, shouldUseGradient, strokeOverride: config.strokeOverride }, flowRow, index),
          strokeOpacity: (_flowRow, { index }: Readonly<{ index: number }>) => resolveSankeyFlowOpacity({ anyHovered, fadedLinkOpacity: config.fadedLinkOpacity, linkConnected, strokeOpacity: config.strokeOpacity }, index),
          strokeWidth: (flowRow) => Math.max(1, flowRow.width),
          x1: "x1",
          x2: "x2",
          y1: "y1",
          y2: "y2",
        }),
        createSankeyBodyMark({ anyHovered, config, laidOutNodes, links, nodeConnected }),
      ] as const;
    },
  });
}

export { createSankeyMark, SANKEY_LINK_MARK_ID, SANKEY_MARK_ID, SANKEY_NODE_MARK_ID, SANKEY_NODE_POINT_MARK_ID };
export type { SankeyGradientDatum, SankeyMarkConfig };
export type { LaidOutLink } from "./sankey-label-nodes";
