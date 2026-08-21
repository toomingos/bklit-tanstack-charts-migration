// ProfitLossLine + ProfitLossLegend visual-parity scenario (initiative 8 Q1
// gate) — the verified bklit demo shape (profit-loss-line-demo.tsx): legend
// OUTSIDE the chart, an invisible zero-width Line registering the y-domain,
// and ProfitLossLine wrapped in ProfitLossLegendHoverProvider. The pnl
// series is derived deterministically from the seeded rows (seriesA minus
// its mean) so it crosses zero; identical derivation on both impl sides.
// `window.__qaSetLegendHover` drives the legend-hover dim for QA probes.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveLinear } from "@visx/curve";
import {
  LineChart,
  Line,
  Grid,
  XAxis,
  ChartTooltip,
  ProfitLossLine,
  ProfitLossLegend,
  ProfitLossLegendHoverProvider,
} from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

type PnlRow = SeededRow & { pnl: number };

function derivePnl(rows: SeededRow[]): PnlRow[] {
  if (rows.length === 0) return [];
  const mean = rows.reduce((sum, r) => sum + r.seriesA, 0) / rows.length;
  return rows.map((r) => ({
    ...r,
    pnl: Math.round((r.seriesA - mean) * 100) / 100,
  }));
}

export default function BklitProfitLoss({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [rows, setRows] = useState<SeededRow[]>(() =>
    generateTimeSeries("profitloss", n),
  );
  const [legendHoveredIndex, setLegendHoveredIndex] = useState<number | null>(null);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);
  const data = useMemo(() => derivePnl(rows), [rows]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setRows(generateTimeSeriesUpdate("profitloss", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setRows((prev) => appendLiveRow("profitloss", n, prev, liveTickRef.current));
    };
    (window as unknown as Record<string, unknown>).__qaSetLegendHover = (
      i: number | null,
    ) => setLegendHoveredIndex(i);
  }, [n]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ProfitLossLegend
        align="center"
        hoveredIndex={legendHoveredIndex}
        onHoverChange={setLegendHoveredIndex}
      />
      <LineChart
        data={data}
        onPhaseChange={onPhaseChange}
        status={state === "loading" ? "loading" : "ready"}
        loadingLabel={state === "loading" ? "Loading data" : undefined}
      >
        <Grid highlightRowValues={[0]} horizontal />
        <Line
          curve={curveLinear}
          dataKey="pnl"
          fadeEdges={false}
          showHighlight={false}
          stroke="transparent"
          strokeWidth={0}
        />
        <ProfitLossLegendHoverProvider hoveredIndex={legendHoveredIndex}>
          <ProfitLossLine dataKey="pnl" />
        </ProfitLossLegendHoverProvider>
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </div>
  );
}
