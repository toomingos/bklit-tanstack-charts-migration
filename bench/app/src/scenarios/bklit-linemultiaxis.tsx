// P6.1 / T-F1 — the multi-axis NEW-BEHAVIOUR fixture (not a regression check).
//
// Two series on two different `yAxisId` values with deliberately mismatched
// magnitudes: `seriesA` runs ~1000 on the default (`"left"`) axis, `seriesC` is
// `seriesB / 50` and runs ~12 on `"right"`. That ratio is the control D331 asks
// for — if per-axis domains are NOT resolved, `seriesC` collapses onto the
// bottom edge of a shared [0, ~1100] domain and the diff is enormous; if they
// ARE, it uses the full plot height exactly as `seriesA` does. A PASS here can
// only happen when both impls resolve two domains, so the gate can move.
//
// No `<YAxis>` child, matching the `line` scenario: this fixture gates the MARK
// geometry the projector produces, not right-hand axis rendering (which is a
// separate surface and not part of the scale-resolution layer).
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import { LineChart, Line, Grid, XAxis, ChartTooltip } from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

/** `seriesB / 50` — an order of magnitude below `seriesA` on purpose. */
const SECONDARY_AXIS_DIVISOR = 50;

type MultiAxisRow = SeededRow & { seriesC: number };

function withSecondary(rows: SeededRow[]): MultiAxisRow[] {
  return rows.map((row) => ({
    ...row,
    seriesC: Math.round((row.seriesB / SECONDARY_AXIS_DIVISOR) * 100) / 100,
  }));
}

export default function BklitLineMultiAxis({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<MultiAxisRow[]>(() =>
    withSecondary(generateTimeSeries("line", n)),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(withSecondary(generateTimeSeriesUpdate("line", n, tickRef.current)));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        withSecondary(appendLiveRow("line", n, prev, liveTickRef.current)),
      );
    };
  }, [n]);

  return (
    <LineChart
      data={data}
      onPhaseChange={onPhaseChange}
      status={state === "loading" ? "loading" : "ready"}
      loadingLabel={state === "loading" ? "Loading data" : undefined}
    >
      <Grid horizontal />
      <Line dataKey="seriesA" curve={curveNatural} stroke="var(--chart-line-primary)" />
      <Line dataKey="seriesC" yAxisId="right" curve={curveNatural} stroke="var(--chart-3)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  );
}
