// D420 SANCTIONED reach-in, single site, excluded by name from the census
// grep guard; upstream ask motion.enter:'wipe'.
//
// The native `motion()` renderer (C5, D432) has no entrance choreography
// that expresses bklit's left→right clip-path sweep — every native `enter`
// timing animates a mark's own geometry/opacity in place, never a clip
// region sweeping across an already-fully-drawn mark. D420 accepted this
// gap as a single, narrowly-scoped imperative WAAPI reach-in (the technique
// C4's `enter-transition.ts`/`deferred-reveal.ts` already used pre-motion)
// rather than approximating the sweep with native primitives, and asked
// upstream for a first-class `motion.enter: 'wipe'` (or similar) primitive
// to retire this module against. Until that lands, `runRevealWipe` /
// `snapRevealWipe` below are the ONLY place in the migrated line/area/
// composed charts that animate a `.ts-chart__marks` group directly instead
// of going through `defineChart`'s `motion` cascade — every mark-role enter
// this wipe covers (line, area, dot) is suppressed at the chart-level
// `motion` callback (A3) so the two mechanisms never race.
//
// Ported byte-for-byte from the pre-C5 per-chart `handleRender` reveal
// block (identical across line-chart.tsx/area-chart.tsx/composed-chart.tsx
// before this module existed): same clip-path keyframes, same epoch-replay
// guard shape, same reduced-motion snap. The only change is that the guard
// bookkeeping is now centralized here instead of copy-pasted three times.
//
// The `bkmRevealed` dataset stamp mirrors `./deferred-reveal.ts`'s
// `isRevealed`/`markRevealed` flag (same key, same "1" sentinel) so the
// on-DOM contract stays recognizable to anyone cross-referencing bar/
// candle/scatter/polar/sankey/heatmap/choropleth, which still import that
// module directly — this file intentionally does NOT import from
// `deferred-reveal.ts` (kept out of my three owned files' import graph per
// C5 executor-A scope) and instead re-implements the two-line primitive
// locally rather than pull in `onPostPaint`/`setRevealDeadline`/etc, which
// nothing here needs.

/** The element the wipe clip-path and reveal stamp are applied to —
    `.ts-chart__marks`, an `SVGGElement` under both the static and motion
    renderers (identical class contract, confirmed against
    `@tanstack/charts/dist/motion.js`'s `ts-chart__*` emission). */
export type RevealWipeMarks = SVGGElement;

/** Per-chart replay-guard storage. Each chart component owns one of these
    (a plain `{ current }` box — a `React.useRef` return value satisfies the
    shape) and passes it into every `runRevealWipe`/`snapRevealWipe` call.
    L2 replay key (D311 shape, sankey `seenRevealKeyRef`): the `bkmRevealed`
    DOM stamp alone can't express "replay on a new `revealSignature`" — it
    latches for the life of the marks node — so the epoch is the real key;
    the DOM stamp only guards the "no signature bump, no reduced-motion
    change, but the marks node itself is fresh" case (initial mount). */
export interface RevealWipeEpochRef {
  current: number | null;
}

function isMarksRevealed(marks: RevealWipeMarks): boolean {
  return marks.dataset.bkmRevealed === "1";
}

function stampRevealed(marks: RevealWipeMarks): void {
  marks.dataset.bkmRevealed = "1";
}

export interface RunRevealWipeParams {
  marks: RevealWipeMarks | null | undefined;
  /** The orchestrator's `revealEpoch` — collapses `revealSignature` +
      `animationDuration` into one comparable key (see epoch-ref doc above). */
  epoch: number;
  epochRef: RevealWipeEpochRef;
  /** `chartPhase === "revealing"` at the call site. */
  active: boolean;
  animationDuration: number;
  prefersReducedMotion: boolean;
  /** Resolved via `clipRevealTiming` at the chart's top level — NOT this
      module's concern; this module only plays the resolved timing. */
  durationMs: number;
  easingCss: string;
}

/**
 * Call from `onRender`, once per render, after locating the marks group.
 * Reproduces the pre-C5 `handleRender` reveal block: replays the sweep only
 * when this is a genuinely new reveal (epoch bumped, or the marks group has
 * never been stamped), otherwise snaps the clip open and stamps revealed
 * without animating (matches a same-epoch re-render mid-reveal, or a
 * re-render after the reveal already finished).
 *
 * Returns whether the sweep actually played this call — line-chart.tsx/
 * area-chart.tsx gate their (separate, D420-adjacent) per-marker WAAPI fade
 * stagger on this same condition, matching the pre-C5 code where that block
 * lived after the `if (!shouldAnimate) { ...; return; }` early-out.
 */
export function runRevealWipe(params: RunRevealWipeParams): boolean {
  const { marks, epoch, epochRef, active, animationDuration, prefersReducedMotion, durationMs, easingCss } = params;
  if (!marks) return false;
  const epochUnseen = epochRef.current !== epoch;
  const shouldAnimate =
    active && animationDuration > 0 && !prefersReducedMotion && (epochUnseen || !isMarksRevealed(marks));
  if (!shouldAnimate) {
    stampRevealed(marks);
    marks.style.clipPath = "";
    return false;
  }
  stampRevealed(marks);
  epochRef.current = epoch;
  marks.animate(
    [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
    { duration: durationMs, easing: easingCss },
  );
  return true;
}

export interface SnapRevealWipeParams {
  marks: RevealWipeMarks | null | undefined;
  /** `chartPhase === "revealing"` at the call site. */
  active: boolean;
  animationDuration: number;
  prefersReducedMotion: boolean;
}

/**
 * Call from the phase-transition effect (deps: `[chartPhase, revealEpoch,
 * animationDuration, prefersReducedMotion]`) that catches
 * `prefersReducedMotion`/`animationDuration` flipping to a snap-worthy value
 * AFTER the mount-time `onRender` already ran with the sweep armed. No-op
 * unless reduced motion (or a zero/negative duration) applies — the normal
 * sweep path is entirely `runRevealWipe`'s.
 */
export function snapRevealWipe(params: SnapRevealWipeParams): void {
  const { marks, active, animationDuration, prefersReducedMotion } = params;
  if (!marks || !active) return;
  if (prefersReducedMotion || animationDuration <= 0) {
    marks.style.clipPath = "";
    stampRevealed(marks);
  }
}
