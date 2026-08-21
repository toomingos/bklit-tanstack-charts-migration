// bklit BarDepth + BarPulse scenario (initiative 11, plan-loop-1 §2.5/§2.6/
// §8). Doc-verbatim composition order (content/docs/components/bar-
// chart.mdx:246-311, "3D Depth & Glass Surfaces" + BarPulse section):
//   <BarDepthBack dataKey="revenue" color="..." />
//   <Bar dataKey="revenue" fill="..." perspective />
//   <BarDepthFront dataKey="revenue" />
//   <BarPulse dataKey="revenue" activeIndex={data.length - 1} />
// `perspective` on the base <Bar> is REQUIRED per the docs ("Always pass it
// when using the depth layers") -- this is bar.tsx's own front-face-trim
// participation (plan §3.4), not a decoration-only prop.
//
// Two deterministic QA probes:
//   (1) `window.__qaSetBarDepthEnabled(bool)` -- toggles BarDepthBack/Front
//       + `perspective` on/off together (depth on/off capture, task
//       deliverable 2d). Real prop-driven conditional render, not a CSS
//       trick.
//   (2) `window.__qaSetBarPulsePaused(bool)` -- routes straight through
//       BarPulse's own real `pulsePaused` prop (BarPulseProps, bar-
//       depth.tsx:920) to freeze the infinite 2.4s sweep at rest (3D/glass
//       still rendered, sweep stopped) -- this IS the deterministic Q1
//       capture mechanism for BarPulse today.
// A finer `window.__qaSetBarPulsePhase(t)` (pin the sweep at an arbitrary
// fraction through its 2.4s cycle, not just paused-at-rest) was requested
// per the task brief but is NOT implemented here: bklit's BarPulse animates
// via a `motion.rect` WAAPI/spring loop with no phase-seek entry point in
// its public props, and reverse-engineering one would mean patching
// motion/react internals or Playwright Clock-freezing the whole page's
// animation timeline (untested against Motion's internal RAF driver) --
// out of scope for a QA-harness dispatch. See final report;
// qa/screenshot.mjs calls __qaSetBarPulsePhase defensively (only if
// present) and falls back to the paused capture otherwise.
import { useEffect, useMemo, useRef, useState } from "react";
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

export default function BklitBarDepth({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("bardepth", n),
  );
  const [depthEnabled, setDepthEnabled] = useState(true);
  // Default PAUSED (not bklit's real default): BarPulse is a continuous
  // infinite WAAPI/spring loop -- an unpaused mount would make the
  // baseline settled + hover-sweep captures pixel-nondeterministic
  // (self-test SELF_TEST_GATE=0.001 would flake run-to-run on whatever
  // frame the sweep lands on). The QA harness explicitly un-pauses via
  // window.__qaSetBarPulsePaused(false) only for its own dedicated,
  // NOT-pixel-gated eyeball capture.
  const [pulsePaused, setPulsePaused] = useState(true);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
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
