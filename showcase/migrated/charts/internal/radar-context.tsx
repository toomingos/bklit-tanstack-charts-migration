"use client";

import type { Transition } from "motion/react";
import { createContext, useContext, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

interface RadarMetric {
  /** Unique key for the metric */
  key: string;
  /** Display label for the metric */
  label: string;
}

interface RadarData {
  /** Display label for this data series */
  label: string;
  /** Color for this data series (defaults to chart-1 through chart-5) */
  color?: string;
  /** Metric values (key -> value, normalized 0-100) */
  values: Record<string, number>;
}

interface RadarHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

interface RadarStableContextValue {
  // Data
  data: RadarData[];
  metrics: RadarMetric[];

  // Dimensions
  size: number;
  radius: number;
  levels: number;

  // Animation
  animate: boolean;
  /** Total enter animation budget in ms */
  enterDurationMs: number;
  /** Scales stagger delays between grid / campaigns / metrics */
  staggerScale: number;
  /** Motion enter transition (spring or cubic-bezier tween). */
  enterTransition?: Transition;
  /** Changes when motion settings change — replays enter animations. */
  motionReplayKey: string;

  // Computed helpers
  getColor: (index: number) => string;
  getAngle: (metricIndex: number) => number;
  getPointPosition: (
    metricIndex: number,
    value: number
  ) => { x: number; y: number };
  yScale: (value: number) => number;
}

type RadarContextValue = RadarStableContextValue &
  RadarHoverContextValue;

const RadarStableContext = createContext<RadarStableContextValue | null>(null);
const RadarHoverContext = createContext<RadarHoverContextValue | null>(null);

const RadarProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: RadarContextValue;
}): ReactElement => {
  const stable = useMemo<RadarStableContextValue>(
    () => ({
      animate: value.animate,
      data: value.data,
      enterDurationMs: value.enterDurationMs,
      enterTransition: value.enterTransition,
      getAngle: value.getAngle,
      getColor: value.getColor,
      getPointPosition: value.getPointPosition,
      levels: value.levels,
      metrics: value.metrics,
      motionReplayKey: value.motionReplayKey,
      radius: value.radius,
      size: value.size,
      staggerScale: value.staggerScale,
      yScale: value.yScale,
    }),
    [
      value.animate,
      value.data,
      value.enterDurationMs,
      value.enterTransition,
      value.getAngle,
      value.getColor,
      value.getPointPosition,
      value.levels,
      value.metrics,
      value.motionReplayKey,
      value.radius,
      value.size,
      value.staggerScale,
      value.yScale,
    ]
  );

  const hover = useMemo<RadarHoverContextValue>(
    () => ({
      hoveredIndex: value.hoveredIndex,
      setHoveredIndex: value.setHoveredIndex,
    }),
    [value.hoveredIndex, value.setHoveredIndex]
  );

  return (
    <RadarStableContext.Provider value={stable}>
      <RadarHoverContext.Provider value={hover}>
        {children}
      </RadarHoverContext.Provider>
    </RadarStableContext.Provider>
  );
};

const useRadarStable = (): RadarStableContextValue => {
  const context = useContext(RadarStableContext);
  if (!context) {
    throw new Error(
      "useRadarStable must be used within a RadarProvider. " +
        "Make sure your component is wrapped in <RadarChart>."
    );
  }
  return context;
};

const useRadarHover = (): RadarHoverContextValue => {
  const context = useContext(RadarHoverContext);
  if (!context) {
    throw new Error(
      "useRadarHover must be used within a RadarProvider. " +
        "Make sure your component is wrapped in <RadarChart>."
    );
  }
  return context;
};

const useRadar = (): RadarContextValue => ({ ...useRadarStable(), ...useRadarHover() });

export { RadarProvider, useRadar, useRadarHover, useRadarStable };
export type { RadarContextValue, RadarData, RadarHoverContextValue, RadarMetric, RadarStableContextValue };
