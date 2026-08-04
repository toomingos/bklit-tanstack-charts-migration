// Faithful port of repos/bklit-ui/packages/ui/registry/examples/candlestick-chart.tsx
// -- same component tree/props, data comes from the seeded generator scaled
// to `n` instead of the 4-point demo array.
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

// --- Settle detection (M1b) for this phase-less chart -------------------
// CandlestickChart takes no `onPhaseChange` prop and no `status` prop --
// unlike Line/Area/Bar/ScatterChart it exposes NO callback to observe its
// reveal lifecycle from the outside (verified by reading
// repos/bklit-ui/packages/ui/src/charts/candlestick-chart.tsx directly: it
// keeps its own internal `isLoaded` state and flips it to `true` via
// `setTimeout(() => setIsLoaded(true), animationDuration)` inside a mount
// effect). `candlestick.tsx` swaps from the animated (`AnimatedCandle`,
// framer spring) render branch to the fully-resolved static branch AT THAT
// EXACT MOMENT `isLoaded` flips -- i.e. the reveal is genuinely done, not
// merely started, right when that timer fires. There is no earlier or
// later externally-observable signal to hook.
//
// We don't override `animationDuration` (mirroring the registry example
// exactly), so the component runs at its documented default of 1100ms.
// `armBklitTimerSettle` (bench/settle.ts) replicates that exact, cited
// internal timer -- `window.__benchSettled` resolves 1100ms after mount
// plus a double-rAF paint-settle buffer -- instead of falling back to the
// harness's generic 2500ms safety net (which would just measure a constant
// with zero per-chart signal). M1b for this scenario therefore measures
// "1100ms since mount, plus paint settle" -- a faithful replication of a
// read, cited internal timer, NOT an observed lifecycle callback like the
// other three pilot charts get from `onPhaseChange`. If a future bklit
// version changes this internal default without exposing it via props,
// this constant will silently drift out of sync with reality -- flagged
// here for reviewer attention.
const CANDLESTICK_ANIMATION_DURATION_MS = 1100;

export default function BklitCandlestick({ n }: { n: number }) {
  const [data, setData] = useState<SeededOhlcRow[]>(() =>
    generateCandles("candlestick", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);

  // Arm once per mount, synchronously during render (matching the
  // useMemo(() => armBklitSettle(), []) convention used by the other
  // pilot scenarios) so it isn't re-armed on every data-driven re-render.
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
