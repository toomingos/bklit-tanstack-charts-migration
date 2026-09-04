
import { clearRevealed, findRevealRoot, isRevealed, markRevealed } from "./reveal-root";
import type { RevealRoot } from "./reveal-root";

const REVEALING_CLASS = "ts-chart__marks--revealing";

/**
 * Runs `finish` after two rAFs + a macrotask (past paint, bklit pre-commit timing). Returns a cancel fn.
 *
 * @param {() => void} finish - Callback invoked once two animation frames plus a zero-delay
 *   macrotask have elapsed, so the browser has painted before the reveal starts.
 * @returns {() => void} Cancel function that disarms any pending frames or timeout; safe to call after completion.
 */
const onPostPaint = (finish: () => void): () => void => {
  let raf1 = 0;
  let raf2 = 0;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined = undefined;
  let cancelled = false;

  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      timeoutId = globalThis.setTimeout(() => {
        if (!cancelled) {finish();}
      }, 0);
    });
  });

  return () => {
    cancelled = true;
    if (raf1) {cancelAnimationFrame(raf1);}
    if (raf2) {cancelAnimationFrame(raf2);}
    if (timeoutId !== undefined) {globalThis.clearTimeout(timeoutId);}
  };
};

// Read/stamp split is deliberate: callers stamp only on one branch; stamping on read would mis-mark charts that skip.

/**
 * Read-and-stamp guard; only where the caller commits on pass — else use `isRevealed`/`markRevealed`.
 *
 * @param {HTMLElement} container - Chart container holding the reveal root.
 * @param {string} [selector] - CSS selector forwarded to `findRevealRoot`; defaults to the marks group.
 * @returns {RevealGuard} Guard outcome; `proceed` is true only when the root was found unstamped and is now stamped.
 */
const checkRevealGuard = (container: HTMLElement, selector?: string): RevealGuard => {
  const marksGroup = findRevealRoot(container, selector);
  if (!marksGroup || isRevealed(marksGroup)) {
    return { marksGroup: undefined, proceed: false };
  }
  markRevealed(marksGroup);
  return { marksGroup, proceed: true };
}

const setRevealDeadline = (deadlineMs: number, callbacks: {
    onDeadline: () => void;
    animationsRef?: { current: Animation[] };
  }): number => window.setTimeout(() => {
    if (callbacks.animationsRef) {
      for (const anim of callbacks.animationsRef.current) {anim.cancel();}
      callbacks.animationsRef.current = [];
    }
    callbacks.onDeadline();
  }, deadlineMs);


interface RevealHandle {
  cancel: () => void
}

type RevealAnimationResult = Animation | Animation[] | null;

interface DeferredRevealConfig {
  container: HTMLElement;
  marksGroupSelector?: string;
  onPhaseChange?: (phase: "revealing" | "ready") => void;
  animationDuration: number;
  easing?: string;
  staggerDelayMs?: (index: number, total: number) => number;
  animateElement: (element: Element, index: number) => RevealAnimationResult;
  cleanupAnimation?: (animation: Animation) => void;
  deadlineCallback?: () => void;
  elements: Element[];
  /** Skips when `seenEpochRef` already matches `revealEpoch` (heatmap epoch guard). */
  revealEpoch?: number;
  seenEpochRef?: { current: number | null };
}

interface RevealTimerState {
  cancelPostPaint: (() => void) | undefined;
  deadlineTimer: number | undefined;
}

interface RevealSession {
  readonly animations: Animation[];
  readonly timers: RevealTimerState;
  marksGroup: RevealRoot | undefined;
  revealing: boolean;
}

interface RevealGuard {
  readonly proceed: boolean;
  readonly marksGroup: RevealRoot | undefined;
}

interface GuardRevealRootParams {
  readonly container: HTMLElement;
  readonly marksGroupSelector: string;
  readonly onPhaseChange: DeferredRevealConfig["onPhaseChange"];
  readonly revealEpoch: number | undefined;
  readonly seenEpochRef: { current: number | null } | undefined;
}

interface CommitRevealGuardParams {
  readonly session: RevealSession;
  readonly marksGroup: RevealRoot;
  readonly seenEpochRef: { current: number | null } | undefined;
  readonly revealEpoch: number | undefined;
}

interface AppendRevealAnimationsParams {
  readonly elements: readonly Element[];
  readonly animateElement: (element: Element, index: number) => RevealAnimationResult;
  readonly animations: Animation[];
}

interface FinishRevealAnimationsParams {
  readonly animations: Animation[];
  readonly cleanupAnimation: ((animation: Animation) => void) | undefined;
}

const createRevealSession = (): RevealSession => ({
  animations: [],
  marksGroup: undefined,
  revealing: false,
  timers: { cancelPostPaint: undefined, deadlineTimer: undefined },
});

const cancelRevealTimers = (timers: RevealTimerState): void => {
  if (timers.deadlineTimer !== undefined) {
    globalThis.clearTimeout(timers.deadlineTimer);
    timers.deadlineTimer = undefined;
  }
  if (timers.cancelPostPaint) {
    timers.cancelPostPaint();
    timers.cancelPostPaint = undefined;
  }
}

const cancelRevealAnimations = (animations: Animation[]): void => {
  for (const anim of animations) {
    try {
      anim.cancel();
    } catch {
      // Teardown race — already cancelled / detached DOM
    }
  }
  animations.length = 0;
}

const cancelRevealSession = (session: RevealSession): void => {
  cancelRevealTimers(session.timers);
  cancelRevealAnimations(session.animations);
  if (session.revealing && session.marksGroup) {
    session.marksGroup.classList.remove(REVEALING_CLASS);
    session.revealing = false;
  }
}

const isStaleRevealEpoch = (seenEpochRef: { readonly current: number | null } | undefined, revealEpoch: number | undefined): boolean =>
  !!seenEpochRef && revealEpoch !== undefined && seenEpochRef.current === revealEpoch;

const skipRevealAsReady = (config: DeferredRevealConfig): RevealGuard => {
  config.onPhaseChange?.("ready");
  return { marksGroup: undefined, proceed: false };
}

const guardRevealRoot = ({ container, marksGroupSelector, onPhaseChange, revealEpoch, seenEpochRef }: GuardRevealRootParams): RevealRoot | undefined => {
  // An epoch-guarded caller reaching here has a NEW epoch, so clear the previous latch.
  if (seenEpochRef && revealEpoch !== undefined) {
    clearRevealed(findRevealRoot(container, marksGroupSelector));
  }
  const { proceed, marksGroup } = checkRevealGuard(container, marksGroupSelector);
  if (!proceed || !marksGroup) {
    onPhaseChange?.("ready");
    return undefined;
  }
  return marksGroup;
}

const checkRevealPreconditions = (config: DeferredRevealConfig): RevealGuard => {
  if (isStaleRevealEpoch(config.seenEpochRef, config.revealEpoch)) {
    return { marksGroup: undefined, proceed: false };
  }
  if (config.animationDuration <= 0) {
    return skipRevealAsReady(config);
  }
  if (config.elements.length === 0) {
    return skipRevealAsReady(config);
  }
  const marksGroup = guardRevealRoot({ container: config.container, marksGroupSelector: config.marksGroupSelector ?? ".ts-chart__marks", onPhaseChange: config.onPhaseChange, revealEpoch: config.revealEpoch, seenEpochRef: config.seenEpochRef });
  if (!marksGroup) {
    return { marksGroup: undefined, proceed: false };
  }
  return { marksGroup, proceed: true };
}

const commitRevealGuard = ({ session, marksGroup, seenEpochRef, revealEpoch }: CommitRevealGuardParams): void => {
  session.marksGroup = marksGroup;
  if (seenEpochRef && revealEpoch !== undefined) {
    seenEpochRef.current = revealEpoch;
  }
}

const computeMaxStagger = (elements: readonly Element[], staggerDelayMs: ((index: number, total: number) => number) | undefined): number => {
  if (!staggerDelayMs) {return 0;}
  let maxStagger = 0;
  for (let i = 0; i < elements.length; i += 1) {
    const delay = staggerDelayMs(i, elements.length);
    if (delay > maxStagger) {maxStagger = delay;}
  }
  return maxStagger;
}

const appendAnimationList = (result: readonly Animation[], animations: Animation[]): void => {
  for (let animIndex = 0; animIndex < result.length; animIndex += 1) {
    const anim = result.at(animIndex);
    if (anim) {animations.push(anim);}
  }
}

const appendElementAnimations = (result: RevealAnimationResult, animations: Animation[]): void => {
  if (!result) {return;}
  if (Array.isArray(result)) {
    appendAnimationList(result, animations);
    return;
  }
  animations.push(result);
}

const appendRevealAnimations = ({ elements, animateElement, animations }: AppendRevealAnimationsParams): void => {
  for (let i = 0; i < elements.length; i += 1) {
    const element = elements.at(i);
    if (element !== undefined) {
      appendElementAnimations(animateElement(element, i), animations);
    }
  }
}

const finishRevealAnimations = ({ animations, cleanupAnimation }: FinishRevealAnimationsParams): void => {
  if (cleanupAnimation) {
    for (const anim of animations) {cleanupAnimation(anim);}
  } else {
    for (const anim of animations) {anim.cancel();}
  }
  animations.length = 0;
}

const startRevealPlayback = (config: DeferredRevealConfig, session: RevealSession, marksGroup: RevealRoot): void => {
  const maxStagger = computeMaxStagger(config.elements, config.staggerDelayMs);
  const deadlineMs = config.animationDuration + maxStagger;
  marksGroup.classList.add(REVEALING_CLASS);
  session.revealing = true;
  session.timers.cancelPostPaint = onPostPaint(() => {
    appendRevealAnimations({ animateElement: config.animateElement, animations: session.animations, elements: config.elements });
    marksGroup.classList.remove(REVEALING_CLASS);
    session.revealing = false;
  });
  session.timers.deadlineTimer = setRevealDeadline(deadlineMs, {
    animationsRef: { current: session.animations },
    onDeadline: () => {
      finishRevealAnimations({ animations: session.animations, cleanupAnimation: config.cleanupAnimation });
      config.deadlineCallback?.();
      config.onPhaseChange?.("ready");
    },
  });
}

const runDeferredReveal = (config: DeferredRevealConfig): RevealHandle => {
  const session = createRevealSession();
  const cancel = (): void => {
    cancelRevealSession(session);
  };
  const guard = checkRevealPreconditions(config);
  if (!guard.proceed || !guard.marksGroup) {
    return { cancel };
  }
  commitRevealGuard({ marksGroup: guard.marksGroup, revealEpoch: config.revealEpoch, seenEpochRef: config.seenEpochRef, session });
  config.onPhaseChange?.("revealing");
  startRevealPlayback(config, session, guard.marksGroup);
  return { cancel };
}

export { checkRevealGuard, onPostPaint, runDeferredReveal, setRevealDeadline };
export type { DeferredRevealConfig, RevealHandle };
export { clearRevealed, findRevealRoot, isRevealed, markRevealed } from "./reveal-root";
export type { RevealRoot } from "./reveal-root";
