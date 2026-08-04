// Single createMark for Sankey — links + nodes in one mark.
// Matches tanstack-sankey.tsx ceiling scenario architecture.
// Eliminates dual-layout computation and layoutRef sharing hacks.

import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import {
  computeSankeyLayout,
  SANKEY_LINK_PATH,
  type LaidOutNode,
  type LaidOutLink,
  type SankeyLayoutOutput,
} from "./sankey-layout";

export const SANKEY_MARK_ID = "sankey";

export interface SankeyMarkConfig {
  strokeOpacity: number;
  strokeOverride: string | undefined;
  useGradient: boolean;
  nodeColorFn: (node: LaidOutNode, index: number) => string;
  lineCap: number;
  nodeWidth: number;
  nodePadding: number;
}

export interface SankeyGradientDatum {
  index: number;
  id: string;
  x1: number;
  x2: number;
  sourceColor: string;
  targetColor: string;
}

export function createSankeyMark(
  data: { nodes: { name: string; category?: string; [key: string]: unknown }[]; links: { source: number; target: number; value: number; [key: string]: unknown }[] },
  config: SankeyMarkConfig,
  gradientDataRef: { current: SankeyGradientDatum[] | null },
  layout: SankeyLayoutOutput | null,
): ChartMark {
  const { strokeOpacity, strokeOverride, useGradient, nodeColorFn, lineCap, nodeWidth, nodePadding } = config;

  return createMark(() => ({
    id: SANKEY_MARK_ID,
    channels: {},
    render: ({ chart }) => {
      const resolvedLayout = layout ?? computeSankeyLayout(data, chart, nodeWidth, nodePadding);

      const shouldUseGradient = useGradient && !strokeOverride;

      // ── Gradients ──
      if (shouldUseGradient) {
        const gradients: SankeyGradientDatum[] = resolvedLayout.links.map((link, index) => {
          const srcIdx = typeof link.source === "object" ? link.source.index ?? 0 : 0;
          const tgtIdx = typeof link.target === "object" ? link.target.index ?? 0 : 0;
          const srcNode = resolvedLayout.nodes[srcIdx];
          const tgtNode = resolvedLayout.nodes[tgtIdx];
          return {
            index,
            id: `sankey-grad-${index}`,
            x1: srcNode?.x1 ?? 0,
            x2: tgtNode?.x0 ?? 100,
            sourceColor: nodeColorFn(srcNode, srcIdx),
            targetColor: nodeColorFn(tgtNode, tgtIdx),
          };
        });
        gradientDataRef.current = gradients;
      } else {
        gradientDataRef.current = null;
      }

      // ── Links (rendered first, behind nodes) ──
      const linkNodes: SceneNode[] = resolvedLayout.links.map((link, index) => {
        const srcIdx = typeof link.source === "object" ? link.source.index ?? 0 : 0;
        const srcNode = resolvedLayout.nodes[srcIdx];
        const pathStr = SANKEY_LINK_PATH(link as Parameters<typeof SANKEY_LINK_PATH>[0]) ?? "";

        const linkStroke = shouldUseGradient
          ? `url(#sankey-grad-${index})`
          : (strokeOverride ?? nodeColorFn(srcNode, srcIdx));

        return {
          kind: "area" as const,
          key: `${SANKEY_MARK_ID}:link:${index}`,
          points: [],
          path: pathStr || undefined,
          className: "ts-sankey__link",
          style: {
            fill: "none",
            stroke: linkStroke,
            opacity: strokeOpacity,
            strokeWidth: Math.max(1, (link as { width?: number }).width ?? 1),
          },
        };
      });

      // ── Nodes (rendered second, on top of links) ──
      const nodeScenes: SceneNode[] = resolvedLayout.nodes.map((node, index) => {
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

      return {
        nodes: [
          {
            kind: "group" as const,
            key: `${SANKEY_MARK_ID}:links`,
            className: "ts-sankey__links",
            ariaHidden: true,
            children: linkNodes,
          },
          {
            kind: "group" as const,
            key: `${SANKEY_MARK_ID}:nodes`,
            className: "ts-sankey__nodes",
            ariaHidden: true,
            children: nodeScenes,
          },
        ],
      };
    },
  }));
}
