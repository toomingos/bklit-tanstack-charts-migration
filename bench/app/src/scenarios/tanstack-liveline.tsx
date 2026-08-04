// Native TanStack Charts performance-ceiling reference for LiveLine, per the
// "ceiling-not-clone" convention used by every other tanstack-*.tsx scenario
// (see tanstack-line.tsx et al.): a `lineY` mark re-rendered on every seeded
// tick, using the SAME seeded data (`getLiveLineSeed`/`liveLineTickValue`/
// `liveLineWindowSecs`/`liveLineCutoffSecs` from bench/data.ts) and the same
// window/cutoff math bklit-liveline.tsx uses, but with TanStack's default/
// unstyled theme, which has NO mount/reveal animation and NO internal rAF
// "live" loop of its own (confirmed by reading Chart.tsx/renderer.ts: a
// render pass is one synchronous `adapter.update()`/`mount()` per prop
// change) -- i.e. a hard snap on every push, not bklit's continuous
// asymmetric y-lerp. This file does not attempt to reproduce that lerp; it
// exists to measure what a from-scratch TanStack implementation costs
// without paying for it.
//
// --- Data & windowing -----------------------------------------------------
// `data` state holds the cutoff-trimmed full buffer (mirrors the demo hook's
// own `prev.filter(p => p.time >= cutoff)` trim, done via
// `liveLineCutoffSecs(n)` -- same function bklit-liveline.tsx uses).
// `visibleData` (derived, memoized) additionally narrows to the last
// `liveLineWindowSecs(n)` seconds, mirroring what `LiveLineChart`'s internal
// x-domain scroll actually shows on screen at any instant (its `window` prop
// is a VIEWPORT over the retained buffer, not the buffer's own retention
// policy -- those are two different mechanisms in the source, see
// bklit-liveline.tsx's header). Rendering only the windowed slice (rather
// than the full cutoff buffer) is what keeps the two implementations'
// visible x-geometry comparable for QA pixel-diffing.
//
// --- Tick cadence: why this file does NOT use real 600ms cadence ---------
// bklit-liveline.tsx's freeze protocol deliberately uses a real 600ms
// `setInterval` for its K=10 freeze ticks (see that file's header for why).
// Mirroring that here would race `armTanstackSettle`'s fixed
// `FALLBACK_MS=2500` fallback timer (bench/settle.ts): that timer starts the
// moment `armTanstackSettle()` is called (at this component's mount, via
// `useMemo`), and 10 ticks at 600ms would take 6000ms just to land -- the
// fallback would resolve `__benchSettled` at 2500ms, silently reporting
// "settled" while 7 of 10 ticks (and the freeze's whole point: a
// deterministic K-ticks-in frame) hadn't happened yet. Since TanStack's
// renderer has no animation to wait out anyway (no lerp, no reveal), there
// is no correctness reason to spread the freeze ticks over real time here --
// unlike bklit, where real cadence was needed to reproduce genuine
// wall-clock-derived x-geometry from a component that reads `Date.now()`
// internally. This file computes its OWN synthetic, evenly-spaced
// timestamps for the K freeze ticks (`baseTime + k * TICK_INTERVAL_SEC`)
// and applies all K in one immediate, synchronous burst on mount --
// producing the same 600ms-spaced x-geometry as bklit's frozen frame,
// without spending 6 real seconds or racing the settle fallback.
// This bklit-real-cadence vs tanstack-synthetic-immediate split is a
// genuine, intentional asymmetry between the two files and is called out
// explicitly in the final report, per the task's request to flag
// contradictions/asymmetries honestly.
//
// Live-mode ticks (via `window.__benchLiveTick`, driven externally by
// bench/run.mjs's M3b) and `window.__benchUpdate` (the M3a 30-tick
// convention) both use real `Date.now()/1000`, same as bklit and the
// original demo hook -- there is no settle race in either case, since
// settle has already resolved by the time either fires.
//
// --- Settle sequencing: `ticksExhaustedRef` gate --------------------------
// `Chart`'s `onRender` fires on EVERY render pass, mount included (verified
// by reading react-charts/src/Chart.tsx + charts-core/src/renderer.ts) --
// not just once. `armTanstackSettle`'s `onRender` resolves on its FIRST
// call, so forwarding it unconditionally would resolve `__benchSettled`
// after the bare initial-seed mount render, before the freeze protocol's K
// ticks ever land. `ticksExhaustedRef` gates that: it starts `false` for
// `scenario !== "live"` (freeze mode hasn't pushed its ticks yet) and
// `true` for `scenario === "live"` (no freeze ticks to wait for -- the
// initial mount reveal IS the thing to settle on, same as every other
// tanstack-*.tsx scenario's `armTanstackSettle` usage). The freeze effect
// flips it to `true` synchronously right after triggering the K-tick
// state update, so the NEXT render pass (reflecting all K ticks, since
// React 18/19 batches the synchronous burst into one commit) is the first
// one actually forwarded to `armTanstackSettle`'s `onRender`.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart, lineY } from "@tanstack/charts";
import {
  getLiveLineSeed,
  liveLineCutoffSecs,
  liveLineTickValue,
  liveLineWindowSecs,
  type SeededLiveLinePoint,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import type { Scenario } from "../bench/query";

const TICK_INTERVAL_SEC = 0.6;
const FREEZE_TICK_COUNT = 10;

interface VisibleLiveLinePoint {
  date: Date;
  value: number;
}

export default function TanstackLiveLine({
  n,
  scenario,
}: {
  n: number;
  scenario?: Scenario;
}) {
  const [data, setData] = useState<SeededLiveLinePoint[]>(() =>
    getLiveLineSeed(n),
  );
  const tickRef = useRef(0);
  const ticksExhaustedRef = useRef(scenario === "live");
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  const applyTick = (time: number, tick: number) => {
    const value = liveLineTickValue(n, tick);
    const cutoff = time - liveLineCutoffSecs(n);
    setData((prev) => [
      ...prev.filter((p) => p.time >= cutoff),
      { time, value },
    ]);
  };

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        applyTick(Date.now() / 1000, tickRef.current);
      });
    window.__benchLiveTick = () => {
      tickRef.current += 1;
      applyTick(Date.now() / 1000, tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    if (scenario === "live") {
      // No freeze ticks to wait for: the initial mount render is already
      // the thing `armTanstackSettle`'s onRender should settle on.
      return;
    }

    // Freeze protocol (mirrors bklit-liveline.tsx's shape, see header above
    // for why the cadence itself is synthetic-immediate here rather than
    // real 600ms): push K seeded ticks with evenly-spaced synthetic
    // timestamps in one synchronous burst, then open the settle gate.
    const baseTime = Date.now() / 1000;
    for (let k = 1; k <= FREEZE_TICK_COUNT; k++) {
      tickRef.current += 1;
      applyTick(baseTime + k * TICK_INTERVAL_SEC, tickRef.current);
    }
    ticksExhaustedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, scenario]);

  const visibleData = useMemo<VisibleLiveLinePoint[]>(() => {
    const latest = data[data.length - 1]?.time ?? 0;
    const windowStart = latest - liveLineWindowSecs(n);
    return data
      .filter((p) => p.time >= windowStart)
      .map((p) => ({ date: new Date(p.time * 1000), value: p.value }));
  }, [data, n]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(visibleData, {
            id: "price",
            x: "date",
            y: "value",
          }),
        ],
        x: { scale: scaleUtc },
        y: { scale: scaleLinear, nice: true, grid: true },
        tooltip: true,
      }),
    [visibleData],
  );

  const handleRender = () => {
    if (!ticksExhaustedRef.current) return;
    onRender();
  };

  return (
    <div className="w-full">
      <Chart
        ariaLabel="LiveLine chart benchmark scenario"
        aspectRatio={2}
        definition={definition}
        onRender={handleRender}
      />
    </div>
  );
}
