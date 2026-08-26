// P6.1 / T-F1 (S6) — the SCATTER multi-axis NEW-BEHAVIOUR fixture.
//
// Unlike the line/area/bar fixtures this one needs no derived series: the
// scatter generator already produces two keys an order of magnitude apart
// (`sessions` ~300-800, `conversions` ~15-55), so simply moving `conversions`
// onto "right" is the control — shared-domain puts it in a flat band along the
// bottom, per-axis spreads it over the full plot height.
//
// Scatter's own D14 domain rule (max floored at 0, negatives ignored, no
// padding) is what runs per axis here; that rule being preserved through the
// grouping is half of what this fixture checks.
import { useEffect, useMemo, useRef, useState } from "react";
import { ScatterChart, Scatter, Grid, XAxis, ChartTooltip } from "@bklitui/ui/charts";
import {
  generateScatter,
  generateScatterUpdate,
  type SeededScatterRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveScatterRow } from "../bench/live";

export default function BklitScatterMultiAxis({ n }: { n: number }) {
  const [data, setData] = useState<SeededScatterRow[]>(() =>
    generateScatter("scatter", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateScatterUpdate("scatter", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveScatterRow("scatter", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  return (
    <ScatterChart data={data} onPhaseChange={onPhaseChange}>
      <Grid horizontal />
      <Scatter dataKey="sessions" />
      <Scatter dataKey="conversions" yAxisId="right" />
      <XAxis />
      <ChartTooltip />
    </ScatterChart>
  );
}
