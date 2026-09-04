// Doc-idiom depth composition; perspective on Bar is REQUIRED with depth layers (front-face trim).
// QA probes: __qaSetBarDepthEnabled toggles layers, __qaSetBarPulsePaused freezes the sweep.
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
  // Default PAUSED (not bklit's default): an unpaused sweep makes settled captures nondeterministic.
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
