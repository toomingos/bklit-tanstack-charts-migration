// Ceiling reference: d3-sankey layout (same lib bklit uses) via a custom positionless mark.
// GUARD: no sankey mark exists in TanStack; links are stroked centerlines, not filled ribbons.
import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyCenter, sankeyLinkHorizontal } from "d3-sankey";
import type {
  SankeyGraph,
  SankeyLink as D3SankeyLink,
  SankeyNode as D3SankeyNode,
} from "d3-sankey";
import { Chart } from "@tanstack/react-charts";
import { createMark, defineChart } from "@tanstack/charts";
import type { ChartMark, ChartValue, SceneNode } from "@tanstack/charts";
import {
  generateSankey,
  generateSankeyUpdate,
  getSankeyGateData,
  type SeededSankeyData,
  type SeededSankeyNode,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const SANKEY_PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#64748b",
];

const SANKEY_NODE_WIDTH = 16;
const SANKEY_NODE_PADDING = 24;

// unknown (not never) so it intersects cleanly with d3-sankey's link fields.
interface SankeyLinkExtra {
  [key: string]: unknown;
}
type LaidOutNode = D3SankeyNode<SeededSankeyNode, SankeyLinkExtra>;
type LaidOutLink = D3SankeyLink<SeededSankeyNode, SankeyLinkExtra>;

function sankeyDataForN(n: number): SeededSankeyData {
  if (n === 4 || n === 33) return getSankeyGateData(n);
  return generateSankey("sankey", n);
}

function layoutSankey(
  data: SeededSankeyData,
  bounds: { x: number; y: number; width: number; height: number },
): { nodes: LaidOutNode[]; links: LaidOutLink[] } {
  const layout = sankey<SeededSankeyNode, SankeyLinkExtra>()
    .nodeWidth(SANKEY_NODE_WIDTH)
    .nodePadding(SANKEY_NODE_PADDING)
    .nodeAlign(sankeyCenter)
    .extent([
      [bounds.x, bounds.y],
      [bounds.x + Math.max(1, bounds.width), bounds.y + Math.max(1, bounds.height)],
    ]);
  // d3-sankey mutates inputs; clone so re-layout starts from clean seeded data.
  const graph: SankeyGraph<SeededSankeyNode, SankeyLinkExtra> = {
    nodes: data.nodes.map((node) => ({ ...node })),
    links: data.links.map((link) => ({ ...link })),
  };
  return layout(graph);
}

// never scale ids let the spec pass x:null/y:null.
function sankeyCeilingMark(
  data: SeededSankeyData,
  id: string,
): ChartMark<unknown, ChartValue, ChartValue, ChartValue, ChartValue, never, never> {
  return createMark(() => ({
    id,
    channels: {},
    render: ({ chart }) => {
      const { nodes, links } = layoutSankey(data, chart);

      const linkPath = sankeyLinkHorizontal<SeededSankeyNode, SankeyLinkExtra>();
      const linkNodes: SceneNode[] = links.map((link, index) => {
        const sourceIndex =
          typeof link.source === "object" ? link.source.index ?? 0 : 0;
        return {
          kind: "area",
          key: `${id}:link:${index}`,
          points: [],
          path: linkPath(link) ?? undefined,
          style: {
            fill: "none",
            stroke:
              SANKEY_PALETTE[sourceIndex % SANKEY_PALETTE.length] ??
              SANKEY_PALETTE[0],
            strokeOpacity: 0.5,
            strokeWidth: Math.max(1, link.width ?? 1),
          },
        };
      });

      const nodeNodes: SceneNode[] = nodes.map((node, index) => ({
        kind: "rect",
        key: `${id}:node:${index}`,
        x: node.x0 ?? 0,
        y: node.y0 ?? 0,
        width: Math.max(0, (node.x1 ?? 0) - (node.x0 ?? 0)),
        height: Math.max(0, (node.y1 ?? 0) - (node.y0 ?? 0)),
        style: {
          fill: SANKEY_PALETTE[index % SANKEY_PALETTE.length] ?? SANKEY_PALETTE[0],
          fillOpacity: 1,
        },
      }));

      // Links first, nodes on top (bklit tree order).
      return {
        nodes: [
          {
            kind: "group",
            key: `${id}:links`,
            className: "ts-sankey__links",
            ariaHidden: true,
            children: linkNodes,
          },
          {
            kind: "group",
            key: `${id}:nodes`,
            className: "ts-sankey__nodes",
            ariaHidden: true,
            children: nodeNodes,
          },
        ],
      };
    },
  }));
}

export default function TanstackSankey({ n }: { n: number }) {
  const [data, setData] = useState<SeededSankeyData>(() => sankeyDataForN(n));
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateSankeyUpdate("sankey", n, tickRef.current));
      });
    // GUARD: n is link count; no live-append axis.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [sankeyCeilingMark(data, "sankey")],
        guides: false,
        scales: { x: null, y: null },
      }),
    [data],
  );

  return (
    <Chart
      ariaLabel="Sankey chart benchmark scenario"
      aspectRatio={16 / 9}
      definition={definition}
      onRender={onRender}
    />
  );
}
