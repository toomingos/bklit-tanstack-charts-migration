// Doc-idiom depth composition; perspective on Bar is REQUIRED with depth layers (front-face trim).
// QA probes: __qaSetBarDepthEnabled toggles layers, __qaSetBarPulsePaused freezes the sweep,
// __qaSetBarPulsePhase seeks the sweep (fraction of one 2.4s loop) via motion manual timing.
import { useEffect, useMemo, useRef, useState } from "react";
import { MotionGlobalConfig, frame, frameData } from "motion/react";
import {
  BarChart,
  BarDepthBack,
  BarDepthFront,
  BarPulse,
  Bar,
  BarXAxis,
  Grid,
  ChartTooltip,
} from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

// == PULSE_WAVE_DURATION_S in repos/bklit-ui bar-depth.tsx (not exported); keep in sync.
const PULSE_SWEEP_MS = 2400;

export default function BklitBarDepth({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("bardepth", n),
  );
  const [depthEnabled, setDepthEnabled] = useState(true);
  // Default PAUSED (not bklit's default): an unpaused sweep makes settled captures nondeterministic.
  const [pulsePaused, setPulsePaused] = useState(true);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const manualMotionArmed = useRef(false);
  const pulsePausedRef = useRef(pulsePaused);
  pulsePausedRef.current = pulsePaused;
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("bardepth", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("bardepth", n, prev, liveTickRef.current));
    };
    (window as unknown as Record<string, unknown>).__qaSetBarDepthEnabled = (
      enabled: boolean,
    ) => setDepthEnabled(enabled);
    (window as unknown as Record<string, unknown>).__qaSetBarPulsePaused = (
      paused: boolean,
    ) => setPulsePaused(paused);
    // Phase-freeze for the BarPulse sweep (qa/screenshot.mjs bardepth block).
    // The wave is a frameloop-driven JS tween (motion.rect y, 2.4s loop; "y"
    // is not in motion-dom's acceleratedValues so there is no WAAPI path),
    // and useManualTiming freezes motion's clock: setting frameData.timestamp
    // seeks it exactly. Armed lazily on first call so the settled/hover
    // captures before it run on the wall clock; the clock reset to 0 is
    // invisible post-settle (no loop still ticking) and makes every wave
    // start at motion-t0, so phases are absolute across loads. Unpauses as a
    // side effect: a paused pulse renders no wave to seek.
    (window as unknown as Record<string, unknown>).__qaSetBarPulsePhase = async (
      phase: number,
    ) => {
      const p = Math.min(Math.max(phase, 0), 1);
      if (!manualMotionArmed.current) {
        MotionGlobalConfig.useManualTiming = true;
        frameData.timestamp = 0;
        manualMotionArmed.current = true;
      }
      if (pulsePausedRef.current) {
        setPulsePaused(false);
        // Let the wave mount and create its animation (startTime = frozen 0)
        // before seeking; one frameloop batch plus two paints.
        await new Promise<void>((resolve) => {
          frame.update(() => resolve());
        });
        await new Promise<void>((r) => {
          requestAnimationFrame(() => requestAnimationFrame(() => r()));
        });
      }
      frameData.timestamp = p * PULSE_SWEEP_MS;
      await new Promise<void>((resolve) => {
        frame.update(() => resolve());
      });
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
    };
  }, [n]);

  return (
    <BarChart data={data} xDataKey="date" onPhaseChange={onPhaseChange}>
      <Grid horizontal />
      {depthEnabled && <BarDepthBack dataKey="seriesA" color="var(--chart-1)" />}
      <Bar dataKey="seriesA" fill="var(--chart-1)" perspective={depthEnabled} />
      {depthEnabled && <BarDepthFront dataKey="seriesA" />}
      {depthEnabled && (
        <BarPulse dataKey="seriesA" activeIndex={data.length - 1} pulsePaused={pulsePaused} />
      )}
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );
}
