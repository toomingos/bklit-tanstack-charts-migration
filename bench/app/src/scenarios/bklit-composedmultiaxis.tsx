// P6.1 cluster 5 gate fixture — bklit-composed.tsx with a SECOND y-axis.
//
// `secondary` is `line / 50`, an order of magnitude below the primary series,
// so an unprojected render collapses it onto the baseline and the diff is
// unmissable. It is plotted as BOTH <Area> and <Line> on yAxisId="right",
// preserving the base scenario's Area+Line-share-a-dataKey quirk on the
// secondary axis so the gate covers areaFill AND lineY reprojection.
//
// <SeriesBar> stays on the primary axis deliberately: bklit's <SeriesBar> has
// no `yAxisId` prop and its composed extractor
// (repos/bklit-ui/.../composed-chart.tsx:82-86 `tryAppendSeriesBar`) omits it
// where tryAppendLine/tryAppendArea pass it, so a bar always scans and paints
// on the primary scale. A right-axis bar would be testing behaviour bklit
// does not have.
//
// No <YAxis> child (matching the `composed` scenario) so the fixture gates
// MARK geometry, not right-hand axis rendering.
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

/** `line / 50` — an order of magnitude below the primary series on purpose. */
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
