// Faithful port of two bklit-ui sources, chosen by `n` (n = LINK COUNT,
// docs/LOG.md D35):
//  - n=4  -> repos/bklit-ui/packages/ui/registry/examples/sankey-chart.tsx's
//            component tree, VERBATIM (no nodeWidth/nodePadding/lineCap/
//            labelOrientation overrides).
//  - all other n (incl. n=33) -> repos/bklit-ui/apps/web/content/docs/
//            components/sankey-chart.mdx's `ComponentPreview` tree, VERBATIM
//            (`nodeWidth={16} nodePadding={24}`, `<SankeyNode lineCap={4}
//            labelOrientation="vertical" />`). n=33 is the actual verified
//            gate size for this tree (the docs demo's own 33-link dataset);
//            n=100/300 reuse the identical richer tree shape for the
//            synthetic structural stress data -- there is no third tree
//            variant to maintain.
// Data comes from bench/data.ts: `getSankeyGateData` (n=4/33, VERBATIM node/
// link arrays) or `generateSankey` (any other n, seeded synthetic layered
// DAG) -- see that file's doc blocks for the full data contract.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SankeyChart,
  SankeyLink,
  SankeyNode,
  SankeyTooltip,
} from "@bklitui/ui/charts";
import {
  generateSankey,
  generateSankeyUpdate,
  getSankeyGateData,
  type SeededSankeyData,
} from "../../../data";
import { armBklitTimerSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// --- Settle detection (M1b) for this phase-less chart -------------------
// SankeyChart takes no `onPhaseChange` prop and no `status` prop (verified
// by reading repos/bklit-ui/packages/ui/src/charts/sankey/sankey-chart.tsx
// directly). It does keep an internal `isLoaded` context flag, flipped via
// `setTimeout(() => setIsLoaded(true), animationDuration)`, but a grep
// across sankey-node.tsx/sankey-link.tsx confirms `isLoaded` is NEVER
// consumed by either renderer -- it is genuinely inert for this
// composition, unlike CandlestickChart's own internal timer (which DOES
// gate a render-branch switch). So there is no externally-observable
// lifecycle signal at all here; settle must replicate the actual
// stagger-delay + per-reveal-duration arithmetic below via
// `armBklitTimerSettle` (bench/settle.ts), same approach as
// bklit-candlestick.tsx/bklit-heatmap.tsx/bklit-sunburst.tsx.
//
// Node side (repos/bklit-ui/packages/ui/src/charts/sankey/sankey-node.tsx,
// `AnimatedNode`):
//   nodeAnimDuration   = animationDuration * 0.6
//   staggerDelaySec    = (index/totalNodes) * nodeAnimDuration * 0.4 / 1000
//   nameLabelDelaySec  = staggerDelaySec + nodeAnimDuration * 0.6 * 0.3 / 1000
//   valueLabelDelaySec = nameLabelDelaySec + 0.06
// Each reveal (`nodeEnter`/`nameEnter`/`valueEnter`) is
// `transitionWithDelay(enterTransition, <delay>)`. `enterTransition` is
// undefined for both source fixtures (neither passes it to `SankeyChart`),
// so every one of these falls back to `DEFAULT_CHART_ENTER_TRANSITION`
// (repos/bklit-ui/packages/ui/src/charts/animation.ts) -- a FIXED 1100ms
// duration, independent of the `animationDuration` prop above (which only
// shapes the delay/stagger math, not each reveal's own length). The
// slowest node-side element is the value label at the last index; its
// completion time is `valueLabelDelaySec*1000 + 1100`.
//
// Link side (sankey-link.tsx, `AnimatedLink`):
//   linkStartDelay      = animationDuration * 0.2
//   linkAnimDuration    = animationDuration * 0.8
//   staggerDelaySeconds = (linkStartDelay + (index/totalLinks) * linkAnimDuration * 0.4) / 1000
// Same fallback-to-`DEFAULT_CHART_ENTER_TRANSITION` reveal duration (1100ms)
// applies via `useMountProgress`. The slowest link is the last index;
// completion = `staggerDelaySeconds*1000 + 1100`.
//
// Overall settle = max(node-side, link-side) + a small paint-settle margin.
// Neither the registry (n=4) nor docs (n=33) demo overrides
// `animationDuration`, so both run at the 1100ms default -- these formulas
// are computed generically off the actual node/link counts, so they also
// cover the synthetic n=100/300 sizes.
//
// Sanity check (matches docs/LOG.md D35's own approximate figures):
//   n=4  (5 nodes, 4 links):   node-side ~=1.49s,  link-side ~=1.584s -> ~=1.73s w/ margin
//   n=33 (14 nodes, 33 links): node-side ~=1.524s, link-side ~=1.661s -> ~=1.81s w/ margin
const SANKEY_ANIMATION_DURATION_MS = 1100;
const SANKEY_ENTER_TRANSITION_DURATION_MS = 1100; // DEFAULT_CHART_ENTER_TRANSITION's own fixed duration (see comment above)
const SANKEY_SETTLE_MARGIN_MS = 150;

function sankeyNodeSideCompletionMs(totalNodes: number): number {
  if (totalNodes <= 0) return SANKEY_ENTER_TRANSITION_DURATION_MS;
  const nodeAnimDuration = SANKEY_ANIMATION_DURATION_MS * 0.6;
  const lastIndex = totalNodes - 1;
  const staggerDelaySec =
    ((lastIndex / totalNodes) * nodeAnimDuration * 0.4) / 1000;
  const nameLabelDelaySec =
    staggerDelaySec + (nodeAnimDuration * 0.6 * 0.3) / 1000;
  const valueLabelDelaySec = nameLabelDelaySec + 0.06;
  return valueLabelDelaySec * 1000 + SANKEY_ENTER_TRANSITION_DURATION_MS;
}

function sankeyLinkSideCompletionMs(totalLinks: number): number {
  if (totalLinks <= 0) return SANKEY_ENTER_TRANSITION_DURATION_MS;
  const linkStartDelay = SANKEY_ANIMATION_DURATION_MS * 0.2;
  const linkAnimDuration = SANKEY_ANIMATION_DURATION_MS * 0.8;
  const lastIndex = totalLinks - 1;
  const staggerDelaySeconds =
    (linkStartDelay + (lastIndex / totalLinks) * linkAnimDuration * 0.4) /
    1000;
  return staggerDelaySeconds * 1000 + SANKEY_ENTER_TRANSITION_DURATION_MS;
}

function sankeySettleMs(totalNodes: number, totalLinks: number): number {
  return (
    Math.max(
      sankeyNodeSideCompletionMs(totalNodes),
      sankeyLinkSideCompletionMs(totalLinks),
    ) + SANKEY_SETTLE_MARGIN_MS
  );
}

function sankeyDataForN(n: number): SeededSankeyData {
  if (n === 4 || n === 33) return getSankeyGateData(n);
  return generateSankey("sankey", n);
}

export default function BklitSankey({ n }: { n: number }) {
  const [data, setData] = useState<SeededSankeyData>(() =>
    sankeyDataForN(n),
  );
  const tickRef = useRef(0);

  // Arm once per mount (matching the `useMemo(() => armBklitSettle(), [])`
  // convention used by the other pilot scenarios). Node/link COUNT is
  // invariant across an update for a fixed `n` (generateSankeyUpdate keeps
  // topology stable -- see its doc block in bench/data.ts), so there is no
  // need to re-arm on every `data` change; the settle time computed from
  // the initial mount's counts stays correct for the whole component
  // lifetime.
  useMemo(() => {
    armBklitTimerSettle(sankeySettleMs(data.nodes.length, data.links.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateSankeyUpdate("sankey", n, tickRef.current));
      });
    // Sankey's `n` is link count (D35), not a live-append time-series axis
    // -- no-op, matching bklit-heatmap.tsx/bklit-sunburst.tsx's convention.
    window.__benchLiveTick = () => {};
  }, [n]);

  // Registry example tree (n=4 gate): no nodeWidth/nodePadding/lineCap/
  // labelOrientation overrides, aspectRatio="16 / 9".
  if (n === 4) {
    return (
      <SankeyChart data={data} aspectRatio="16 / 9">
        <SankeyLink />
        <SankeyNode />
        <SankeyTooltip />
      </SankeyChart>
    );
  }

  // Docs demo tree (all other n, including the n=33 gate -- vertical labels
  // are the docs demo's own verified prop at that exact size; n=100/300
  // reuse the same richer tree shape for the synthetic structural data).
  return (
    <SankeyChart
      data={data}
      aspectRatio="16 / 9"
      nodeWidth={16}
      nodePadding={24}
    >
      <SankeyLink />
      <SankeyNode lineCap={4} labelOrientation="vertical" />
      <SankeyTooltip />
    </SankeyChart>
  );
}
