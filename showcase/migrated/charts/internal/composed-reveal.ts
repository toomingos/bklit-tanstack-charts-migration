import type { RefObject } from "react";
import { onPostPaint, setRevealDeadline } from "./deferred-reveal";
import { nativeStaggerDelayMs } from "./native-stagger";
import type { ChartPhase } from "./chart-phase";

// Bar reveal stagger spends this fraction of the reveal window spreading bar starts.
const BAR_STAGGER_SPREAD_FRACTION = 0.4;
const MS_PER_SECOND = 1000;

interface RevealBarSpec {
  readonly animate: boolean;
  readonly dataKey: string;
}

interface BarRevealTiming {
  readonly baselinePx: number | undefined;
  readonly easingCss: string;
  readonly revealDurationMs: number;
  readonly staggerDelaySec: number;
}

interface BarStagger {
  readonly deadlineMs: number;
  readonly delaySec: number;
  readonly spreadMs: number;
}

interface AnimateBarGroupParams {
  readonly animations: Animation[];
  readonly bar: Readonly<RevealBarSpec>;
  readonly marks: SVGGElement;
  readonly timing: Readonly<BarRevealTiming>;
}

interface StartBarRevealParams {
  readonly animationsRef: RefObject<Animation[]>;
  readonly baselineRange: readonly number[] | undefined;
  readonly dataLength: number;
  readonly deadlineRef: RefObject<number | null>;
  readonly easingCss: string;
  readonly mountedRef: RefObject<boolean>;
  readonly onPhaseChangeRef: RefObject<((phase: ChartPhase) => void) | undefined>;
  readonly pendingRef: RefObject<boolean>;
  readonly phaseRef: RefObject<ChartPhase>;
  readonly postPaintCancelRef: RefObject<(() => void) | null>;
  readonly resolvedBars: readonly Readonly<RevealBarSpec>[];
  readonly revealDurationMs: number;
}

// Every segment grows from the plot floor (shared bottom edge), stacked or not.
const resolveRevealBaseline = (range: readonly number[] | undefined): number | undefined => {
  if (range?.length !== 2) {
    return undefined;
  }
  return Math.max(range[0], range[1]);
};

const resolveBarStagger = (dataLength: number, revealDurationMs: number): BarStagger => {
  const spreadMs = dataLength > 1 ? revealDurationMs * BAR_STAGGER_SPREAD_FRACTION : 0;
  const delaySec = dataLength > 1 ? spreadMs / MS_PER_SECOND / dataLength : 0;
  return { deadlineMs: revealDurationMs + spreadMs, delaySec, spreadMs };
};

interface AnimateBarRectParams {
  readonly animations: Animation[];
  readonly barIndex: number;
  readonly rectEl: SVGRectElement;
  readonly timing: Readonly<BarRevealTiming>;
}

const animateBarRect = (params: Readonly<AnimateBarRectParams>): void => {
  if (!params.rectEl.isConnected) {
    return;
  }
  const targetY = Number(params.rectEl.getAttribute("y") ?? "0");
  const targetHeight = Number(params.rectEl.getAttribute("height") ?? "0");
  const baselineY =
    params.timing.baselinePx !== undefined && Number.isFinite(params.timing.baselinePx)
      ? params.timing.baselinePx
      : targetY + targetHeight;
  const delaySec = nativeStaggerDelayMs(params.timing.staggerDelaySec, 0, params.barIndex, "bar");
  params.animations.push(params.rectEl.animate(
    [
      { height: "0px", y: String(baselineY) },
      { height: `${targetHeight}px`, y: String(targetY) },
    ],
    {
      delay: delaySec * MS_PER_SECOND,
      duration: params.timing.revealDurationMs,
      easing: params.timing.easingCss,
      fill: "backwards",
    },
  ));
};

const animateBarGroup = (params: Readonly<AnimateBarGroupParams>): void => {
  if (!params.bar.animate) {
    return;
  }
  const escaped = params.bar.dataKey.replaceAll('"', String.raw`\"`);
  const group = params.marks.querySelector<SVGGElement>(
    `.ts-chart__bar-y[data-ts-key="${escaped}"]`,
  );
  if (!group || !group.isConnected) {
    return;
  }
  const rects = group.querySelectorAll<SVGRectElement>("rect");
  for (const [barIndex, rectEl] of rects.entries()) {
    animateBarRect({ animations: params.animations, barIndex, rectEl, timing: params.timing });
  }
};

const runBarPostPaint = (
  params: Readonly<StartBarRevealParams>,
  marks: SVGGElement,
  timing: Readonly<BarRevealTiming>,
): void => {
  if (!params.mountedRef.current || !marks.isConnected) {
    return;
  }
  const animations = params.animationsRef.current;
  for (const bar of params.resolvedBars) {
    animateBarGroup({ animations, bar, marks, timing });
  }
};

const handleBarRevealDeadline = (params: Readonly<StartBarRevealParams>): void => {
  params.deadlineRef.current = null;
  if (params.pendingRef.current) {
    params.pendingRef.current = false;
    if (params.mountedRef.current && params.phaseRef.current === "ready") {
      params.onPhaseChangeRef.current?.("ready");
    }
  }
};

const startBarReveal = (params: Readonly<StartBarRevealParams>, marks: SVGGElement): void => {
  const stagger = resolveBarStagger(params.dataLength, params.revealDurationMs);
  params.pendingRef.current = true;
  const timing: BarRevealTiming = {
    baselinePx: resolveRevealBaseline(params.baselineRange),
    easingCss: params.easingCss,
    revealDurationMs: params.revealDurationMs,
    staggerDelaySec: stagger.delaySec,
  };
  params.postPaintCancelRef.current = onPostPaint(() => {
    runBarPostPaint(params, marks, timing);
  });
  if (params.deadlineRef.current !== null) {
    clearTimeout(params.deadlineRef.current);
  }
  params.deadlineRef.current = setRevealDeadline(stagger.deadlineMs, {
    animationsRef: params.animationsRef,
    onDeadline: () => {
      handleBarRevealDeadline(params);
    },
  });
};

export { startBarReveal };
export type { RevealBarSpec, StartBarRevealParams };
