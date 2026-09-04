// Same tree/props as bklit-radar.tsx; import source only (hover uncontrolled, as bklit).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RadarChart,
  RadarGrid,
  RadarAxis,
  RadarLabels,
  RadarArea,
} from "@migrated/charts";
import {
  generateRadar,
  generateRadarUpdate,
  type SeededRadarSet,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const RADAR_SIZE = 400;

// GUARD: identical formula to bklit's radarSettleMs; no RadarChart defaults overridden here either.
function radarSettleMs(n: number): number {
  const levels = 5;
  const enterDurationMs = 1100;
  const staggerScale = 1;
  const durationFactor = enterDurationMs / 1100;
  const gridStagger = 0.08 * staggerScale * durationFactor;
  const campaignBaseDelayMs =
    (levels * gridStagger + 0.2) * durationFactor * 1000;
  const campaignStaggerMs = 0.15 * staggerScale * durationFactor * 1000;
  return (
    campaignBaseDelayMs + Math.max(0, n - 1) * campaignStaggerMs + enterDurationMs
  );
}

// Covers the arming-to-start gap of the chart's animation timeline.
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function MigratedRadar({ n }: { n: number }) {
  const [{ metrics, data }, setSet] = useState<SeededRadarSet>(() =>
    generateRadar("radar", n),
  );
  const tickRef = useRef(0);

  useMemo(() => {
    const settleMs = radarSettleMs(n) + REVEAL_CLOCK_MARGIN_MS;
    const { resolve } = armManualSettle(settleMs + 3000);
    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, settleMs);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setSet(generateRadarUpdate("radar", n, tickRef.current));
      });
    // GUARD: n is series count; no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  return (
    <RadarChart data={data} metrics={metrics} size={RADAR_SIZE}>
      <RadarGrid />
      <RadarAxis />
      <RadarLabels />
      {data.map((series, index) => (
        <RadarArea index={index} key={series.label} />
      ))}
    </RadarChart>
  );
}
