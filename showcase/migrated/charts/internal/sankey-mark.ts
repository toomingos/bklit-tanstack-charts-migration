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
//     sankey:vlabel:i. The reveal (sankey-animation.ts) DOM contract depends
//     on those keys; the D239 baseline-emulation math (d = fontSize*0.35)
//     lives here verbatim.
//   - Gradients: per-link userSpaceOnUse gradient DATUMS stay custom
//     (tanstack.md row 31 — %-coords frozen at definition cannot express
//     per-link geometry); their source coordinates read off the native rows
//     (sourceNode.x1 / targetNode.x0). Datum building moved into the marks()
//     callback (runs per layout pass) so link strokes never depend on
//     sibling-render order.
//   - Hover dim (C1 states+legend): connectivity is resolved once per marks()
//     pass (config.hoveredNodeIndex/hoveredLinkIndex, reactive — the owning
//     component rebuilds this whole mark via a useMemo keyed on hover state)
//     using sankey-hover-chrome.ts's pure connectivity helpers, then baked
//     directly into each node/label's resting style and into the native
//     link() mark's per-datum `strokeOpacity` channel. No DOM mutation, no
//     hover-time re-query — sankey-hover-chrome.ts now only supplies that
//     pure connectivity math plus the mouseenter/mouseleave listener wiring
//     that turns pointer input into hoveredNodeIndex/hoveredLinkIndex.

import { createMark, link } from "@tanstack/charts";
import type { ChartPoint, ChartValue, MarkRenderContext, SceneLabel, SceneNode } from "@tanstack/charts";
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
import { computeNodeHoverConnected, computeLinkHoverConnected } from "./sankey-hover-chrome";

export const SANKEY_MARK_ID = "sankey";
// C2 (tooltip): distinct markId for node ChartPoints (the native "flow"
// link mark already stamps its own points with markId "flow" — see
// dist/link.js). Lets the chart component's hover bridge / renderTooltipBody
// tell a node point from a link point via `point.markId`.
export const SANKEY_NODE_MARK_ID = "sankey-node";

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
  // Connectivity-based hover dim (C1 states+legend). Replaces the old
  // sankey-hover-chrome.ts DOM-mutation pass: the component now re-derives
  // this mark (via the `definition` useMemo, keyed on hover state) whenever
  // hover changes, so dim/boost is expressed as per-datum style/channel
  // values computed here instead of direct element.style writes.
  hoveredNodeIndex: number | null;
  hoveredLinkIndex: number | null;
  fadedNodeOpacity: number;
  fadedLinkOpacity: number;
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
  nodeConnected: readonly boolean[],
  anyHovered: boolean,
  fadedNodeOpacity: number,
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

    // Connectivity-based hover dim (see createSankeyMark's hover-config
    // fields). Name labels dim via `opacity` (resting value 1, implicit);
    // value labels dim via `fillOpacity` — the SAME property that already
    // carries their resting 0.6 dim — so the dim write REPLACES rather than
    // multiplies with that resting value, and stays clear of `opacity`,
    // which the WAAPI reveal (sankey-animation.ts) animates independently.
    const isDimmed = anyHovered && !nodeConnected[i];
    const nameOpacity = isDimmed ? fadedNodeOpacity : 1;
    const valueFillOpacity = isDimmed ? fadedNodeOpacity * 0.8 : 0.6;

    if (labelOrientation === "vertical") {
      const rotate = isLeftSide ? -90 : 90;
      const nameLocalX = showValueLabels !== false ? (isLeftSide ? halfGap : -halfGap) : 0;
      const valueLocalX = isLeftSide ? -halfGap : halfGap;
      pushLabel(labelX + nameLocalX, centerY, nodeName, "middle", 13, {
        key: `${SANKEY_MARK_ID}:nlabel:${i}`,
        rotate,
        fontWeight: 500,
        className: "bkm-sankey__label-name",
        style: { fill: "var(--foreground)", opacity: nameOpacity },
      });
      if (showValueLabels !== false) {
        pushLabel(labelX + valueLocalX, centerY, `${intFmt(displayVal)} sessions`, "middle", 11, {
          key: `${SANKEY_MARK_ID}:vlabel:${i}`,
          rotate,
          className: "bkm-sankey__label-value",
          style: { fill: "var(--foreground)", fillOpacity: valueFillOpacity },
        });
      }
    } else {
      const anchor = isLeftSide ? "end" : "start";
      pushLabel(labelX, centerY, nodeName, anchor, 13, {
        key: `${SANKEY_MARK_ID}:nlabel:${i}`,
        fontWeight: 500,
        className: "bkm-sankey__label-name",
        style: { fill: "var(--foreground)", opacity: nameOpacity },
      });
      if (showValueLabels !== false) {
        pushLabel(labelX, centerY + SANKEY_VALUE_LABEL_GAP, `${intFmt(displayVal)} sessions`, anchor, 11, {
          key: `${SANKEY_MARK_ID}:vlabel:${i}`,
          className: "bkm-sankey__label-value",
          style: { fill: "var(--foreground)", fillOpacity: valueFillOpacity },
        });
      }
    }
  }
  return labelNodes;
}

// D4: link hit-test geometry, threaded out to sankey-chart.tsx's pointermove
// handler the same way laidOutNodesRef already is. Populated straight from
// the resolved `links` rows' own x1/y1/x2/y2/width fields (network-sankey.d.ts
// — no extra layout computation needed) inside marks() below, once per
// layout pass, mirroring laidOutNodesRef's population site exactly.
export interface LaidOutLink {
  sourceIndex: number;
  targetIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export function createSankeyMark(
  data: { nodes: SankeyNodeData[]; links: SankeyLinkData[] },
  config: SankeyMarkConfig,
  gradientDataRef: { current: SankeyGradientDatum[] | null },
  laidOutNodesRef: { current: LaidOutNode[] | null },
  laidOutLinksRef: { current: LaidOutLink[] | null },
) {
  const {
    strokeOpacity,
    strokeOverride,
    useGradient,
    nodeColorFn,
    lineCap,
    nodeWidth,
    nodePadding,
    showLabels,
    showValueLabels,
    labelOrientation,
    hoveredNodeIndex,
    hoveredLinkIndex,
    fadedNodeOpacity,
    fadedLinkOpacity,
  } = config;
  const shouldUseGradient = useGradient && !strokeOverride;

  // Slim custom mark for nodes + labels (see header). Child id equals the
  // owner id ("sankey"), which passes through the compositor's namespace
  // identity untouched — all scene keys stay byte-identical.
  //
  // `nodeConnected`/`anyHovered` are this pass's resolved connectivity (see
  // marks() below) — dim is baked straight into each node/label's resting
  // style, replacing the old applySankeyHoverStyle DOM-mutation pass.
  const bodyMark = (
    laidOutNodes: readonly LaidOutNode[],
    links: readonly LinkRow[],
    nodeConnected: readonly boolean[],
    anyHovered: boolean,
  ) =>
    createMark(() => ({
      id: SANKEY_MARK_ID,
      channels: {},
      render: ({ chart }: MarkRenderContext) => {
        // ── Nodes (painted after the native flow layer, on top) ──
        // C2 (tooltip): one ChartPoint per node, anchored to the rect's
        // center. The custom bodyMark previously emitted no points at all
        // (unlike the native `link()` flow mark below, which always has),
        // so node hover had nothing for `interaction.setControlledFocus` /
        // the native tooltip extension to anchor to — this is what makes
        // node-hover tooltip adoption possible. `datum` is the same
        // `LaidOutNode` the getNodeColor callback contract already exposes.
        const nodePoints: ChartPoint<LaidOutNode>[] = [];
        const nodeScenes: SceneNode[] = laidOutNodes.map((node, index) => {
          const nodeX = node.x0 ?? 0;
          const nodeY = node.y0 ?? 0;
          const nodeW = Math.max(0, (node.x1 ?? 0) - nodeX);
          const nodeH = Math.max(0, (node.y1 ?? 0) - nodeY);
          const nodeOpacity = anyHovered && !nodeConnected[index] ? fadedNodeOpacity : 1;
          const nodeFill = nodeColorFn(node, index);

          nodePoints.push({
            key: `${SANKEY_MARK_ID}:node:${index}`,
            markId: SANKEY_NODE_MARK_ID,
            group: null,
            groupLabel: SANKEY_MARK_ID,
            datum: node,
            datumIndex: index,
            xValue: index,
            yValue: node.value ?? 0,
            x: nodeX + nodeW / 2,
            y: nodeY + nodeH / 2,
            color: nodeFill,
          });

          return {
            kind: "group" as const,
            key: `${SANKEY_MARK_ID}:node:${index}`,
            className: "bkm-sankey__node",
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
                  fill: nodeFill,
                  fillOpacity: 1,
                  opacity: nodeOpacity,
                },
                className: "bkm-sankey__node-rect",
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
          nodeConnected,
          anyHovered,
          fadedNodeOpacity,
        );

        return {
          nodes: [
            {
              kind: "group" as const,
              key: `${SANKEY_MARK_ID}:nodes`,
              className: "bkm-sankey__nodes",
              ariaHidden: true,
              children: nodeScenes,
            },
            ...(labelNodes.length > 0
              ? [
                  {
                    kind: "group" as const,
                    key: `${SANKEY_MARK_ID}:labels`,
                    className: "bkm-sankey__labels",
                    ariaHidden: true,
                    children: labelNodes,
                  },
                ]
              : []),
          ],
          // C2 (tooltip): scene.points aggregation (dist/scene.js
          // collectRenderedPoints) unions this directly-returned array with
          // whatever the sibling `link()` flow mark emits — node hover can
          // now resolve a real ChartPoint the same way link hover already
          // could.
          points: nodePoints,
        };
      },
      // D3 (C5 sankey reveal, sanctioned reach-in — see sankey-animation.ts's
      // header): node rects/labels stay driven by the WAAPI reveal helper,
      // NOT native motion. `false` here (createMark's second positional arg
      // — dist/mark.d.ts's `createMark(initialize, motion?, renderer?)`)
      // suppresses the automatic generic opacity-fade `enter` native motion
      // would otherwise apply to this custom mark's rect/label children, so
      // the two animation systems never race on the same `opacity` style.
    }), false);

  // Native host (T-D13). Numeric node keys — source/target on the raw links
  // ARE node indexes, and ChartKey admits finite numbers.
  return sankeyDiagram({
    id: "sankey",
    // D3 (C5 sankey reveal, sanctioned reach-in): belt-and-suspenders host-
    // level suppression alongside the two child-mark-level `motion: false`
    // settings above/below — `SankeyDiagramOptions extends
    // ChartMarkMotionOptions` (network-sankey.d.ts:86), so the composite
    // host itself could also seed a cascade default; explicit `false` here
    // guarantees no native motion reaches either child regardless of how
    // the composite-mark motion cascade resolves a host vs. child setting.
    motion: false,
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

      // D4: link hit-test rows — straight off the resolved LinkRow fields,
      // same order/indexing the strokeOpacity/stroke accessors below use.
      laidOutLinksRef.current = links.map((l) => ({
        sourceIndex: l.sourceIndex,
        targetIndex: l.targetIndex,
        x1: l.x1,
        y1: l.y1,
        x2: l.x2,
        y2: l.y2,
        width: l.width,
      }));

      // ── Hover connectivity (C1 states+legend) ──
      // Computed against the RESOLVED `links` rows (not the raw input array)
      // so `linkConnected[index]` always lines up with the `index` the
      // native link() mark's per-datum accessors receive below — the same
      // rows, same order, same indexing the existing gradient/stroke
      // accessors already rely on.
      const linkPairs = links.map((l) => ({ source: l.sourceIndex, target: l.targetIndex }));
      const { nodeConnected, linkConnected, anyHovered } =
        hoveredNodeIndex !== null
          ? computeNodeHoverConnected(hoveredNodeIndex, laidOutNodes.length, linkPairs)
          : computeLinkHoverConnected(hoveredLinkIndex, laidOutNodes.length, linkPairs);

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
          // D3 (C5 sankey reveal, sanctioned reach-in): the draw-on
          // (stroke-dasharray/dashoffset) that stampSankeyLinkPathLength +
          // runSankeyReveal drive isn't in the native motionAttributes
          // allowlist (dist/motion.js:1315-1336 — no stroke-dasharray/
          // dashoffset entry), so this stays a WAAPI-driven attribute no
          // native `motion` timing could express anyway; suppressed here so
          // native motion doesn't ALSO fade this mark's own opacity in
          // underneath the reach-in's draw-on, which would double-animate.
          motion: false,
          // Stroke width IS the data (flow value). lineCap "butt" matches the
          // previous area paths (native link defaults to round).
          strokeWidth: (flowRow) => Math.max(1, flowRow.width),
          lineCap: "butt",
          // T-D13: `strokeOpacity` is a per-datum VisualChannel on link()
          // (unlike the plain-number opacity options on the polar mark
          // family — see radar-chart.tsx), so connectivity-based hover
          // dim/boost is expressed here directly, no DOM mutation. Replaces
          // the old sankey-hover-chrome.ts pass writing `pathEl.style.
          // strokeOpacity` per element on every hover change.
          strokeOpacity: (flowRow, { index }) => {
            if (!anyHovered) return strokeOpacity;
            return linkConnected[index] ? Math.min(1, strokeOpacity * 1.3) : fadedLinkOpacity;
          },
          curve: SANKEY_CURVE,
          stroke: (flowRow, { index }) => {
            if (shouldUseGradient) return `url(#sankey-grad-${index})`;
            return strokeOverride ?? nodeColorFn(laidOutNodes[flowRow.sourceIndex], flowRow.sourceIndex);
          },
        }),
        bodyMark(laidOutNodes, links, nodeConnected, anyHovered),
      ] as const;
    },
  });
}
