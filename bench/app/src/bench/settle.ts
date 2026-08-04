// M1b instrumentation: window.__benchSettled.
//
// bklit-ui's cartesian charts (Line/Area/Bar/Scatter) all run a mount/reveal
// animation driven by `chart-phase.ts` + `use-chart-phase-orchestrator.ts`
// (or, for BarChart, an equivalent isLoaded/revealEpoch effect in
// `bar-chart.tsx`). In every case, `onPhaseChange` fires a NON-"ready" phase
// (e.g. "revealing") when the reveal animation starts, then fires "ready"
// again once it completes (~`animationDuration`, default 1100ms).
//
// Fresh mounts start their internal phase state already at "ready"
// (`resolveRestingChartPhase("ready") === "ready"`, since `status` defaults
// to `"ready"`), but that initial value is a plain `useState` initializer --
// it does NOT go through the `onPhaseChange` callback. The callback only
// fires once the orchestrator's post-mount effect kicks off the reveal, so
// "saw a non-ready phase, then saw ready again" is the real, non-gamed
// signal for "the mount-reveal animation has visually finished" (verified by
// reading use-chart-phase-orchestrator.ts + bar-chart.tsx directly).
//
// The 2500ms fallback timeout is a pure safety net -- per research/04's
// instrumentation contract it may be relied on ONLY as a fallback. It is not
// expected to fire for any of the four pilot charts, since their default
// animationDuration (1100ms) is well under it; it exists solely to avoid an
// unresolved promise wedging the benchmark driver if a future chart's phase
// sequence doesn't match this pattern.
const FALLBACK_MS = 2500;

export type BklitPhase = string;

export interface BenchSettleHandle {
  /** Pass as `onPhaseChange` to the bklit chart component. */
  onPhaseChange: (phase: BklitPhase) => void;
}

/**
 * Arms `window.__benchSettled` and returns an `onPhaseChange` callback to
 * wire into the bklit chart component being benchmarked.
 */
export function armBklitSettle(): BenchSettleHandle {
  let sawNonReady = false;
  let resolveFn: () => void = () => {};

  window.__benchSettled = new Promise<void>((resolve) => {
    resolveFn = resolve;
    setTimeout(resolve, FALLBACK_MS); // fallback only, see note above
  });

  const onPhaseChange = (phase: BklitPhase) => {
    if (phase !== "ready") {
      sawNonReady = true;
      return;
    }
    if (sawNonReady) {
      resolveFn();
    }
  };

  return { onPhaseChange };
}

/**
 * TanStack Charts' default (unstyled) theme has no mount/reveal animation --
 * the SVG scene is compiled and reconciled synchronously in one
 * `adapter.update()` + `adapter.mount()` pass (see Chart.tsx /
 * RendererChart.tsx). "Settled" for tanstack scenarios is therefore just
 * "first onRender has fired, and two animation frames have elapsed" -- a
 * real, un-gamed finding that tanstack settles near-instantly by default,
 * not a substitute measurement.
 */
export function armTanstackSettle(): { onRender: () => void } {
  let fired = false;
  let resolveFn: () => void = () => {};

  window.__benchSettled = new Promise<void>((resolve) => {
    resolveFn = resolve;
    setTimeout(resolve, FALLBACK_MS); // fallback only, see note above
  });

  const onRender = () => {
    if (fired) return;
    fired = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolveFn();
      });
    });
  };

  return { onRender };
}

/**
 * Settle detection for phase-less bklit charts (currently: CandlestickChart).
 *
 * `CandlestickChart` (repos/bklit-ui/packages/ui/src/charts/candlestick-chart.tsx)
 * takes no `onPhaseChange` prop and no `status` prop -- unlike Line/Area/
 * Bar/ScatterChart it exposes NO way to observe its reveal lifecycle from
 * the outside. Reading the source directly: it keeps its own internal
 * `isLoaded` state and flips it to `true` via
 * `setTimeout(() => setIsLoaded(true), animationDuration)` inside a mount
 * effect (default `animationDuration` = 1100ms); `candlestick.tsx` swaps
 * from the animated (`AnimatedCandle`, framer spring) render branch to the
 * fully-resolved static branch AT THAT EXACT MOMENT `isLoaded` flips -- i.e.
 * the reveal is genuinely done, not merely started, right when that timer
 * fires. There is no earlier or later externally-observable signal.
 *
 * Since there's no callback to await, this replicates that exact, cited
 * internal timer instead of silently falling back to `FALLBACK_MS` (which
 * would just measure a constant 2500ms with zero per-chart signal -- not
 * useful data, even though it would technically "work"). The caller passes
 * the same `animationDuration` value it left the chart at (default 1100),
 * so this stays honest as long as bklit's default doesn't drift without the
 * exposed API changing too -- flagged for reviewers, see the scenario file
 * for the full caveat.
 */
export function armBklitTimerSettle(animationDurationMs: number): void {
  window.__benchSettled = new Promise<void>((resolve) => {
    const settle = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };
    setTimeout(settle, animationDurationMs);
    setTimeout(resolve, FALLBACK_MS); // same hard safety net as the other arms
  });
}

/**
 * Manual-resolve settle arm, for scenarios whose "settled" signal is neither
 * a bklit `onPhaseChange` callback (`armBklitSettle`) nor a fixed internal
 * reveal timer (`armBklitTimerSettle`), but a multi-step sequence the
 * SCENARIO ITSELF drives and only it can know is finished.
 *
 * First (and so far only) user: LiveLineChart (docs/LOG.md D22). Reading
 * `LiveLineChartProps` (repos/bklit-ui/packages/ui/src/charts/
 * live-line-chart.tsx) directly: there is no `onPhaseChange`/`status` prop
 * at all (unlike Line/Area/Bar/Scatter), and no fixed
 * `setTimeout(..., animationDuration)` reveal either (unlike Candlestick) --
 * its continuous rAF loop never "completes" the way a one-shot reveal does.
 * The scenario's own freeze protocol (seed -> K live ticks -> wait out the
 * y-domain lerp -> pause -> a couple more rAFs) is the only thing that knows
 * when the chart is actually done moving, so it calls `resolve()` itself
 * once that sequence finishes.
 *
 * `fallbackMs` is caller-supplied rather than the shared 2500ms
 * `FALLBACK_MS` above: that constant is sized for the ~1100ms reveals every
 * OTHER pilot chart's `armBklitSettle`/`armBklitTimerSettle` arm is racing
 * against, and would fire (silently reporting "settled") before a
 * multi-second scenario-driven sequence like LiveLine's freeze protocol
 * ever finishes -- still just a safety net against a wedged promise, not a
 * substitute measurement, per the same principle as `FALLBACK_MS` itself.
 */
export function armManualSettle(fallbackMs: number = FALLBACK_MS): {
  resolve: () => void;
} {
  let resolveFn: () => void = () => {};

  window.__benchSettled = new Promise<void>((resolve) => {
    resolveFn = resolve;
    setTimeout(resolve, fallbackMs); // fallback only, see note above
  });

  return { resolve: () => resolveFn() };
}

declare global {
  interface Window {
    __benchSettled?: Promise<void>;
  }
}
