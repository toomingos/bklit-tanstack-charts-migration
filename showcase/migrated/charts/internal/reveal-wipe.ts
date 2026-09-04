// Sole WAAPI clip-sweep site for line/area/composed; covered mark enters stay suppressed.
type RevealWipeMarks = SVGGElement;

// Epoch (not the DOM stamp) keys replay; the stamp only guards fresh-node remount.
interface RevealWipeEpochRef {
  current: number | null;
}

const isMarksRevealed = (marks: RevealWipeMarks): boolean => marks.dataset.bkmRevealed === "1";

interface RevealIntentParams {
  readonly marks: RevealWipeMarks;
  readonly epoch: number;
  readonly epochRef: RevealWipeEpochRef;
  readonly active: boolean;
  readonly animationDuration: number;
  readonly prefersReducedMotion: boolean;
}

const canAnimateReveal = (active: boolean, animationDuration: number, prefersReducedMotion: boolean): boolean =>
  active && animationDuration > 0 && !prefersReducedMotion;

const shouldAnimateReveal = (params: Readonly<RevealIntentParams>): boolean => {
  const epochUnseen = params.epochRef.current !== params.epoch;
  if (!canAnimateReveal(params.active, params.animationDuration, params.prefersReducedMotion)) {return false;}
  return epochUnseen || !isMarksRevealed(params.marks);
}

const stampRevealed = (marks: RevealWipeMarks): void => {
  marks.dataset.bkmRevealed = "1";
}

const applyStillReveal = (marks: RevealWipeMarks): boolean => {
  stampRevealed(marks);
  marks.style.clipPath = "";
  return false;
}



interface RunRevealWipeParams {
  marks: RevealWipeMarks | null | undefined;
  epoch: number;
  epochRef: RevealWipeEpochRef;
  active: boolean;
  animationDuration: number;
  prefersReducedMotion: boolean;
  durationMs: number;
  easingCss: string;
}

const runRevealWipe = (params: RunRevealWipeParams): boolean => {
  const { marks, epoch, epochRef, active, animationDuration, prefersReducedMotion, durationMs, easingCss } = params;
  if (!marks) {return false;}
  if (!shouldAnimateReveal({ active, animationDuration, epoch, epochRef, marks, prefersReducedMotion })) {
    return applyStillReveal(marks);
  }
  stampRevealed(marks);
  epochRef.current = epoch;
  marks.animate(
    [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
    { duration: durationMs, easing: easingCss },
  );
  return true;
}

interface SnapRevealWipeParams {
  marks: RevealWipeMarks | null | undefined;
  active: boolean;
  animationDuration: number;
  prefersReducedMotion: boolean;
}

const snapRevealWipe = (params: SnapRevealWipeParams): void => {
  const { marks, active, animationDuration, prefersReducedMotion } = params;
  if (!marks || !active) {return;}
  if (prefersReducedMotion || animationDuration <= 0) {
    marks.style.clipPath = "";
    stampRevealed(marks);
  }
}

export { runRevealWipe, snapRevealWipe };
export type { RevealWipeMarks, RevealWipeEpochRef, RunRevealWipeParams, SnapRevealWipeParams };
