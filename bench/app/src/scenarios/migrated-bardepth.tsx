// Twin of bklit-bardepth.tsx; plain Bar is correct (front-face trim is automatic).
// GUARD: pulse defaults PAUSED; an unpaused mount is pixel-nondeterministic (infinite loop).
// __qaSetBarPulsePhase seeks the sweep (fraction of one 2.4s loop) via the Web Animations API.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  BarDepthProvider,
  BarDepthBack,
  BarDepthFront,
  BarPulse,
  Bar,
  BarXAxis,
  Grid,
  ChartTooltip,
} from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

// Matches the `2.4s` in showcase/migrated/charts/styles.css (ts-bkm-bar-pulse-sweep).
const PULSE_SWEEP_MS = 2400;
const PULSE_WAVE_SELECTOR = ".ts-bkm-bar-pulse-wave";

export default function MigratedBarDepth({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("bardepth", n),
  );
  const [depthEnabled, setDepthEnabled] = useState(true);
  const [pulsePaused, setPulsePaused] = useState(true);
  const tickRef = useRef(0);
  const pulsePausedRef = useRef(true);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);
  pulsePausedRef.current = pulsePaused;

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
    // D590 made the wave a CSS keyframe animation, so it is a real Animation on
    // the element and the WAAPI seeks it exactly: pause, then set currentTime.
    // Absolute across loads -- currentTime is measured from the animation's own
    // start, not the wall clock. Unpauses as a side effect, like bklit: a paused
    // pulse renders no wave to seek.
    (window as unknown as Record<string, unknown>).__qaSetBarPulsePhase = async (
      phase: number,
    ) => {
      const p = Math.min(Math.max(phase, 0), 1);
      if (pulsePausedRef.current) {
        setPulsePaused(false);
        // Let the wave mount and create its animation before seeking.
        await new Promise<void>((r) => {
          requestAnimationFrame(() => requestAnimationFrame(() => r()));
        });
      }
      for (const el of document.querySelectorAll(PULSE_WAVE_SELECTOR)) {
        for (const a of el.getAnimations()) {
          a.pause();
          a.currentTime = p * PULSE_SWEEP_MS;
        }
      }
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
    };
  }, [n]);

  // BarDepthProvider is a config carrier, so it sits among the children, not around them.
  // Legacy requires `children`, so it takes an explicit empty child rather than self-closing.
  const depthTree = (
    <BarChart data={data} xDataKey="date" onPhaseChange={onPhaseChange}>
      {depthEnabled && <BarDepthProvider groundShadow={0.26}>{null}</BarDepthProvider>}
      <Grid horizontal />
      {depthEnabled && <BarDepthBack dataKey="seriesA" color="var(--chart-1)" />}
      <Bar dataKey="seriesA" fill="var(--chart-1)" />
      {depthEnabled && <BarDepthFront dataKey="seriesA" />}
      {depthEnabled && (
        <BarPulse dataKey="seriesA" activeIndex={data.length - 1} pulsePaused={pulsePaused} />
      )}
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  );

  return depthTree;
}
