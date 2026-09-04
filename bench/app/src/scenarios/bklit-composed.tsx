// Registry port; Area and Line intentionally share one dataKey (demo quirk, kept verbatim).
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
  // onPhaseChange passthrough matches Line/Area/Bar/Scatter, so the shared settle arm applies.
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
