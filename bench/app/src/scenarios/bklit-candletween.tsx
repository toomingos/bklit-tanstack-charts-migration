// K4 gate: tween reveal captured MID-REVEAL (settle fires at 1100ms into an 1800ms reveal).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickChart,
  Candlestick,
  Grid,
  XAxis,
  YAxis,
  ChartTooltip,
} from "@bklitui/ui/charts";
import {
  generateCandles,
  generateCandlesUpdate,
  type SeededOhlcRow,
} from "../../../data";
import { armBklitTimerSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveCandle } from "../bench/live";

// Keep settle at 1100ms: firing early (mid-reveal) is the entire point.
const CANDLESTICK_ANIMATION_DURATION_MS = 1100;

// Keep transition byte-identical to migrated-candletween.tsx or the comparison means nothing.
// Keep animationDuration at 1800ms: a long tween alone is truncated at isLoaded flip (1100ms default).
// NOT A PIXEL GATE (scheduler skew, not curve fidelity); gated via qa/k4-tween-probe.mjs instead.
const CANDLESTICK_REVEAL_WINDOW_MS = 1800;

const TWEEN_ENTER = {
  type: "tween" as const,
  duration: 1.8,
  ease: [0.85, 0, 0.15, 1] as [number, number, number, number],
};

export default function BklitCandleTween({ n }: { n: number }) {
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
    <CandlestickChart
      animationDuration={CANDLESTICK_REVEAL_WINDOW_MS}
      data={data}
      enterTransition={TWEEN_ENTER}
    >
      <Grid horizontal vertical />
      <Candlestick />
      <XAxis />
      <YAxis />
      <ChartTooltip />
    </CandlestickChart>
  );
}
