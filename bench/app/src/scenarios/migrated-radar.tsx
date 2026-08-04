// Migrated RadarChart scenario -- IDENTICAL usage to bklit-radar.tsx (same
// data generation, same component tree, same props, same
// armManualSettle(radarSettleMs(n) + net)-driven settle mechanism since the
// migrated RadarChart exposes no onPhaseChange/status prop here either --
// bklit parity, see migrated/charts/radar-chart.tsx), only the import
// source changes. (See bklit-radar.tsx's settle comment for why the
// scenario drives its own settle instead of armBklitTimerSettle: for the
// structural sizes the shared 2500ms net would preempt the computed reveal
// end and QA would capture hover probes mid-reveal -- docs/LOG.md D47.)
//
// Hover is intentionally left UNCONTROLLED (no `hoveredIndex`/
// `onHoverChange` passed to `RadarChart`): the migrated component wires its
// own imperative hover chrome (internal/radar-hover-chrome.ts) directly onto
// each rendered polygon's pointerenter/pointerleave, mirroring bklit's own
// uncontrolled `RadarChartInner.setHoveredIndex` -- there is nothing external
// to wire up (see bklit-radar.tsx's own comment for the full D24 ruling).
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

// --- Size --------------------------------------------------------------
// Mirrors bklit-radar.tsx's own `RADAR_SIZE` verbatim (docs demo parity).
const RADAR_SIZE = 400;

// --- Settle detection (M1b) for this phase-less chart -------------------
// Identical formula to bklit-radar.tsx's own `radarSettleMs` -- see that
// file's header comment for the full derivation (campaignBaseDelay +
// (n-1)*campaignStagger + enterDurationMs, none of RadarChart's defaults
// overridden here either).
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

// Same constant, same rationale, same value as bklit-radar.tsx's own
// REVEAL_CLOCK_MARGIN_MS (see the derivation comment there; docs/LOG.md
// D48): covers the component-side gap between this scenario arming the
// settle timer and the chart's animation timeline actually starting.
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
    // Radar's `n` is series count at a fixed 5 metrics, not a time-series
    // window -- matches bklit-radar.tsx's own no-op `__benchLiveTick` note.
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
