// Docs-demo basis (registry data shape is broken). Hover stays uncontrolled: RadarArea wires its own state.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RadarChart,
  RadarGrid,
  RadarAxis,
  RadarLabels,
  RadarArea,
} from "@bklitui/ui/charts";
import {
  generateRadar,
  generateRadarUpdate,
  type SeededRadarSet,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Primary demo's own size={400}; fits #chart-root with margin.
const RADAR_SIZE = 400;

// Phase-less chart (no onPhaseChange): manual settle from source stagger+duration: 600+(n-1)*150+1100ms.
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

// Covers render-to-animation-start gap; mirrored in migrated pair (M1b absorbs it).
const REVEAL_CLOCK_MARGIN_MS = 250;

export default function BklitRadar({ n }: { n: number }) {
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
    // n = series count, not a window: no live-append; no-op keeps the global present.
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
