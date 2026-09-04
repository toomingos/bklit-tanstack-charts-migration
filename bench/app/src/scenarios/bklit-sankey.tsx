// Two trees by n (n = link count): n=4 uses the registry tree, all other n the docs tree (n=33 gate).
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

// Phase-less chart (no onPhaseChange; internal isLoaded is inert): settle = max(node, link) stagger + 1100ms.
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

  // Arm once per mount: topology is stable across updates at fixed n, so mount counts stay valid.
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
    // n = link count, not a window: no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  // Registry tree (n=4 gate): no node/line overrides.
  if (n === 4) {
    return (
      <SankeyChart data={data} aspectRatio="16 / 9">
        <SankeyLink />
        <SankeyNode />
        <SankeyTooltip />
      </SankeyChart>
    );
  }

  // Docs tree (all other n): vertical labels are the docs demo's own props.
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
