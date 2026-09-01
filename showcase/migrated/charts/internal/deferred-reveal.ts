const REVEALING_CLASS = "ts-chart__marks--revealing";

/**
 * Schedules `callback` after two rAFs + one macrotask tick — past the
 * current frame's paint, matching bklit's pre-commit framer `initial` timing.
 * Shared by every chart family's deferred WAAPI reveal setup.
 *
 * Returns a cancel function that cancels the pending rAF/timeout chain (a
 * no-op once the callback has already run), so callers can tear the chain
 * down on unmount/re-render instead of letting it fire against detached DOM.
 */
export function onPostPaint(callback: () => void): () => void {
  let raf1 = 0;
  let raf2 = 0;
  let timeoutId: number | null = null;
  let cancelled = false;

  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        if (!cancelled) callback();
      }, 0);
    });
  });

  return () => {
    cancelled = true;
    if (raf1) cancelAnimationFrame(raf1);
    if (raf2) cancelAnimationFrame(raf2);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  };
}

// ---- The `bkmRevealed` flag, centralized (P6 `centralize 5` / D315) ----
//
// This flag used to be written as a raw `element.dataset.bkmRevealed` string
// at ~33 sites across 10 files. `checkRevealGuard` below already existed but
// almost nothing used it, and the reason is visible in the call sites: it
// READS AND STAMPS IN ONE STEP, while nearly every chart needs to read first
// and stamp only on a specific branch (`if (revealed && !revealKeyChanged)
// return;` … stamp later). Stamping on the read would mark charts as revealed
// that then decided not to animate — a behaviour change, not a refactor.
//
// So the centralization is a set of PRIMITIVES over the flag rather than one
// combined function, and `checkRevealGuard` is rebuilt on top of them as the
// convenience `runDeferredReveal` uses. `clearRevealed` is the un-stamping
// affordance D315 called for (`sunburst-chart.tsx:1093` did `delete
// svg.dataset.bkmRevealed` by hand), and `findRevealRoot` is the svg-root
// variant for the charts that guard on the `<svg>` rather than the marks group
// (sunburst, choropleth, ring).

/**
 * The element the reveal stamp lives on. **`SVGElement`, not just
 * `HTMLElement`** — `.ts-chart__marks` is an `SVGGElement` and the svg-root
 * variants are `SVGSVGElement`. Both carry `dataset` and `classList` via the
 * `HTMLOrSVGElement` mixin, but neither passes `instanceof HTMLElement`, which
 * is how this module's guards came to be silently dead (see D356).
 */
export type RevealRoot = HTMLElement | SVGElement;

/** True if `element` already carries the reveal stamp. */
export function isRevealed(element: RevealRoot | null | undefined): boolean {
  return element?.dataset.bkmRevealed === "1";
}

/** Stamps `element` as revealed. Idempotent. */
export function markRevealed(element: RevealRoot | null | undefined): void {
  if (element) element.dataset.bkmRevealed = "1";
}

/**
 * Removes the reveal stamp so the next pass can animate again. Used when the
 * reveal contract is deliberately re-armed (sunburst re-reveals on a data
 * identity change rather than latching for the life of the node).
 */
export function clearRevealed(element: RevealRoot | null | undefined): void {
  if (element) delete element.dataset.bkmRevealed;
}

/**
 * Resolves the element the reveal guard is stamped on. Defaults to the marks
 * group; pass `"svg.ts-chart"` (or another selector) for the charts that guard
 * on the svg root. Returns `null` when absent, which every caller treats as
 * "nothing to reveal".
 */
export function findRevealRoot(
  container: HTMLElement,
  selector = ".ts-chart__marks",
): RevealRoot | null {
  return container.querySelector(selector) as RevealRoot | null;
}

/**
 * Checks the reveal guard on `.ts-chart__marks`: if already revealed (or
 * absent), returns `{ pass: false }`. Otherwise sets the `bkmRevealed` flag
 * and returns `{ pass: true }` with the marks group element.
 *
 * Read-and-stamp in one step — correct only where the caller commits to
 * revealing as soon as the guard passes. Where the decision is conditional,
 * use `isRevealed` / `markRevealed` separately.
 */
export function checkRevealGuard(
  container: HTMLElement,
  selector?: string,
): { pass: boolean; marksGroup: RevealRoot | null } {
  const marksGroup = findRevealRoot(container, selector);
  if (!marksGroup || isRevealed(marksGroup)) {
    return { pass: false, marksGroup };
  }
  markRevealed(marksGroup);
  return { pass: true, marksGroup };
}

/**
 * Arms a deadline timer. On expiry, cancels all tracked WAAPI animations and
 * calls `onDeadline`. Returns the timer ID so callers can clear on unmount.
 */
export function setRevealDeadline(
  deadlineMs: number,
  callbacks: {
    onDeadline: () => void;
    animationsRef?: { current: Animation[] };
  },
): number {
  return window.setTimeout(() => {
    if (callbacks.animationsRef) {
      for (const anim of callbacks.animationsRef.current) anim.cancel();
      callbacks.animationsRef.current = [];
    }
    callbacks.onDeadline();
  }, deadlineMs);
}

// ---- Higher-level helper (static element list, simple per-element animation) ----

/** Handle returned by `runDeferredReveal` — cancel() tears down the reveal. */
export interface RevealHandle {
  cancel(): void;
}

export interface DeferredRevealConfig {
  container: HTMLElement;
  marksGroupSelector?: string;
  onPhaseChange?: (phase: "revealing" | "ready") => void;
  animationDuration: number;
  easing?: string;
  staggerDelayMs?: (index: number, total: number) => number;
  animateElement: (element: Element, index: number) => Animation | Animation[] | null;
  cleanupAnimation?: (animation: Animation) => void;
  deadlineCallback?: () => void;
  elements: Element[];
  /**
   * Heatmap epoch guard (see heatmap-components.tsx): when `seenEpochRef` is
   * provided, the reveal is skipped if `seenEpochRef.current === revealEpoch`
   * (already revealed for this epoch), otherwise the epoch is stamped and the
   * reveal proceeds. Keeps the `bkmRevealed` dataset stamping + epoch
   * bookkeeping in this single module.
   */
  revealEpoch?: number;
  seenEpochRef?: { current: number | null };
}

export function runDeferredReveal(config: DeferredRevealConfig): RevealHandle {
  const {
    container,
    marksGroupSelector = ".ts-chart__marks",
    onPhaseChange,
    animationDuration,
    staggerDelayMs,
    animateElement,
    cleanupAnimation,
    deadlineCallback,
    elements,
    revealEpoch,
    seenEpochRef,
  } = config;

  const animations: Animation[] = [];
  let deadlineTimer: number | null = null;
  let cancelPostPaint: (() => void) | null = null;
  let marksGroup: RevealRoot | null = null;
  let revealing = false;

  const cancel = () => {
    if (deadlineTimer !== null) {
      window.clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
    if (cancelPostPaint) {
      cancelPostPaint();
      cancelPostPaint = null;
    }
    for (const anim of animations) {
      try {
        anim.cancel();
      } catch {
        // teardown race — already cancelled / detached DOM
      }
    }
    animations.length = 0;
    if (revealing && marksGroup) {
      marksGroup.classList.remove(REVEALING_CLASS);
      revealing = false;
    }
  };

  if (seenEpochRef && revealEpoch !== undefined && seenEpochRef.current === revealEpoch) {
    return { cancel };
  }

  if (animationDuration <= 0) {
    onPhaseChange?.("ready");
    return { cancel };
  }

  if (elements.length === 0) {
    onPhaseChange?.("ready");
    return { cancel };
  }

  // An epoch-guarded caller that reaches here has a NEW epoch, i.e. it intends
  // to re-reveal — so the latch left by the previous epoch must not veto it.
  // Before D356 this could not arise, because the stamp was never written.
  if (seenEpochRef && revealEpoch !== undefined) {
    clearRevealed(findRevealRoot(container, marksGroupSelector));
  }

  const { pass, marksGroup: guardGroup } = checkRevealGuard(container, marksGroupSelector);
  if (!pass || !guardGroup) {
    onPhaseChange?.("ready");
    return { cancel };
  }
  marksGroup = guardGroup;

  if (seenEpochRef && revealEpoch !== undefined) {
    seenEpochRef.current = revealEpoch;
  }

  onPhaseChange?.("revealing");

  let maxStagger = 0;
  if (staggerDelayMs) {
    for (let i = 0; i < elements.length; i++) {
      const delay = staggerDelayMs(i, elements.length);
      if (delay > maxStagger) maxStagger = delay;
    }
  }

  const deadlineMs = animationDuration + maxStagger;

  marksGroup.classList.add(REVEALING_CLASS);
  revealing = true;

  cancelPostPaint = onPostPaint(() => {
    for (let i = 0; i < elements.length; i++) {
      const result = animateElement(elements[i]!, i);
      if (!result) continue;
      if (Array.isArray(result)) {
        for (const anim of result) {
          if (anim) animations.push(anim);
        }
      } else {
        animations.push(result);
      }
    }
    if (marksGroup) {
      marksGroup.classList.remove(REVEALING_CLASS);
      revealing = false;
    }
  });

  deadlineTimer = setRevealDeadline(deadlineMs, {
    animationsRef: { current: animations },
    onDeadline: () => {
      if (cleanupAnimation) {
        for (const anim of animations) cleanupAnimation(anim);
      } else {
        for (const anim of animations) anim.cancel();
      }
      animations.length = 0;
      deadlineCallback?.();
      onPhaseChange?.("ready");
    },
  });

  return { cancel };
}
