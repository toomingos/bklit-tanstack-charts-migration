"use client";

// bklit-compatible radar context: lets custom children read geometry and drive hover (bklit exports these hooks publicly).
import { createContext, useContext, useMemo } from "react";
import { useHoverIndex } from "../kit/polar/polar-hover";
import type { HoverSource } from "../kit/polar/polar-hover";
import type { ReactElement, ReactNode } from "react";
import type { RadarData, RadarMetric } from "./rows";

interface RadarHoverContextValue {
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

interface RadarStableContextValue {
  data: RadarData[];
  metrics: RadarMetric[];
  size: number;
  radius: number;
  levels: number;
  animate: boolean;
  enterDurationMs: number;
  staggerScale: number;
  enterTransition?: unknown;
  motionReplayKey: string;
  getColor: (index: number) => string;
  getAngle: (metricIndex: number) => number;
  getPointPosition: (metricIndex: number, value: number) => { x: number; y: number };
  yScale: (value: number) => number;
}

export type RadarContextValue = RadarStableContextValue & RadarHoverContextValue;
export type RadarProviderValue = RadarStableContextValue & Pick<RadarHoverContextValue, "setHoveredIndex">;

export const radarCssVars = {
  area1: "var(--chart-1)",
  area2: "var(--chart-2)",
  area3: "var(--chart-3)",
  area4: "var(--chart-4)",
  area5: "var(--chart-5)",
  background: "var(--chart-background)",
  border: "var(--border)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  grid: "var(--chart-grid)",
  label: "var(--chart-label, oklch(0.65 0.01 260))",
};

const StableContext = createContext<RadarStableContextValue | null>(null);
const HoverContext = createContext<{ readonly source: HoverSource; readonly setHoveredIndex: RadarHoverContextValue["setHoveredIndex"] } | null>(null);

export const RadarProvider = ({ children, value, source }: { children: ReactNode; value: RadarProviderValue; source: HoverSource }): ReactElement => {
  // Nothing here reads the hovered index: the provider value only holds the store reference, so a hover never re-renders
  // this component or anything wrapped by it. The hook consumers (leaves) subscribe through useHoverIndex.
  const { setHoveredIndex, ...stable } = value;
  const hoverHandle = useMemo(() => ({ setHoveredIndex, source }), [setHoveredIndex, source]);
  const stableMemo = useMemo(() => stable, [value.data, value.metrics, value.size, value.radius, value.levels, value.animate, value.enterDurationMs, value.staggerScale, value.motionReplayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <StableContext.Provider value={stableMemo}>
      <HoverContext.Provider value={hoverHandle}>{children}</HoverContext.Provider>
    </StableContext.Provider>
  );
};

export const useRadarStable = (): RadarStableContextValue => {
  const context = useContext(StableContext);
  if (!context) { throw new Error("useRadarStable must be used within a RadarProvider. Make sure your component is wrapped in <RadarChart>."); }
  return context;
};

export const useRadarHover = (): RadarHoverContextValue => {
  const context = useContext(HoverContext);
  if (!context) { throw new Error("useRadarHover must be used within a RadarProvider. Make sure your component is wrapped in <RadarChart>."); }
  const hoveredIndex = useHoverIndex(context.source);
  return useMemo(() => ({ hoveredIndex, setHoveredIndex: context.setHoveredIndex }), [hoveredIndex, context.setHoveredIndex]);
};

export const useRadar = (): RadarContextValue => {
  const stable = useRadarStable();
  const hover = useRadarHover();
  return useMemo(() => ({ ...stable, ...hover }), [stable, hover]);
};
