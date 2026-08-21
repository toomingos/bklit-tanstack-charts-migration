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

/**
 * Checks the reveal guard on `.ts-chart__marks`: if already revealed (or
 * absent), returns `{ pass: false }`. Otherwise sets the `bkmRevealed` flag
 * and returns `{ pass: true }` with the marks group element.
 */
export function checkRevealGuard(
  container: HTMLElement,
  selector?: string,
): { pass: boolean; marksGroup: Element | null } {
  const marksGroup = container.querySelector(selector ?? ".ts-chart__marks");
  if (!marksGroup || (marksGroup instanceof HTMLElement && marksGroup.dataset.bkmRevealed === "1")) {
    return { pass: false, marksGroup };
  }
  if (marksGroup instanceof HTMLElement) {
    marksGroup.dataset.bkmRevealed = "1";
  }
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
  let marksGroup: Element | null = null;
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
    if (revealing && marksGroup instanceof HTMLElement) {
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

  if (marksGroup instanceof HTMLElement) {
    marksGroup.classList.add(REVEALING_CLASS);
    revealing = true;
  }

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
    if (marksGroup instanceof HTMLElement) {
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

export function createDeferredRevealGuard(
  container: HTMLElement,
  selector?: string,
): { guarded: boolean; marksGroup: Element | null } {
  const { pass, marksGroup } = checkRevealGuard(container, selector);
  return { guarded: !pass, marksGroup };
}
