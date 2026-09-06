// Traveling line pulse as a placeholder definition (V3.9).
// Motion is the whole-chart pulse; series-path travel is deleted.

"use client";

import { useEffect, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { ChartHost, HOST_INITIAL_WIDTH } from "./chart-host";
import { chartMotionRenderer } from "./motion-renderer";
import { LoadingSweepGradient, loadingSweepPaint } from "./resource-host";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { useSanitizedId } from "./use-sanitized-id";
import { buildLineLoadingDefinition } from "./loading-definitions";
import type { LinePlaceholderDatum } from "./loading-definitions";
import { chartCssVars } from "./chart-context";

// Handoff delay for one-shot exit/enter modes (legacy label-exit duration).
const PULSE_HANDOFF_S = 0.45;
const MS_PER_SECOND = 1000;
// Fallback aspect while responsive (turnkey default "2 / 1").
const PULSE_ASPECT_RATIO = 2;

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

const LineLoadingPulse = ({
  height,
  loopEpoch = 0,
  mode = "loop",
  onCycleComplete,
  pathD,
  stroke = chartCssVars.foreground,
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
  width,
}: Readonly<LineLoadingPulseProps>): ReactElement => {
  void loopEpoch;
  void pathD;
  const reduceMotion = usePrefersReducedMotion();
  const idPrefix = useSanitizedId();
  const isLoop = mode === "loop";
  useEffect((): (() => void) | undefined => {
    if (isLoop || onCycleComplete === undefined) {
      return undefined;
    }
    const timer = setTimeout(onCycleComplete, PULSE_HANDOFF_S * MS_PER_SECOND);
    return (): void => {
      clearTimeout(timer);
    };
  }, [isLoop, onCycleComplete]);
  const paint = reduceMotion ? stroke : loadingSweepPaint(idPrefix);
  const definition = useMemo(
    () =>
      buildLineLoadingDefinition({
        stroke: paint,
        strokeOpacity,
        strokeWidth,
      }),
    [paint, strokeOpacity, strokeWidth],
  );
  const renderer = useMemo(
    () => chartMotionRenderer<LinePlaceholderDatum, number, number>(),
    [],
  );
  const resources = useMemo((): ReactNode => {
    if (reduceMotion) {
      return undefined;
    }
    return <LoadingSweepGradient color={stroke} idPrefix={idPrefix} />;
  }, [idPrefix, reduceMotion, stroke]);
  const fixedWidth = width > 0 ? width : undefined;
  const fixedHeight = height > 0 ? height : undefined;
  return (
    <ChartHost
      ariaLabel="Loading chart"
      aspectRatio={fixedWidth === undefined ? PULSE_ASPECT_RATIO : undefined}
      definition={definition}
      height={fixedHeight}
      idPrefix={idPrefix}
      initialWidth={HOST_INITIAL_WIDTH}
      renderer={renderer}
      resources={resources}
      width={fixedWidth}
    />
  );
};

export { LineLoadingPulse };
export type { LineLoadingPulseMode };
