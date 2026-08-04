// Migrated CandlestickChart scenario — IDENTICAL usage to
// bklit-candlestick.tsx (same component tree, same props, same
// armBklitTimerSettle(1100) settle mechanism since CandlestickChart exposes
// no onPhaseChange/status here either), only the import source changes.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickChart,
  Candlestick,
  Grid,
  XAxis,
  YAxis,
  ChartTooltip,
} from "@migrated/charts";
import {
  generateCandles,
  generateCandlesUpdate,
  type SeededOhlcRow,
} from "../../../data";
import { armBklitTimerSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveCandle } from "../bench/live";

// Mirrors bklit-candlestick.tsx exactly: CandlestickChart has no
// onPhaseChange/status prop (verified directly in
// repos/bklit-ui/packages/ui/src/charts/candlestick-chart.tsx) and this
// migrated component intentionally doesn't add one either (parity) — so the
// same flat-timer settle mechanism is required here too.
const CANDLESTICK_ANIMATION_DURATION_MS = 1100;

export default function MigratedCandlestick({ n }: { n: number }) {
  const [data, setData] = useState<SeededOhlcRow[]>(() =>
    generateCandles("candlestick", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);

  useMemo(() => {
    armBklitTimerSettle(CANDLESTICK_ANIMATION_DURATION_MS);
  }, []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateCandlesUpdate("candlestick", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveCandle("candlestick", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  return (
    <CandlestickChart data={data}>
      <Grid horizontal vertical />
      <Candlestick />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </CandlestickChart>
  );
}
