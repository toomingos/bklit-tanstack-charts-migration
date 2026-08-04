// Migrated SankeyChart bench scenario.
// Identical to bklit-sankey.tsx but imports from @migrated/charts instead of
// @bklitui/ui/charts.
//
// See bklit-sankey.tsx for the full settle-detection doc block — the same
// settle arithmetic applies here (WAAPI-staggered reveal equivalent to bklit's
// framer-motion stagger). Imports `sankeySettleMs`, `sankeyDataForN`, and
// update-generation functions from bench/data and bench infrastructure.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SankeyChart,
  SankeyLink,
  SankeyNode,
  SankeyTooltip,
} from "@migrated/charts";
import {
  generateSankey,
  generateSankeyUpdate,
  getSankeyGateData,
  type SeededSankeyData,
} from "../../../data";
import { armBklitTimerSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// ─── Settle detection (M1b) ────────────────────────────────────────────────
// Same formulas as bklit-sankey.tsx — the migrated component uses identical
// stagger delays and reveal duration (1100ms cubic-bezier).

const SANKEY_ANIMATION_DURATION_MS = 1100;
const SANKEY_ENTER_TRANSITION_DURATION_MS = 1100;
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
    (linkStartDelay + (lastIndex / totalLinks) * linkAnimDuration * 0.4) / 1000;
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

export default function MigratedSankey({ n }: { n: number }) {
  const [data, setData] = useState<SeededSankeyData>(() =>
    sankeyDataForN(n),
  );
  const tickRef = useRef(0);

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
    window.__benchLiveTick = () => {};
  }, [n]);

  if (n === 4) {
    return (
      <SankeyChart data={data} aspectRatio="16 / 9">
        <SankeyLink />
        <SankeyNode />
        <SankeyTooltip />
      </SankeyChart>
    );
  }

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
