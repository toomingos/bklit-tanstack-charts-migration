// Single createMark for Sankey — links + nodes in one mark.
// Matches tanstack-sankey.tsx ceiling scenario architecture.
// Eliminates dual-layout computation and layoutRef sharing hacks.

import { createMark } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import {
  computeSankeyLayout,
  SANKEY_LABEL_OFFSET,
  SANKEY_VALUE_LABEL_GAP,
  getSankeyDisplayValue,
  getSankeyNodeIndex,
  SANKEY_LINK_PATH,
  sankeyLinkPathLength,
  type LaidOutNode,
  type LaidOutLink,
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

export function createSankeyMark(
  data: { nodes: { name: string; category?: string; [key: string]: unknown }[]; links: { source: number; target: number; value: number; [key: string]: unknown }[] },
  config: SankeyMarkConfig,
  gradientDataRef: { current: SankeyGradientDatum[] | null },
): ChartMark {
  const { strokeOpacity, strokeOverride, useGradient, nodeColorFn, lineCap, nodeWidth, nodePadding, showLabels, showValueLabels, labelOrientation } = config;

  return createMark(() => ({
    id: SANKEY_MARK_ID,
    channels: {},
    render: ({ chart }) => {
      const resolvedLayout = computeSankeyLayout(data, chart, nodeWidth, nodePadding);

      const shouldUseGradient = useGradient && !strokeOverride;

      // ── Gradients ──
      if (shouldUseGradient) {
        const gradients: SankeyGradientDatum[] = resolvedLayout.links.map((link, index) => {
          const srcIdx = getSankeyNodeIndex((link as { source: LaidOutNode }).source);
          const tgtIdx = getSankeyNodeIndex((link as { target: LaidOutNode }).target);
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
        const srcIdx = getSankeyNodeIndex((link as { source: LaidOutNode }).source);
        const srcNode = resolvedLayout.nodes[srcIdx];
        const pathStr = SANKEY_LINK_PATH(link as Parameters<typeof SANKEY_LINK_PATH>[0]) ?? "";

        const linkStroke = shouldUseGradient
          ? `url(#sankey-grad-${index})`
          : (strokeOverride ?? nodeColorFn(srcNode, srcIdx));

        // Round UP: chord sampling always under-estimates arc length, and a dash
        // shorter than the path would leave a sub-pixel tail permanently ungrown.
        // A permanent "L L" dasharray at offset 0 is visually identical to no dash,
        // so this needs no cleanup after the reveal.
        const dashLen = Math.ceil(sankeyLinkPathLength(link as LaidOutLink)) + 1;

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
            strokeDasharray: `${dashLen} ${dashLen}`,
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

      // ── Labels as native SceneLabel nodes (bklit-verbatim via TanStack scene) ──
      // Replaces injected DOM labels: emit kind:'label' so TanStack's
      // guide-layout reserves margins and svg-renderer renders rotate/anchor natively.
      const labelNodes: SceneNode[] = [];
      if (showLabels !== false) {
        const orientation = labelOrientation ?? "vertical";
        const halfGap = SANKEY_VALUE_LABEL_GAP / 2;
        const chartW = chart.width;
        const chartX = chart.x;
        const pushLabel = (
          x: number,
          y: number,
          text: string,
          anchor: "start" | "middle" | "end",
          fontSize: number,
          extra: Partial<SceneNode> = {},
        ): void => {
          labelNodes.push({
            kind: "label" as const,
            x,
            y,
            text,
            anchor,
            baseline: "middle" as const,
            fontSize,
            ...extra,
          } as SceneNode);
        };
        for (let i = 0; i < resolvedLayout.nodes.length; i++) {
          const node = resolvedLayout.nodes[i];
          const nodeX = node.x0 ?? 0;
          const nodeY = node.y0 ?? 0;
          const nodeW = Math.max(0, (node.x1 ?? 0) - nodeX);
          const nodeH = Math.max(0, (node.y1 ?? 0) - nodeY);
          const centerY = nodeY + nodeH / 2;
          const isLeftSide = nodeX - chartX < chartW / 2;
          const nodeName = (node as { name: string }).name ?? `Node ${i}`;
          const labelX = isLeftSide ? nodeX - SANKEY_LABEL_OFFSET : nodeX + nodeW + SANKEY_LABEL_OFFSET;
          const displayVal = getSankeyDisplayValue(node, i, resolvedLayout.links);

          if (orientation === "horizontal") {
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
          } else {
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
          }
        }
      }

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
}
