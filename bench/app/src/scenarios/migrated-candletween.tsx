// Same as bklit-candletween.tsx (tree/transition/early settle); only the import source changes.
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

const CANDLESTICK_ANIMATION_DURATION_MS = 1100;

// GUARD: TWEEN_ENTER byte-identical to bklit's; animationDuration raised to 1800 in lockstep.
// A long tween alone truncates at animationDuration(1100); settle stays 1100 (mid-reveal).
// 1800 keeps hover captures post-reveal; 3000 straddled the animation (1.41% skew).
// GUARD: NOT A PIXEL GATE: mid-flight diff measures scheduler skew; parity gated by candlestick.
const CANDLESTICK_REVEAL_WINDOW_MS = 1800;

const TWEEN_ENTER = {
  type: "tween" as const,
  duration: 1.8,
  ease: [0.85, 0, 0.15, 1] as [number, number, number, number],
};

export default function MigratedCandleTween({ n }: { n: number }) {
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
