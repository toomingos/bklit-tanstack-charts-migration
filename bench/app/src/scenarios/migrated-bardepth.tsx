// Migrated twin of bklit-bardepth.tsx (BarDepth + BarPulse, initiative 11,
// plan-loop-1 §2.5/§2.6, dispatch C). Dispatch C is fully landed:
// `BarDepthProvider`/`BarDepthBack`/`BarDepthFront`/`BarPulse` are
// registered in children.tsx and exported from the top-level
// `@migrated/charts` barrel; bar-chart.tsx wires the full depth branch
// (Back beneath, trimmed bar, Front above, Pulse last). There is no
// `perspective` (or equivalent) prop on Bar/BarConfig -- the front-face
// trim is automatic: bar-chart.tsx swaps in the trimmed bar mark whenever
// a BarDepth child with a matching dataKey is present, so a plain
// `<Bar dataKey fill>` is correct as-is.
//
// Two deterministic QA probes (mirrors bklit-bardepth.tsx):
//   (1) `window.__qaSetBarDepthEnabled(bool)` -- toggles BarDepthBack/Front
//       on/off (depth on/off capture, task deliverable 2d). Real
//       prop-driven conditional render, not a CSS trick.
//   (2) `window.__qaSetBarPulsePaused(bool)` -- routes straight through
//       BarPulse's own real `pulsePaused` prop to freeze the sweep at
//       rest -- this IS the deterministic Q1 capture mechanism for
//       BarPulse today. `window.__qaSetBarPulsePhase(t)` stays a
//       defensive no-op (accepted for the gates); paused-at-mount is the
//       deterministic freeze evidence.
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

export default function MigratedBarDepth({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("bardepth", n),
  );
  const [depthEnabled, setDepthEnabled] = useState(true);
  // Default PAUSED -- see bklit-bardepth.tsx's comment: an unpaused mount
  // would make the baseline settled + hover-sweep captures pixel-
  // nondeterministic (infinite loop, no frame pinning).
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

  // BarDepthProvider is an extracted-config child of <BarChart> (it renders
  // null and would drop the tree if used as a wrapper).
  const depthTree = (
    <BarChart data={data} xDataKey="date" onPhaseChange={onPhaseChange}>
      {depthEnabled && <BarDepthProvider groundShadow={0.26} />}
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
