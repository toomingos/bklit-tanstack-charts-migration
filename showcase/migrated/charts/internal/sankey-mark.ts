// Composite mark for Sankey — native sankeyDiagram() host (T-D13).
//
// Architecture:
//   - Layout: TanStack-native `sankeyDiagram()` (@tanstack/charts/network/
//     sankey) replaces the hand-rolled d3-sankey wrapper. It resolves
//     against live chart bounds in its own resolveLayout, builds private
//     working records (input rows are never mutated — network-sankey.ts
//     wraps rows via graph.nodes.map/graph.links.map and freezes output),
//     and hands immutable final-pixel node/link rows to the marks callback.
//     align "center" == the previous sankeyCenter; iterations default (6)
//     == d3-sankey's default == previous behavior.
//   - Links: native `link()` mark with `curve: d3Curve(curveBumpX)` —
//     d3-sankey's own sankeyLinkHorizontal is curveBumpX-based, so path
//     geometry is identical. Child id "flow" gives the link layer the
//     stable composited group key "sankey:flow" (populateLinkElements
//     queries that group; paths follow in data order). NOTE: the native
//     group carries class ts-chart__link, NOT ts-sankey__link — the
//     vector-effect override lives in styles.css keyed off the group key,
//     and the hover-transition injection targets the same selector.
//   - Nodes + labels: slim custom createMark. Child id equals the owner id
//     ("sankey"), which passes through the compositor's namespace identity
//     untouched, so every scene key below is byte-identical to the previous
//     implementation: sankey:node:i, sankey:rect:i, sankey:nlabel:i,
//     sankey:vlabel:i. The reveal (sankey-animation.ts) and hover chrome
//     (sankey-hover-chrome.ts) DOM contracts depend on those keys; the D239
//     baseline-emulation math (d = fontSize*0.35) lives here verbatim.
//   - Gradients: per-link userSpaceOnUse gradient DATUMS stay custom
//     (tanstack.md row 31 — %-coords frozen at definition cannot express
//     per-link geometry); their source coordinates read off the native rows
//     (sourceNode.x1 / targetNode.x0). Datum building moved into the marks()
//     callback (runs per layout pass) so link strokes never depend on
//     sibling-render order.

import { createMark, link } from "@tanstack/charts";
import type { ChartValue, MarkRenderContext, SceneLabel, SceneNode } from "@tanstack/charts";
import {
  sankeyDiagram,
  type SankeyLink as NativeSankeyLink,
  type SankeyNode as NativeSankeyNode,
} from "@tanstack/charts/network/sankey";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { curveBumpX } from "d3-shape";
import {
  SANKEY_LABEL_OFFSET,
  SANKEY_VALUE_LABEL_GAP,
  type LaidOutNode,
} from "./sankey-layout";
import { intFmt } from "./formatters";
import type { SankeyLabelOrientation } from "../sankey-chart";

export const SANKEY_MARK_ID = "sankey";

export interface SankeyMarkConfig {
  strokeOpacity: number;
  strokeOverride: string | undefined;
  useGradient: boolean;
  nodeColorFn: (node: LaidOutNode, index: number) => string;
  lineCap: number;
  nodeWidth: number;
  nodePadding: number;
  showLabels?: boolean;
  showValueLabels?: boolean;
  labelOrientation?: SankeyLabelOrientation;
}

export interface SankeyGradientDatum {
  index: number;
  id: string;
  x1: number;
  x2: number;
  sourceColor: string;
  targetColor: string;
}

interface SankeyNodeData {
  name: string;
  category?: string;
  [key: string]: unknown;
}

interface SankeyLinkData {
  source: number;
  target: number;
  value: number;
  [key: string]: unknown;
}

type NodeRow = NativeSankeyNode<SankeyNodeData, SankeyLinkData>;
type LinkRow = NativeSankeyLink<SankeyNodeData, SankeyLinkData>;

// d3-sankey-shaped view over a native layout row: spreads the raw datum
// top-level (d3-sankey augments input objects in place; the native layout
// keeps raw rows pristine, so that augmented surface is rebuilt here for
// consumers written against d3-sankey shapes). Keeps the getNodeColor
// public callback contract and laidOutNodesRef consumers unchanged.
function toLaidOutNode(row: NodeRow): LaidOutNode {
  return {
    ...(row.data as SankeyNodeData),
    index: row.index,
    value: row.value,
    x0: row.x0,
    x1: row.x1,
    y0: row.y0,
    y1: row.y1,
  } as LaidOutNode;
}

// Same aggregation as the retired getSankeyDisplayValue (bklit parity:
// source-category nodes sum outgoing flow; others sum incoming), reading
// native rows directly.
function sankeyDisplayValue(category: string | undefined, nodeIndex: number, links: readonly LinkRow[]): number {
  let v = 0;
  for (const l of links) {
    if (category === "source") {
      if (l.sourceIndex === nodeIndex) v += l.value ?? 0;
    } else if (l.targetIndex === nodeIndex) {
      v += l.value ?? 0;
    }
  }
  return v;
}

// d3-sankey's sankeyLinkHorizontal is curveBumpX-based; the native link()
// mark reproduces the exact same cubic path via d3Curve.
const SANKEY_CURVE = d3Curve(curveBumpX);

// Shared label builder — the single source of label geometry for render().
// Emits the same SceneLabel shapes as the previous implementation, including
// the D239 baseline emulation: bklit paints labels with dy="0.35em" on an
// alphabetic baseline; the renderer has no dy and its rotate() keeps the
// anchor point fixed, so bklit's dy displaces the anchor by the LINEAR part
// of the rotation applied to (0, d) where d = 0.35 * fontSize:
//   r = 0    -> (0,  d)  => emit (x,       y + d)
//   r = -90  -> (d,  0)  => emit (x + d,  y)
//   r = +90  -> (-d, 0)  => emit (x - d,  y)
function buildSankeyLabelNodes(
  laidOutNodes: readonly LaidOutNode[],
  links: readonly LinkRow[],
  chart: { x: number; width: number },
  showLabels: boolean,
  showValueLabels: boolean,
  labelOrientation: SankeyLabelOrientation,
): SceneNode[] {
  const labelNodes: SceneNode[] = [];
  if (!showLabels) return labelNodes;
  const halfGap = SANKEY_VALUE_LABEL_GAP / 2;
  const chartW = chart.width;
  const chartX = chart.x;
  const pushLabel = (
    x: number,
    y: number,
    text: string,
    anchor: "start" | "middle" | "end",
    fontSize: number,
    extra: { key: string } & Partial<SceneLabel>,
  ): void => {
    const d = fontSize * 0.35;
    const rotate = typeof extra.rotate === "number" ? extra.rotate : 0;
    let ex = x;
    let ey = y;
    if (rotate === -90) {
      ex = x + d;
    } else if (rotate === 90) {
      ex = x - d;
    } else {
      ey = y + d;
    }
    labelNodes.push({
      kind: "label" as const,
      x: ex,
      y: ey,
      text,
      anchor,
      fontSize,
      ...extra,
    });
  };
  for (let i = 0; i < laidOutNodes.length; i++) {
    const node = laidOutNodes[i]!;
    const nodeX = node.x0 ?? 0;
    const nodeY = node.y0 ?? 0;
    const nodeW = Math.max(0, (node.x1 ?? 0) - nodeX);
    const nodeH = Math.max(0, (node.y1 ?? 0) - nodeY);
    const centerY = nodeY + nodeH / 2;
    const isLeftSide = nodeX - chartX < chartW / 2;
    const nodeName = (node as { name: string }).name ?? `Node ${i}`;
    const labelX = isLeftSide ? nodeX - SANKEY_LABEL_OFFSET : nodeX + nodeW + SANKEY_LABEL_OFFSET;
    const displayVal = sankeyDisplayValue((node as { category?: string }).category, i, links);

    if (labelOrientation === "vertical") {
      const rotate = isLeftSide ? -90 : 90;
      const nameLocalX = showValueLabels !== false ? (isLeftSide ? halfGap : -halfGap) : 0;
      const valueLocalX = isLeftSide ? -halfGap : halfGap;
      pushLabel(labelX + nameLocalX, centerY, nodeName, "middle", 13, {
        key: `${SANKEY_MARK_ID}:nlabel:${i}`,
        rotate,
        fontWeight: 500,
        className: "ts-sankey__label-name",
        style: { fill: "var(--foreground)" },
      });
      if (showValueLabels !== false) {
        pushLabel(labelX + valueLocalX, centerY, `${intFmt(displayVal)} sessions`, "middle", 11, {
          key: `${SANKEY_MARK_ID}:vlabel:${i}`,
          rotate,
          className: "ts-sankey__label-value",
          style: { fill: "var(--foreground)", fillOpacity: 0.6 },
        });
      }
    } else {
      const anchor = isLeftSide ? "end" : "start";
      pushLabel(labelX, centerY, nodeName, anchor, 13, {
        key: `${SANKEY_MARK_ID}:nlabel:${i}`,
        fontWeight: 500,
        className: "ts-sankey__label-name",
        style: { fill: "var(--foreground)" },
      });
      if (showValueLabels !== false) {
        pushLabel(labelX, centerY + SANKEY_VALUE_LABEL_GAP, `${intFmt(displayVal)} sessions`, anchor, 11, {
          key: `${SANKEY_MARK_ID}:vlabel:${i}`,
          className: "ts-sankey__label-value",
          style: { fill: "var(--foreground)", fillOpacity: 0.6 },
        });
      }
    }
  }
  return labelNodes;
}

export function createSankeyMark(
  data: { nodes: SankeyNodeData[]; links: SankeyLinkData[] },
  config: SankeyMarkConfig,
  gradientDataRef: { current: SankeyGradientDatum[] | null },
  laidOutNodesRef: { current: LaidOutNode[] | null },
) {
  const { strokeOpacity, strokeOverride, useGradient, nodeColorFn, lineCap, nodeWidth, nodePadding, showLabels, showValueLabels, labelOrientation } = config;
  const shouldUseGradient = useGradient && !strokeOverride;

  // Slim custom mark for nodes + labels (see header). Child id equals the
  // owner id ("sankey"), which passes through the compositor's namespace
  // identity untouched — all scene keys stay byte-identical.
  const bodyMark = (laidOutNodes: readonly LaidOutNode[], links: readonly LinkRow[]) =>
    createMark(() => ({
      id: SANKEY_MARK_ID,
      channels: {},
      render: ({ chart }: MarkRenderContext) => {
        // ── Nodes (painted after the native flow layer, on top) ──
        const nodeScenes: SceneNode[] = laidOutNodes.map((node, index) => {
          const nodeX = node.x0 ?? 0;
          const nodeY = node.y0 ?? 0;
          const nodeW = Math.max(0, (node.x1 ?? 0) - nodeX);
          const nodeH = Math.max(0, (node.y1 ?? 0) - nodeY);

          return {
            kind: "group" as const,
            key: `${SANKEY_MARK_ID}:node:${index}`,
            className: "ts-sankey__node",
            ariaHidden: true,
            children: [
              {
                kind: "rect" as const,
                key: `${SANKEY_MARK_ID}:rect:${index}`,
                x: nodeX,
                y: nodeY,
                width: nodeW,
                height: nodeH,
                radius: lineCap,
                style: {
                  fill: nodeColorFn(node, index),
                  fillOpacity: 1,
                },
                className: "ts-sankey__node-rect",
              },
            ] as SceneNode[],
          };
        });

        // ── Labels (D239 baseline math via buildSankeyLabelNodes) ──
        const labelNodes = buildSankeyLabelNodes(
          laidOutNodes,
          links,
          chart,
          showLabels !== false,
          showValueLabels !== false,
          labelOrientation ?? "horizontal",
        );

        return {
          nodes: [
            {
              kind: "group" as const,
              key: `${SANKEY_MARK_ID}:nodes`,
              className: "ts-sankey__nodes",
              ariaHidden: true,
              children: nodeScenes,
            },
            ...(labelNodes.length > 0
              ? [
                  {
                    kind: "group" as const,
                    key: `${SANKEY_MARK_ID}:labels`,
                    className: "ts-sankey__labels",
                    ariaHidden: true,
                    children: labelNodes,
                  },
                ]
              : []),
          ],
        };
      },
    }));

  // Native host (T-D13). Numeric node keys — source/target on the raw links
  // ARE node indexes, and ChartKey admits finite numbers.
  return sankeyDiagram({
    id: "sankey",
    nodes: data.nodes,
    links: data.links,
    nodeKey: (node, { index }) => index,
    source: (linkDatum) => linkDatum.source,
    target: (linkDatum) => linkDatum.target,
    value: (linkDatum) => linkDatum.value,
    align: "center",
    nodeWidth,
    nodePadding,
    marks: ({ nodes, links }) => {
      const laidOutNodes = nodes.map(toLaidOutNode);
      laidOutNodesRef.current = laidOutNodes;

      // ── Gradients (custom — tanstack.md row 31) ──
      if (shouldUseGradient) {
        const gradients: SankeyGradientDatum[] = links.map((linkRow, index) => {
          const srcNode = laidOutNodes[linkRow.sourceIndex];
          const tgtNode = laidOutNodes[linkRow.targetIndex];
          return {
            index,
            id: `sankey-grad-${index}`,
            x1: srcNode?.x1 ?? 0,
            x2: tgtNode?.x0 ?? 100,
            sourceColor: nodeColorFn(srcNode, linkRow.sourceIndex),
            targetColor: nodeColorFn(tgtNode, linkRow.targetIndex),
          };
        });
        gradientDataRef.current = gradients;
      } else {
        gradientDataRef.current = null;
      }

      return [
        link(links, {
          id: "flow",
          x1: "x1",
          y1: "y1",
          x2: "x2",
          y2: "y2",
          // Stroke width IS the data (flow value). lineCap "butt" matches the
          // previous area paths (native link defaults to round).
          strokeWidth: (flowRow) => Math.max(1, flowRow.width),
          lineCap: "butt",
          strokeOpacity,
          curve: SANKEY_CURVE,
          stroke: (flowRow, { index }) => {
            if (shouldUseGradient) return `url(#sankey-grad-${index})`;
            return strokeOverride ?? nodeColorFn(laidOutNodes[flowRow.sourceIndex], flowRow.sourceIndex);
          },
        }),
        bodyMark(laidOutNodes, links),
      ] as const;
    },
  });
}
