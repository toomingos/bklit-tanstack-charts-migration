// Faithful port of repos/bklit-ui/packages/ui/registry/examples/composed-chart.tsx
// -- same component tree/props, data comes from the seeded generator scaled
// to `n` instead of the 4-point demo array. The registry demo's `SeriesBar`
// plots `revenue` (bar-only) while `Area`/`Line` BOTH plot `runRate` -- i.e.
// Area and Line intentionally share one dataKey (composed-chart.tsx's
// `upsertLineConfig`: "Area+Line pairs share a dataKey -- keep the later
// config (Line over Area)", verified in
// repos/bklit-ui/packages/ui/src/charts/composed-chart.tsx). That quirk is
// kept verbatim here: `Area dataKey="line"` and `Line dataKey="line"` both
// read the same seeded series (see generateComposed in ../../../data.ts,
// where `area`/`line` are numerically identical, just as `revenue`/`runRate`
// are two independently-named-but-related series in the original demo).
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import {
  ComposedChart,
  SeriesBar,
  Area,
  Line,
  Grid,
  XAxis,
  ChartTooltip,
} from "@bklitui/ui/charts";
import {
  generateComposed,
  generateComposedUpdate,
  type SeededComposedRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveComposed } from "../bench/live";

export default function BklitComposed({ n }: { n: number }) {
  const [data, setData] = useState<SeededComposedRow[]>(() =>
    generateComposed("composed", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  // ComposedChart forwards `onPhaseChange` straight through to
  // `TimeSeriesChartInner` (see composed-chart.tsx's `ChartInner` ->
  // `TimeSeriesChartInner` prop passthrough) -- same reveal-lifecycle
  // callback contract as Line/Area/Bar/Scatter, so the shared
  // `armBklitSettle` "saw a non-ready phase, then saw ready again" arm
  // applies unchanged (no phase-less-chart timer fallback needed here,
  // unlike candlestick).
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateComposedUpdate("composed", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveComposed("composed", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  return (
    <ComposedChart data={data} onPhaseChange={onPhaseChange}>
      <Grid horizontal />
      <SeriesBar dataKey="bars" fill="var(--chart-1)" />
      <Area
        dataKey="line"
        curve={curveNatural}
        fill="var(--chart-4)"
        fillOpacity={0.35}
      />
      <Line dataKey="line" curve={curveNatural} stroke="var(--chart-2)" />
      <XAxis />
      <ChartTooltip />
    </ComposedChart>
  );
}
