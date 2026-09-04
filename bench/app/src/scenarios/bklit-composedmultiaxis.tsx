// Multi-axis control: secondary = line/50 on "right" as Area+Line pair; SeriesBar stays primary (has no yAxisId).
// No YAxis child: gates mark geometry, not axis rendering.
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

// secondary = line / 50, an order of magnitude below the primary series on purpose.
const SECONDARY_AXIS_DIVISOR = 50;

type MultiAxisRow = SeededComposedRow & { secondary: number };

function withSecondary(rows: SeededComposedRow[]): MultiAxisRow[] {
  return rows.map((row) => ({
    ...row,
    secondary: Math.round((row.line / SECONDARY_AXIS_DIVISOR) * 100) / 100,
  }));
}

export default function BklitComposedMultiAxis({ n }: { n: number }) {
  const [data, setData] = useState<MultiAxisRow[]>(() =>
    withSecondary(generateComposed("composed", n)),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(withSecondary(generateComposedUpdate("composed", n, tickRef.current)));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        withSecondary(appendLiveComposed("composed", n, prev, liveTickRef.current)),
      );
    };
  }, [n]);

  return (
    <ComposedChart data={data} onPhaseChange={onPhaseChange}>
      <Grid horizontal />
      <SeriesBar dataKey="bars" fill="var(--chart-1)" />
      <Area
        dataKey="secondary"
        yAxisId="right"
        curve={curveNatural}
        fill="var(--chart-4)"
        fillOpacity={0.35}
      />
      <Line
        dataKey="secondary"
        yAxisId="right"
        curve={curveNatural}
        stroke="var(--chart-2)"
      />
      <XAxis />
      <ChartTooltip />
    </ComposedChart>
  );
}
