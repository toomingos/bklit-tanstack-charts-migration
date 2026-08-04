const DEFAULT_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
const REVEALING_CLASS = "ts-chart__marks--revealing";

/**
 * Schedules `callback` after two rAFs + one macrotask tick — past the
 * current frame's paint, matching bklit's pre-commit framer `initial` timing.
 * Shared by every chart family's deferred WAAPI reveal setup.
 */
export function onPostPaint(callback: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(callback, 0);
    });
  });
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
}

export function runDeferredReveal(config: DeferredRevealConfig): void {
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
  } = config;

  if (animationDuration <= 0 || elements.length === 0) {
    onPhaseChange?.("ready");
    return;
  }

  const { pass, marksGroup } = checkRevealGuard(container, marksGroupSelector);
  if (!pass || !marksGroup) {
    onPhaseChange?.("ready");
    return;
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
  }

  const animations: Animation[] = [];

  onPostPaint(() => {
    for (let i = 0; i < elements.length; i++) {
      const result = animateElement(elements[i], i);
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
    }
  });

  setRevealDeadline(deadlineMs, {
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
}

export function createDeferredRevealGuard(
  container: HTMLElement,
  selector?: string,
): { guarded: boolean; marksGroup: Element | null } {
  const { pass, marksGroup } = checkRevealGuard(container, selector);
  return { guarded: !pass, marksGroup };
}
