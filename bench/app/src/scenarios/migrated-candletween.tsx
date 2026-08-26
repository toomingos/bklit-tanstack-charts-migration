// P5.5 K4 gate scenario — IDENTICAL usage to `bklit-candletween.tsx` (same
// tree, same `enterTransition`, same early 1100ms settle so the capture lands
// mid-reveal); only the import source changes. See that file's header for why
// the settle timer is deliberately shorter than the tween.
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

// Must stay byte-identical to `bklit-candletween.tsx`'s TWEEN_ENTER.
// IMPORTANT (found the hard way): a long tween ALONE is invisible here.
// bklit's `candlestick.tsx` swaps from the animated branch to the
// fully-resolved static branch the instant `isLoaded` flips, and that flip is
// driven by `animationDuration` (default 1100ms) — NOT by the transition's own
// duration. A 3s tween under a 1100ms `animationDuration` is simply truncated
// at 1100ms on both sides, so the capture lands on settled geometry and the
// diff is byte-identical to the plain `candlestick` scenario (verified: all
// four metrics matched to 4dp). `animationDuration` is therefore raised to
// 1800ms in lockstep with the tween, while the settle timer stays at 1100ms so
// the capture still lands mid-reveal.
//
// 1800ms specifically: long enough that the ~1300ms settled capture is
// unambiguously mid-flight (raw tween progress ~0.72, with the last staggered
// candles barely started), but short enough that the harness's three
// subsequent hover captures — which begin only after that screenshot and each
// wait 700ms — all land AFTER the reveal is over. Those hover frames are a
// tooltip/hover gate, not a reveal gate; leaving them straddling a running
// animation just compares two page loads at different reveal progress. At
// 3000ms hover-30 did exactly that and read 1.41% with no tooltip on either
// side.
//
// NOT A PIXEL GATE. `qa/screenshot.mjs --chart candletween` will FAIL and is
// expected to: bklit drives this reveal through framer-motion's rAF scheduler
// and migrated through WAAPI, and the two do not share a start instant
// relative to `__benchSettled`, so a mid-flight diff measures scheduler skew
// (1.2996%) rather than curve fidelity. The harness is not the noise source —
// self-tests on this same scenario read 0.0004% / 0.0000%. This scenario
// exists as the vehicle for `qa/k4-tween-probe.mjs`, which reads the running
// animation's timing back directly; see that file's header for the full
// reasoning. Default-reveal parity is gated normally by `--chart candlestick`.
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
