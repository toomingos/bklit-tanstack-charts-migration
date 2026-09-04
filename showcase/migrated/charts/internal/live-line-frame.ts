// Live-line animation frame: y-domain targets, per-tick lerp, and the RAF loop.
// Commits to React at LIVE_FRAME_COMMIT_MS; samples carry true values.
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

interface LiveLinePoint {
  readonly time: number;
  readonly value: number;
}

/** React commit interval (~30fps); doubles as the rolling-path tween so commits hand off continuously. */
const LIVE_FRAME_COMMIT_MS = 32;
/** Skip commits under a quarter pixel of change: invisible, but rebuilds the whole definition. */
const PAUSED_FRAME_PIXEL_THRESHOLD = 0.25;
/** Y-domain padding around the live range; exaggerate mode hugs the line. */
const EXAGGERATED_RANGE_PADDING_FACTOR = 0.03;
const STANDARD_RANGE_PADDING_FACTOR = 0.15;
/** Fallback pad when the live range is flat (rawRange is 0). */
const EXAGGERATED_FLAT_RANGE_PAD = 0.04;
const STANDARD_FLAT_RANGE_PAD = 10;

interface AnimFrame {
  readonly now: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly displayValue: number;
  /** True current value, never lerped; committed samples read this, not displayValue. */
  readonly trueValue: number;
  /** Bumped per commit (not per tick); mints fresh keys for synthetic tip samples. */
  readonly seq: number;
}

// Named owner contract for the live y-domain target (replaces the inline
// Anonymous return type the widening rule rejects).
interface TargetRange {
  readonly yMax: number;
  readonly yMin: number;
}

interface LiveExtremes {
  readonly max: number;
  readonly min: number;
}

const widenExtremes = (extremes: Readonly<LiveExtremes>, value: number): LiveExtremes => {
  if (value < extremes.min) {return { max: extremes.max, min: value };}
  if (value > extremes.max) {return { max: value, min: extremes.min };}
  return extremes;
};

const measureLiveRange = (data: readonly Readonly<LiveLinePoint>[], value: number): LiveExtremes => {
  let extremes: LiveExtremes = { max: Number.NEGATIVE_INFINITY, min: Number.POSITIVE_INFINITY };
  for (const point of data) {
    extremes = widenExtremes(extremes, point.value);
  }
  return widenExtremes(extremes, value);
};

const computeTargetRange = (
  data: readonly Readonly<LiveLinePoint>[],
  value: number,
  exaggerate: boolean,
): TargetRange => {
  if (data.length === 0) {
    return { yMax: 100, yMin: 0 };
  }
  const extremes = measureLiveRange(data, value);
  const rawRange = extremes.max - extremes.min;
  const paddingFactor = exaggerate ? EXAGGERATED_RANGE_PADDING_FACTOR : STANDARD_RANGE_PADDING_FACTOR;
  const rangePad = rawRange * paddingFactor || (exaggerate ? EXAGGERATED_FLAT_RANGE_PAD : STANDARD_FLAT_RANGE_PAD);
  return { yMax: extremes.max + rangePad, yMin: extremes.min - rangePad };
};

interface NextAnimFrameOptions {
  readonly isPaused: boolean;
  readonly prev: Readonly<AnimFrame>;
  readonly speed: number;
  readonly targetRange: TargetRange;
  readonly targetValue: number;
}

const nextAnimFrame = (options: Readonly<NextAnimFrameOptions>): Omit<AnimFrame, "seq"> => {
  const { isPaused, prev, speed, targetRange, targetValue } = options;
  const nextNow = isPaused ? prev.now : Date.now();
  const nextYMin =
    targetRange.yMin < prev.yMin
      ? targetRange.yMin
      : prev.yMin + (targetRange.yMin - prev.yMin) * speed;
  const nextYMax =
    targetRange.yMax > prev.yMax
      ? targetRange.yMax
      : prev.yMax + (targetRange.yMax - prev.yMax) * speed;
  const nextValue = prev.displayValue + (targetValue - prev.displayValue) * speed;
  return { displayValue: nextValue, now: nextNow, trueValue: targetValue, yMax: nextYMax, yMin: nextYMin };
};

const frameChangePixels = (prev: Readonly<AnimFrame>, next: Readonly<AnimFrame>, height: number): number => {
  const range = Math.max(Math.abs(prev.yMax - prev.yMin), Math.abs(next.yMax - next.yMin));
  if (range <= 0 || height <= 0) {return Number.POSITIVE_INFINITY;}
  const domainChange = Math.max(
    Math.abs(next.yMin - prev.yMin),
    Math.abs(next.yMax - prev.yMax),
  );
  const valueChange = Math.abs(next.displayValue - prev.displayValue);
  return (Math.max(domainChange, valueChange) / range) * height;
};

interface UseLiveFrameOptions {
  readonly data: readonly LiveLinePoint[];
  readonly exaggerate: boolean;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly lerpSpeed: number;
  readonly paused: boolean;
  readonly value: number;
}

interface LiveFrameState {
  readonly frame: AnimFrame;
  readonly targetRange: TargetRange;
}

const useLiveFrame = (options: Readonly<UseLiveFrameOptions>): LiveFrameState => {
  const { data, exaggerate, innerHeight, innerWidth, lerpSpeed, paused, value } = options;
  const [frame, setFrame] = useState<AnimFrame>(() => ({ displayValue: value, now: Date.now(), seq: 0, trueValue: value, yMax: 100, yMin: 0 }));
  const animRef = useRef<AnimFrame>(frame);
  const committedFrameRef = useRef(frame);
  const seqRef = useRef(0);

  const pausedRef = useRef(paused);
  const valueRef = useRef(value);
  const lerpSpeedRef = useRef(lerpSpeed);

  const targetRange = useMemo(
    () => computeTargetRange(data, value, exaggerate),
    [data, value, exaggerate],
  );
  const targetRangeRef = useRef(targetRange);
  // Sync the latest values for the RAF loop; the loop reads them asynchronously so effect timing preserves behaviour.
  useEffect(() => {
    pausedRef.current = paused;
    valueRef.current = value;
    lerpSpeedRef.current = lerpSpeed;
    targetRangeRef.current = targetRange;
  }, [paused, value, lerpSpeed, targetRange]);

  useEffect(() => {
    if (innerWidth <= 0 || innerHeight <= 0) {
      return (): void => {
        // Zero-area chart: no frame loop to cancel.
      };
    }
    let raf = 0;
    let lastFrameCommit = 0;
    const tick = (): void => {
      raf = 0;
      const next = nextAnimFrame({
        isPaused: pausedRef.current,
        prev: animRef.current,
        speed: lerpSpeedRef.current,
        targetRange: targetRangeRef.current,
        targetValue: valueRef.current,
      });
      animRef.current = { ...next, seq: animRef.current.seq };

      const now = performance.now();
      const pixelChange = frameChangePixels(committedFrameRef.current, animRef.current, innerHeight);
      const shouldWake = !pausedRef.current || pixelChange >= PAUSED_FRAME_PIXEL_THRESHOLD;
      if (shouldWake && now - lastFrameCommit >= LIVE_FRAME_COMMIT_MS) {
        lastFrameCommit = now;
        seqRef.current += 1;
        const committed: AnimFrame = { ...next, seq: seqRef.current };
        committedFrameRef.current = committed;
        animRef.current = committed;
        startTransition(() =>{  setFrame(committed); });
      }
      if (!shouldWake) {return;}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return (): void => {
      if (raf !== 0) {cancelAnimationFrame(raf);}
    };
  }, [innerWidth, innerHeight]);

  return { frame, targetRange };
};

export { LIVE_FRAME_COMMIT_MS, useLiveFrame };
export type { AnimFrame, LiveFrameState, LiveLinePoint, TargetRange, UseLiveFrameOptions };
