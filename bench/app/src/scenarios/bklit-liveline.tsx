// Faithful port of repos/bklit-ui/apps/web/components/docs/
// live-line-chart-demo.tsx (`LiveLineChartDemo`) -- the CANONICAL LiveLine
// scenario basis per docs/LOG.md D22: the registry example
// (registry/examples/live-line-chart.tsx) is BROKEN, passing nonexistent
// `interval`/`maxPoints`/`xDataKey`/`yDataKey` props that don't exist on
// `LiveLineChartProps` (verified directly against live-line-chart.tsx's real
// prop list). Component tree, margins ({top:16,right:16,bottom:40,left:56}),
// `style={{height:260}}`, `window={30}` (at n=30), `formatUsd`, the custom
// `ChartTooltip` content + `showDatePill={false}`, `LiveXAxis`, and
// `LiveYAxis formatValue position="left"` are all ported VERBATIM from that
// demo (live-line-chart-demo.tsx:66-108).
//
// Data comes from bench/data.ts's seeded LiveLine generators
// (`getLiveLineSeed`/`liveLineTickValue`/`liveLineWindowSecs`/
// `liveLineCutoffSecs`) instead of the demo's own `Math.random()`-driven
// `useLiveData` hook -- same seed-phase/live-phase walk math (see data.ts's
// doc block), just deterministic, and the same cutoff-trim-on-tick behavior
// the demo hook itself does outside the chart.
//
// --- n semantics (pre-decided, see data.ts's doc block) -----------------
// `n` is both the seeded point count AND the target window size. n=30 is
// the demo-parity gate: window=30s, cutoff=60s, 600ms interval, all
// verbatim. Any other n keeps the 600ms interval but scales
// window=n*0.6s, cutoff=2*window.
//
// --- Freeze protocol (D22 ruling 2 / QA+M1 determinism) -----------------
// scenario !== "live": after seeding n points, push K=10 seeded live ticks,
// THEN wait out the y-domain lerp convergence, THEN set `paused` (verified
// prop name: `LiveLineChartProps.paused`, live-line-chart.tsx:66 declares
// it, :649 destructures it with default `false`), wait a couple of rAFs,
// THEN resolve `__benchSettled` via the new `armManualSettle` helper
// (bench/settle.ts). `LiveLineChart` exposes no `onPhaseChange`/`status`
// prop at all (unlike Line/Area/Bar/Scatter, confirmed by reading
// `LiveLineChartProps`, live-line-chart.tsx:46-71) and has no fixed internal
// reveal timer either (unlike Candlestick's `armBklitTimerSettle` --
// LiveLineChart's rAF loop never "completes" a one-shot reveal, it just
// keeps running) -- so neither existing settle arm fits; this chart's
// "done" signal is entirely bench-side and manually driven.
//
// Tick cadence choice: REAL 600ms `setInterval`, not immediate sequential
// pushes. Reading the rAF loop (live-line-chart.tsx:376-442): its
// `useEffect` deps include `value`/`targetRange`, so EVERY tick tears down
// and restarts the loop -- but the animation state (`animRef`, a plain ref)
// persists across restarts, so immediate back-to-back pushes wouldn't
// literally break the animation math. The real reason to use real cadence
// here: tick `time` fields are real `Date.now()/1000` (the task's own
// determinism contract only requires the VALUE stream to be seed-stable,
// wall-clock time fields are fine), and the demo's ticks are meant to land
// ~600ms apart on the x axis. Immediate sequential pushes would bunch all 10
// ticks' timestamps within milliseconds of each other, producing a visually
// wrong (all-clustered-at-the-right-edge) frozen frame that doesn't match
// what the real component looks like mid-stream -- i.e. real cadence is
// what "exercises the real code path" means here: not just hitting the same
// functions, but reproducing the same wall-clock-derived x geometry the
// component actually computes from `Date.now()`. (Contrast with
// tanstack-liveline.tsx's ceiling scenario, which deliberately does NOT use
// real cadence -- see that file's header for why real cadence there would
// race `armTanstackSettle`'s fallback timer.)
//
// Convergence wait: `LERP_SPEED=0.08` (live-line-chart.tsx:77, used as the
// default `lerpSpeed`), applied once per COMMITTED frame (throttled to
// `LIVE_FRAME_COMMIT_MS=32ms`, live-line-chart.tsx:80, gated in
// `shouldCommitLiveUpdates`, lines 275-284/408-411) via the CONTRACTING
// branch of `nextAnimFrame` (lines 119-143: `prev + (target-prev)*speed`,
// i.e. exponential decay with ratio `(1-0.08)=0.92` per commit -- the
// asymmetric "instant expand / 0.08-exponential contract" D22 refers to).
// To reach <=1% residual of the initial gap: `0.92^k <= 0.01` ->
// `k >= ln(0.01)/ln(0.92) ~= 55.2` commits -> `55.2*32ms ~= 1.77s`, which
// independently reproduces D22's own "~1.8s" estimate. This scenario waits
// 2000ms (a small margin over that -- `0.92^(2000/32) ~= 0.55%`, i.e.
// >99.4% converged) after the last tick, for BOTH branches below: the
// "live" branch's initial reveal has the exact same convergence shape (the
// core's initial `animRef` starts at the hardcoded `{yMin:0, yMax:100}`,
// live-line-chart.tsx:336-347/342-347, and must lerp from there to the
// seeded data's real range -- `displayValue` itself needs no separate wait
// since its OWN initial state is seeded directly from the mount `value`
// prop, so there's no displayValue lerp gap at t=0).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChartTooltip,
  LiveLine,
  LiveLineChart,
  LiveXAxis,
  LiveYAxis,
  type LiveLinePoint,
} from "@bklitui/ui/charts";
import {
  getLiveLineSeed,
  liveLineCutoffSecs,
  liveLineTickValue,
  liveLineWindowSecs,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import type { Scenario } from "../bench/query";

const TICK_INTERVAL_MS = 600;
const FREEZE_TICK_COUNT = 10;
const LERP_CONVERGENCE_WAIT_MS = 2000;
// Freeze mode's real duration is ~= FREEZE_TICK_COUNT*TICK_INTERVAL_MS +
// LERP_CONVERGENCE_WAIT_MS (~8s at K=10/600ms/2000ms); this fallback is sized
// with generous headroom over that so it never fires under normal operation
// (same "safety net only" contract as every other settle arm's fallback).
const SETTLE_FALLBACK_MS = 15000;

function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

function rafDelay(frames: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = frames;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
      } else {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  });
}

export default function BklitLiveLine({
  n,
  scenario,
}: {
  n: number;
  scenario?: Scenario;
}) {
  const [data, setData] = useState<LiveLinePoint[]>(() => getLiveLineSeed(n));
  const [value, setValue] = useState<number>(
    () => data[data.length - 1]?.value ?? 0,
  );
  const [paused, setPaused] = useState(false);
  const tickRef = useRef(0);
  const { resolve } = useMemo(() => armManualSettle(SETTLE_FALLBACK_MS), []);

  const pushLiveTick = useCallback(() => {
    tickRef.current += 1;
    const tick = tickRef.current;
    const nextValue = liveLineTickValue(n, tick);
    const nextTime = Date.now() / 1000;
    const cutoff = liveLineCutoffSecs(n);
    setData((prev) => {
      const cutoffTime = nextTime - cutoff;
      return [
        ...prev.filter((p) => p.time >= cutoffTime),
        { time: nextTime, value: nextValue },
      ];
    });
    setValue(nextValue);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () => measureUpdatePaint(() => pushLiveTick());
    window.__benchLiveTick = () => pushLiveTick();
  }, [pushLiveTick]);

  useEffect(() => {
    let cancelled = false;

    if (scenario === "live") {
      // No freeze ticks: just wait out the initial reveal's y-lerp, resolve,
      // then leave the chart's own rAF loop running untouched (never pause).
      (async () => {
        await new Promise((r) => setTimeout(r, LERP_CONVERGENCE_WAIT_MS));
        if (cancelled) return;
        await rafDelay(2);
        if (cancelled) return;
        resolve();
      })();
      return () => {
        cancelled = true;
      };
    }

    // Freeze protocol (D22 ruling 2): push K seeded ticks at the real 600ms
    // cadence, wait out the y-lerp, pause, wait a couple rAFs, resolve.
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      pushLiveTick();
      if (count >= FREEZE_TICK_COUNT) {
        clearInterval(id);
        (async () => {
          await new Promise((r) => setTimeout(r, LERP_CONVERGENCE_WAIT_MS));
          if (cancelled) return;
          setPaused(true);
          await rafDelay(2);
          if (cancelled) return;
          resolve();
        })();
      }
    }, TICK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, scenario]);

  return (
    <div className="w-full">
      <LiveLineChart
        data={data}
        margin={{ top: 16, right: 16, bottom: 40, left: 56 }}
        paused={paused}
        style={{ height: 260 }}
        value={value}
        window={liveLineWindowSecs(n)}
      >
        <LiveLine
          dataKey="value"
          formatValue={formatUsd}
          stroke="var(--chart-line-primary)"
        />
        <ChartTooltip
          content={({ point }) => {
            const date = point.date instanceof Date ? point.date : new Date();
            const time = date.toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            const val = typeof point.value === "number" ? point.value : 0;
            return (
              <div className="px-3 py-2.5">
                <div className="mb-1.5 font-medium text-popover-foreground text-xs opacity-60">
                  {time}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Price</span>
                  <span className="ml-auto font-medium text-popover-foreground tabular-nums">
                    {formatUsd(val)}
                  </span>
                </div>
              </div>
            );
          }}
          showDatePill={false}
        />
        <LiveXAxis />
        <LiveYAxis formatValue={formatUsd} position="left" />
      </LiveLineChart>
    </div>
  );
}
