// Sole package-motion entrypoint for line/area/composed; the clip sweep is retired.
type RevealWipeMarks = SVGGElement;

// Epoch (not the DOM stamp) keys replay; the stamp only guards fresh-node remount.
interface RevealWipeEpochRef {
  current: number | null;
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
  readonly marks: RevealWipeMarks | null | undefined;
  readonly epoch: number;
  readonly epochRef: RevealWipeEpochRef;
  readonly active: boolean;
  readonly animationDuration: number;
  readonly prefersReducedMotion: boolean;
  readonly durationMs: number;
  readonly easingCss: string;
}

// Neutralized: the renderer owns the entrance, so the wipe always settles still.
const runRevealWipe = (params: RunRevealWipeParams): boolean => {
  const { marks, epoch, epochRef } = params;
  if (!marks) {return false;}
  epochRef.current = epoch;
  return applyStillReveal(marks);
}

interface SnapRevealWipeParams {
  readonly marks: RevealWipeMarks | null | undefined;
  readonly active: boolean;
  readonly animationDuration: number;
  readonly prefersReducedMotion: boolean;
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
