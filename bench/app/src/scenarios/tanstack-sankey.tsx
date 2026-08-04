// ceiling-not-clone
//
// TanStack-native performance-ceiling reference for bklit's SankeyChart. No
// sankey mark exists anywhere in TanStack Charts (a genuine gap chart --
// docs/LOG.md D35), so this scenario runs d3-sankey's OWN layout algorithm
// directly -- the SAME library bklit's own SankeyChart uses internally
// (repos/bklit-ui/packages/ui/src/charts/sankey/sankey-chart.tsx:
// `sankey<...>().nodeWidth(nodeWidth).nodePadding(nodePadding)
// .nodeAlign(sankeyCenter).extent([[0,0],[innerWidth,innerHeight]])`) --
// against the chart's real pixel bounds (`MarkRenderContext.chart:
// ChartBounds`, exact width/height/x/y; no virtual-domain-to-scale mapping
// needed, same `x:null,y:null` idiom used by every other non-cartesian
// ceiling scenario here: tanstack-radar.tsx, tanstack-pie.tsx,
// tanstack-gauge.tsx, tanstack-sunburst.tsx). Baking `chart.x`/`chart.y`
// straight into d3-sankey's own `.extent(...)` bounds (rather than the
// origin-at-0 extent bklit uses internally) means every computed node/link
// coordinate is already in absolute chart space -- no separate translate
// step needed for either the `rect` nodes or the `sankeyLinkHorizontal()`
// path string.
//
// A minimal custom `createMark` (pattern: migrated/charts/internal/
// area-fill-mark.ts) emits:
//  - one `kind:'rect'` scene node per sankey node (D35's node-mark mapping).
//  - one `kind:'area'` scene node per sankey link, `path` from d3-sankey's
//    own `sankeyLinkHorizontal()` generator, NO fill (`fill:'none'`, stroke
//    only, `strokeWidth = link.width`) -- D35's link-mark mapping ("links
//    are STROKED cubic-Bezier centerlines...NOT filled ribbons -> migrated
//    link mark = kind:'area' + path + stroke styles").
// This renders the same node/path COUNT and layout geometry as bklit's real
// component for the same seeded data, with none of bklit's chrome: no
// hover-dim/connectivity highlighting, no framer-motion stagger reveal, no
// gradients, no real tooltip DOM, no category-gated "0 sessions" display-
// value bug. Same line every other ceiling scenario in this harness draws
// (tanstack-heatmap.tsx, tanstack-funnel.tsx, tanstack-composed.tsx):
// native/unstyled rendering, comparable geometry, NOT a pixel clone.
import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyCenter, sankeyLinkHorizontal } from "d3-sankey";
import type {
  SankeyGraph,
  SankeyLink as D3SankeyLink,
  SankeyNode as D3SankeyNode,
} from "d3-sankey";
import { Chart } from "@tanstack/react-charts";
import { createMark, defineChart } from "@tanstack/charts";
import type { ChartMark, SceneNode } from "@tanstack/charts";
import {
  generateSankey,
  generateSankeyUpdate,
  getSankeyGateData,
  type SeededSankeyData,
  type SeededSankeyNode,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Same convention as every other ceiling scenario (tanstack-pie.tsx,
// tanstack-radar.tsx): a small fixed hex cycle, NOT bklit's `--chart-1..5`
// CSS custom properties.
const SANKEY_PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#64748b",
];

// Matches the docs-demo tree's explicit overrides (repos/bklit-ui/apps/web/
// content/docs/components/sankey-chart.mdx) -- default nodeWidth=16/
// nodePadding=24 (sankey-chart.tsx `DEFAULT_MARGIN`/prop defaults).
const SANKEY_NODE_WIDTH = 16;
const SANKEY_NODE_PADDING = 24;

// Empty-ish "extra properties" type for d3-sankey's L generic -- an index
// signature of `unknown` (not `never`) so it doesn't conflict with
// `SankeyLinkMinimal`'s own typed `source`/`target`/`value`/etc fields when
// intersected (`SankeyLink<N,L> = L & SankeyLinkMinimal<N,L>`).
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
  // d3-sankey mutates its input node/link objects in place (the same reason
  // bklit's own sankey-chart.tsx defensively clones before calling the
  // generator) -- clone here too so re-running layout on a later render
  // always starts from the plain seeded data, never a previous layout's
  // leftover x0/x1/y0/y1/sourceLinks/targetLinks fields.
  const graph: SankeyGraph<SeededSankeyNode, SankeyLinkExtra> = {
    nodes: data.nodes.map((node) => ({ ...node })),
    links: data.links.map((link) => ({ ...link })),
  };
  return layout(graph);
}

function sankeyCeilingMark(data: SeededSankeyData, id: string): ChartMark {
  return createMark(() => ({
    id,
    // No cartesian channels: this mark positions everything itself from
    // d3-sankey's own layout output against real chart pixel bounds (see
    // header comment) -- same "positionless custom mark" shape as this
    // codebase's `polar()` container, just without that machinery.
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

      // Links drawn first, nodes on top -- matches bklit's own tree order
      // (`<SankeyLink /><SankeyNode />`, both gate fixtures).
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
    // Sankey's `n` is link count (D35), not a live-append time-series axis
    // -- no-op, matching tanstack-heatmap.tsx/tanstack-sunburst.tsx.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [sankeyCeilingMark(data, "sankey")],
        // Positionless custom mark -- no cartesian x/y scales or guides
        // (same idiom as every other non-cartesian ceiling scenario here).
        guides: false,
        x: null,
        y: null,
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
