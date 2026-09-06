import type { RefObject } from "react";
import type { ChartPhase, ChartDatum } from "./types";
import type { ChartRendererRenderContext } from "@tanstack/charts";

interface ScatterRevealKeys {
  readonly revealKey: { readonly duration: number; readonly signature: string };
  readonly revealKeyChanged: boolean;
  readonly seen: { readonly duration: number; readonly signature: string } | null;
}

interface ReadScatterRevealKeysParams {
  readonly captureRenderContext: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly context: ChartRendererRenderContext<ChartDatum, Date, number>;
  readonly revealKey: ScatterRevealKeys["revealKey"];
  readonly seenRef: RefObject<ScatterRevealKeys["seen"]>;
}

const readScatterRevealKeys = ({
  captureRenderContext,
  context,
  revealKey,
  seenRef,
}: Readonly<ReadScatterRevealKeysParams>): ScatterRevealKeys & { readonly marksGroup: SVGGElement | null } => {
  const svgRoot = context.surface.element;
  captureRenderContext(context);
  const marksGroup = svgRoot.querySelector<SVGGElement>(".ts-chart__marks");
  const seen = seenRef.current;
  // Test the replay key before the DOM stamp (a latched stamp would swallow signature bumps).
  const revealKeyChanged =
    seen === null || seen.signature !== revealKey.signature || seen.duration !== revealKey.duration;
  return { marksGroup, revealKey, revealKeyChanged, seen };
};

interface SettleStaleRevealTimerParams {
  readonly revealKeyChanged: boolean;
  readonly seen: ScatterRevealKeys["seen"];
  readonly timerRef: RefObject<number | null>;
}

const settleStaleRevealTimer = ({
  revealKeyChanged,
  seen,
  timerRef,
}: Readonly<SettleStaleRevealTimerParams>): boolean => {
  if (seen === null) {return false;}
  if (timerRef.current === null) {return !revealKeyChanged;}
  globalThis.clearTimeout(timerRef.current);
  timerRef.current = null;
  return false;
};

interface ArmScatterRevealParams {
  readonly deadlineMs: number;
  readonly marksGroup: SVGGElement;
  readonly revealKey: ScatterRevealKeys["revealKey"];
  readonly seenRef: RefObject<ScatterRevealKeys["seen"]>;
  readonly setPhase: (phase: ChartPhase) => void;
  readonly timerRef: RefObject<number | null>;
}

const armScatterReveal = ({
  revealKey,
  seenRef,
  setPhase,
  timerRef,
}: Readonly<ArmScatterRevealParams>): void => {
  seenRef.current = { ...revealKey };
  if (timerRef.current !== null) {
    globalThis.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  setPhase("ready");
};

interface HandleScatterRenderParams {
  readonly animationDuration: number;
  readonly captureRenderContext: (context: ChartRendererRenderContext<ChartDatum, Date, number>) => void;
  readonly context: ChartRendererRenderContext<ChartDatum, Date, number>;
  readonly deadlineMs: number;
  readonly revealKey: ScatterRevealKeys["revealKey"];
  readonly seenRef: RefObject<ScatterRevealKeys["seen"]>;
  readonly setPhase: (phase: ChartPhase) => void;
  readonly timerRef: RefObject<number | null>;
}

// Neutralized: dots enter through the renderer, so every render settles ready.
const handleScatterRender = ({
  captureRenderContext,
  context,
  revealKey,
  seenRef,
  setPhase,
  timerRef,
}: Readonly<HandleScatterRenderParams>): void => {
  const state = readScatterRevealKeys({ captureRenderContext, context, revealKey, seenRef });
  if (state.marksGroup === null) {
    setPhase("ready");
    return;
  }
  if (settleStaleRevealTimer({ revealKeyChanged: state.revealKeyChanged, seen: state.seen, timerRef })) {
    setPhase("ready");
    return;
  }
  armScatterReveal({ deadlineMs: 0, marksGroup: state.marksGroup, revealKey: state.revealKey, seenRef, setPhase, timerRef });
};

export { armScatterReveal, handleScatterRender, readScatterRevealKeys, settleStaleRevealTimer };
export type { ArmScatterRevealParams, HandleScatterRenderParams, ReadScatterRevealKeysParams, ScatterRevealKeys, SettleStaleRevealTimerParams };
