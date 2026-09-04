import * as React from "react";
import {
  LINE_LOADING_PULSE_CYCLE_S,
  LINE_LOADING_LOOP_PAUSE_MS,
} from "./design-tokens";
import { fadeGradientStops, resolveFadeSides, viewportFadeGradientAttrs } from "./fade-mask";
import { useSanitizedId } from "./use-sanitized-id";

const CLIP_PADDING = 10;

// Three pulse modes (loop/exit/enter); named so callers and resolver share the type.
type LineLoadingPulseMode = "loop" | "exit" | "enter";

// Seconds-to-milliseconds factor for the rAF progress tween.
const MS_PER_SECOND = 1000;
// Mid-cycle progress: the pulse reveal peaks halfway, then exits.
const LINE_LOADING_PULSE_MIDPOINT = 0.5;

interface PulseCompletionParams {
  readonly isCancelled: () => boolean;
  readonly onCycleComplete?: () => void;
}

interface ExitPulseSecondHalfParams extends PulseCompletionParams {
  readonly half: number;
  readonly run: (...args: readonly [from: number, to: number, dur: number, done?: () => void]) => void;
}

// Guarded cycle completion; hoisted so the exit-mode chain stays shallow.
const completePulseCycle = ({ isCancelled, onCycleComplete }: Readonly<PulseCompletionParams>): void => {
  if (isCancelled()) {return;}
  onCycleComplete?.();
};

// Second half of the exit sweep; hoisted so the exit branch nests no deeper than the other modes.
const startExitPulseSecondHalf = ({ half, run, isCancelled, onCycleComplete }: Readonly<ExitPulseSecondHalfParams>): void => {
  if (isCancelled()) {return;}
  run(LINE_LOADING_PULSE_MIDPOINT, 1, half, () => { completePulseCycle({ isCancelled, onCycleComplete }); });
};

const LineLoadingPulse = ({
  pathD,
  width,
  height,
  stroke = "var(--foreground)",
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
  mode = "loop",
  loopEpoch = 0,
  onCycleComplete,
}: Readonly<{
  pathD: string;
  width: number;
  height: number;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  mode?: LineLoadingPulseMode;
  loopEpoch?: number;
  onCycleComplete?: () => void;
}>): React.ReactElement | undefined => {
  const id = useSanitizedId();
  const clipId = `bkm-pulse-clip-${id}`;
  const gradId = `bkm-pulse-grad-${id}`;
  const clipHeight = height + CLIP_PADDING * 2;
  const fadeStops = fadeGradientStops(resolveFadeSides(true));
  const { gradientUnits, x1, x2, y1, y2 } = viewportFadeGradientAttrs(width);

  const [progress, setProgress] = React.useState(0);
  const animRef = React.useRef<Animation | null>(null);

  // Latest callback and progress stay out of the effect dependencies.
  // Restarting the sweep on their identity change would break the loop.
  const notifyCycleComplete = React.useEffectEvent((): void => {
    onCycleComplete?.();
  });
  const readProgress = React.useEffectEvent((): number => progress);

  // Render-phase reset per the React docs pattern for previous renders.
  // Loop and enter modes always restart the sweep from zero.
  // Committing zero directly avoids a synchronous setState in the effect.
  // Exit mode preserves the in-flight progress untouched.
  const [prevPulseInputs, setPrevPulseInputs] = React.useState({ loopEpoch, mode, width });
  if (prevPulseInputs.loopEpoch !== loopEpoch || prevPulseInputs.mode !== mode || prevPulseInputs.width !== width) {
    setPrevPulseInputs({ loopEpoch, mode, width });
    if (mode === "loop" || mode === "enter") {
      setProgress(0);
    }
  }

  React.useEffect(() => {
    const el = document.querySelector(`#${clipId}-rect`);
    if (!(el instanceof SVGRectElement) || width <= 0) {return undefined;}
    const half = LINE_LOADING_PULSE_CYCLE_S / 2;
    let cancelled = false;
    const run = (from: number, to: number, dur: number, done?: () => void): void => {
      try { animRef.current?.cancel(); } catch {
        // Superseded pulse already settled — nothing to cancel.
      }
      let start: number | undefined = undefined;
      const step = (now: number): void => {
        if (cancelled) {return;}
        start ??= now;
        const ratio = Math.min(1, (now - start) / (dur * MS_PER_SECOND));
        const cur = from + (to - from) * ratio;
        setProgress(cur);
        if (ratio < 1) {requestAnimationFrame(step);}
        else {done?.();}
      };
      requestAnimationFrame(step);
    };
    if (mode === "loop") {
      run(0, 1, LINE_LOADING_PULSE_CYCLE_S, () => {
        if (!cancelled) {
          globalThis.setTimeout(() => notifyCycleComplete(), LINE_LOADING_LOOP_PAUSE_MS);
        }
      });
    } else if (mode === "enter") {
      run(0, LINE_LOADING_PULSE_MIDPOINT, half, () => { if (!cancelled) {notifyCycleComplete();} });
    } else if (mode === "exit") {
      const cur = readProgress();
      if (cur < LINE_LOADING_PULSE_MIDPOINT) {
        run(cur, LINE_LOADING_PULSE_MIDPOINT, half * ((LINE_LOADING_PULSE_MIDPOINT - cur) / LINE_LOADING_PULSE_MIDPOINT), () => { startExitPulseSecondHalf({ half, isCancelled: () => cancelled, onCycleComplete: notifyCycleComplete, run }); });
      } else {
        run(cur, 1, half * ((1 - cur) / LINE_LOADING_PULSE_MIDPOINT), () => { completePulseCycle({ isCancelled: () => cancelled, onCycleComplete: notifyCycleComplete }); });
      }
    } else {
      // All pulse modes are handled above — nothing left to run.
    }
    return (): void => { cancelled = true; };
  }, [clipId, width, loopEpoch, mode]);

  const paddedW = width + CLIP_PADDING * 2;
  const rightEdge = width + CLIP_PADDING;
  const clipW = progress <= LINE_LOADING_PULSE_MIDPOINT ? (progress / LINE_LOADING_PULSE_MIDPOINT) * paddedW : (1 - (progress - LINE_LOADING_PULSE_MIDPOINT) / LINE_LOADING_PULSE_MIDPOINT) * paddedW;
  const clipX = progress <= LINE_LOADING_PULSE_MIDPOINT ? -CLIP_PADDING : rightEdge - clipW;

  if (width <= 0 || !pathD) {return undefined;}

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect id={`${clipId}-rect`} height={clipHeight} width={clipW} x={clipX} y={-CLIP_PADDING} />
        </clipPath>
        <linearGradient id={gradId} gradientUnits={gradientUnits} x1={x1} x2={x2} y1={y1} y2={y2}>
          {fadeStops.map((stop: Readonly<{ offset: string; opacity: number }>) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stroke} stopOpacity={stop.opacity} />
          ))}
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill="none"
        clipPath={`url(#${clipId})`}
        stroke={`url(#${gradId})`}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        opacity={strokeOpacity}
      />
    </>
  );
}

export { LineLoadingPulse };
export type { LineLoadingPulseMode };
