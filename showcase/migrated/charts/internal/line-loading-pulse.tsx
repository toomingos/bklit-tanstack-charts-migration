import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import { LINE_LOADING_PULSE_CYCLE_S } from "./design-tokens";
import { fadeGradientStops, resolveFadeSides, viewportFadeGradientAttrs } from "./fade-mask";
import type { FadeGradientStop } from "./fade-mask";
import { LINE_LOADING_PULSE_MIDPOINT, createPulseTween, startPulseMode } from "./line-loading-sweep";
import { useSanitizedId } from "./use-sanitized-id";

const CLIP_PADDING = 10;

// Three pulse modes (loop/exit/enter); named so callers and resolver share the type.
type LineLoadingPulseMode = "loop" | "exit" | "enter";

interface LineLoadingPulseProps {
  readonly height: number;
  readonly loopEpoch?: number;
  readonly mode?: LineLoadingPulseMode;
  readonly onCycleComplete?: () => void;
  readonly pathD: string;
  readonly stroke?: string;
  readonly strokeOpacity?: number;
  readonly strokeWidth?: number;
  readonly width: number;
}

interface PulseClipInput {
  readonly progress: number;
  readonly width: number;
}

interface PulseClipGeometry {
  readonly clipWidth: number;
  readonly clipX: number;
}

interface PulseFrameParams {
  readonly height: number;
  readonly id: string;
}

interface PulseFrame {
  readonly clipHeight: number;
  readonly clipId: string;
  readonly gradId: string;
}

interface PulseGradientParams {
  readonly width: number;
}

interface PulseGradient {
  readonly fadeStops: FadeGradientStop[];
  readonly gradientUnits: "userSpaceOnUse";
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

interface PulseDefsParams {
  readonly clipHeight: number;
  readonly clipId: string;
  readonly fadeStops: readonly Readonly<FadeGradientStop>[];
  readonly gradId: string;
  readonly gradientUnits: "userSpaceOnUse";
  readonly progress: number;
  readonly stroke: string;
  readonly width: number;
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

interface PulseProgressResetParams {
  readonly loopEpoch: number;
  readonly mode: LineLoadingPulseMode;
  readonly setProgress: Dispatch<SetStateAction<number>>;
  readonly width: number;
}

interface PulseSweepParams {
  readonly animRef: RefObject<Animation | null>;
  readonly clipId: string;
  readonly loopEpoch: number;
  readonly mode: LineLoadingPulseMode;
  readonly onCycleComplete?: () => void;
  readonly progress: number;
  readonly setProgress: Dispatch<SetStateAction<number>>;
  readonly width: number;
}

// Clip rect geometry for one progress value; pure so the sweep effect and defs share it.
const resolvePulseClipGeometry = ({ progress, width }: Readonly<PulseClipInput>): PulseClipGeometry => {
  const paddedWidth = width + CLIP_PADDING * 2;
  const rightEdge = width + CLIP_PADDING;
  if (progress <= LINE_LOADING_PULSE_MIDPOINT) {
    const clipWidth = (progress / LINE_LOADING_PULSE_MIDPOINT) * paddedWidth;
    return { clipWidth, clipX: -CLIP_PADDING };
  }
  const clipWidth = (1 - (progress - LINE_LOADING_PULSE_MIDPOINT) / LINE_LOADING_PULSE_MIDPOINT) * paddedWidth;
  return { clipWidth, clipX: rightEdge - clipWidth };
};

// Clip and gradient identifiers stay stable per sanitized id so the sweep effect reuses them.
const resolvePulseFrame = ({ height, id }: Readonly<PulseFrameParams>): PulseFrame => ({
  clipHeight: height + CLIP_PADDING * 2,
  clipId: `bkm-pulse-clip-${id}`,
  gradId: `bkm-pulse-grad-${id}`,
});

// The pulse reuses the viewport-pinned fade gradient so edges soften like the line series.
const resolvePulseGradient = ({ width }: Readonly<PulseGradientParams>): PulseGradient => {
  const fadeStops = fadeGradientStops(resolveFadeSides(true));
  const { gradientUnits, x1, x2, y1, y2 } = viewportFadeGradientAttrs(width);
  return { fadeStops, gradientUnits, x1, x2, y1, y2 };
};

// Defs subtree rendered through a plain function call so the clip rect updates in place.
// A separate component type would remount the subtree instead of updating it.
const renderPulseDefs = ({
  clipHeight, clipId, fadeStops, gradId, gradientUnits, progress, stroke, width, x1, x2, y1, y2,
}: Readonly<PulseDefsParams>): ReactElement => {
  const { clipWidth, clipX } = resolvePulseClipGeometry({ progress, width });
  const stopNodes = fadeStops.map((stop: Readonly<FadeGradientStop>) => (
    <stop key={stop.offset} offset={stop.offset} stopColor={stroke} stopOpacity={stop.opacity} />
  ));
  return (
    <defs>
      <clipPath id={clipId}>
        <rect id={`${clipId}-rect`} height={clipHeight} width={clipWidth} x={clipX} y={-CLIP_PADDING} />
      </clipPath>
      <linearGradient id={gradId} gradientUnits={gradientUnits} x1={x1} x2={x2} y1={y1} y2={y2}>
        {stopNodes}
      </linearGradient>
    </defs>
  );
};

// The rAF sweep owns its effect-event callbacks so the component body stays small.
// Latest callback and progress stay out of the effect dependencies.
// Restarting the sweep on their identity change would break the loop.
// Effect dependencies are unchanged to keep the loop stable.
const usePulseSweep = ({
  animRef, clipId, loopEpoch, mode, onCycleComplete, progress, setProgress, width,
}: Readonly<PulseSweepParams>): void => {
  const notifyCycleComplete = useEffectEvent((): void => {
    onCycleComplete?.();
  });
  const readProgress = useEffectEvent((): number => progress);
  useEffect(() => {
    const el = document.querySelector(`#${clipId}-rect`);
    if (!(el instanceof SVGRectElement) || width <= 0) {return undefined;}
    let cancelled = false;
    const isCancelled = (): boolean => cancelled;
    const run = createPulseTween({ animRef, isCancelled, setProgress });
    startPulseMode({ half: LINE_LOADING_PULSE_CYCLE_S / 2, isCancelled, mode, notifyCycleComplete, readProgress, run });
    return (): void => { cancelled = true; };
  }, [animRef, clipId, loopEpoch, mode, setProgress, width]);
};

// Render-phase reset per the React docs pattern for previous renders.
// Loop and enter modes always restart the sweep from zero.
// Committing zero directly avoids a synchronous setState in the effect.
// Exit mode preserves the in-flight progress untouched.
const usePulseProgressReset = ({ loopEpoch, mode, setProgress, width }: Readonly<PulseProgressResetParams>): void => {
  const [prevPulseInputs, setPrevPulseInputs] = useState({ loopEpoch, mode, width });
  if (prevPulseInputs.loopEpoch !== loopEpoch || prevPulseInputs.mode !== mode || prevPulseInputs.width !== width) {
    setPrevPulseInputs({ loopEpoch, mode, width });
    if (mode === "loop" || mode === "enter") {
      setProgress(0);
    }
  }
};

const LineLoadingPulse = ({
  height,
  loopEpoch = 0,
  mode = "loop",
  onCycleComplete,
  pathD,
  stroke = "var(--foreground)",
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
  width,
}: Readonly<LineLoadingPulseProps>): ReactElement | undefined => {
  const id = useSanitizedId();
  const frame = resolvePulseFrame({ height, id });
  const gradient = resolvePulseGradient({ width });
  const [progress, setProgress] = useState(0);
  const animRef = useRef<Animation | null>(null);
  usePulseProgressReset({ loopEpoch, mode, setProgress, width });
  usePulseSweep({ animRef, clipId: frame.clipId, loopEpoch, mode, onCycleComplete, progress, setProgress, width });
  if (width <= 0 || !pathD) {return undefined;}
  return (
    <>
      {renderPulseDefs({
        clipHeight: frame.clipHeight,
        clipId: frame.clipId,
        fadeStops: gradient.fadeStops,
        gradId: frame.gradId,
        gradientUnits: gradient.gradientUnits,
        progress,
        stroke,
        width,
        x1: gradient.x1,
        x2: gradient.x2,
        y1: gradient.y1,
        y2: gradient.y2,
      })}
      <path
        d={pathD}
        fill="none"
        clipPath={`url(#${frame.clipId})`}
        stroke={`url(#${frame.gradId})`}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        opacity={strokeOpacity}
      />
    </>
  );
}

export { LineLoadingPulse };
export type { LineLoadingPulseMode };
