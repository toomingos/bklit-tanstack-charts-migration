"use client";

import * as React from "react";
import { barDepthAndRise, barDepthMaxDepth } from "./bar-depth-geometry";
import { buildBarSilhouettePath, PULSE_WAVE_DURATION_S, PULSE_WAVE_HEIGHT_MIN_PX, PULSE_WAVE_HEIGHT_RATIO, PULSE_WAVE_PEAK_OPACITY } from "./bar-pulse-mark";
import type { ChartDatum } from "./types";

export interface BarPulseOverlayProps {
  data: ChartDatum[];
  dataKey: string;
  activeIndex?: number;
  pulsePaused?: boolean;
  bandWidth: number;
  bandPos: (label: string) => number;
  categoryAccessor: (d: ChartDatum) => string;
  yAccessor: (d: ChartDatum) => number;
  bandScale?: { step?: () => number };
  innerWidth: number;
  chartX: number;
  yScale: { map: (v: number) => number };
  chartY: number;
  chartHeight: number;
  width: number;
  height: number;
  margin: { top: number; left: number; right: number; bottom: number };
}

export function BarPulseOverlay(props: BarPulseOverlayProps): React.ReactNode {
  const { data, dataKey: _dataKey, activeIndex, pulsePaused, bandWidth, bandPos, categoryAccessor, yAccessor, bandScale, innerWidth, chartX, yScale, chartY: _chartY, chartHeight: _chartHeight, width, height, margin } = props;
  void _dataKey;
  void _chartY;
  void _chartHeight;
  const rectRef = React.useRef<SVGRectElement | null>(null);
  const animRef = React.useRef<Animation | null>(null);
  const clipId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const activeDatum = activeIndex != null && activeIndex >= 0 && activeIndex < data.length ? data[activeIndex] : null;
  const yValue = activeDatum ? (yAccessor(activeDatum) as number) : null;
  const xValue = activeDatum ? categoryAccessor(activeDatum) : null;
  const isInactive = pulsePaused || activeIndex == null || !activeDatum || typeof yValue !== "number" || !Number.isFinite(yValue) || yValue <= 0 || !xValue;

  const baseline = !isInactive ? yScale.map(0) : 0;
  const valuePos = !isInactive ? yScale.map(yValue as number) : 0;
  const barLengthPx = !isInactive && Number.isFinite(valuePos) ? baseline - valuePos : 0;
  const bandX = !isInactive && xValue ? bandPos(String(xValue)) : 0;
  const centerX = chartX + innerWidth / 2;
  const cx = bandX + bandWidth / 2;
  const offsetFromCenter = innerWidth > 0 ? (cx - centerX) / (innerWidth / 2) : 0;
  const isRightOfCenter = offsetFromCenter > 0;
  const absOffset = Math.min(1, Math.abs(offsetFromCenter));
  const step = (bandScale as unknown as { step?: () => number })?.step?.() ?? bandWidth;
  const maxDepth = barDepthMaxDepth(step, bandWidth);
  const depthInfo = !isInactive && barLengthPx > 0 ? barDepthAndRise(absOffset, barLengthPx, maxDepth) : { depth: 0, perspectiveRise: 0 };
  const depth = depthInfo.depth;
  const perspectiveRise = depthInfo.perspectiveRise;
  const topY = valuePos;
  const bottomY = baseline;
  const barHeight = bottomY - topY;
  const silhouettePath = !isInactive && barLengthPx > 0 ? buildBarSilhouettePath(bandX, bandWidth, topY, bottomY, depth, perspectiveRise, isRightOfCenter) : "";
  const waveHeight = Math.max(barHeight * PULSE_WAVE_HEIGHT_RATIO, PULSE_WAVE_HEIGHT_MIN_PX);
  const yAboveLid = topY - perspectiveRise - waveHeight;
  const yBelowFloor = bottomY;
  const yStart = yBelowFloor;
  const yEnd = yAboveLid;
  const gradId = `bar-pulse-grad-${clipId}`;
  const clipPathId = `bar-pulse-clip-${clipId}`;

  React.useLayoutEffect(() => {
    if (isInactive) return;
    const rect = rectRef.current;
    if (!rect) return;
    if (!Number.isFinite(valuePos) || barLengthPx <= 0) return;
    animRef.current?.cancel();
    const anim = rect.animate(
      [{ transform: `translateY(${yStart}px)` }, { transform: `translateY(${yEnd}px)` }],
      { duration: PULSE_WAVE_DURATION_S * 1000, easing: "ease-in-out", iterations: Infinity },
    );
    animRef.current = anim;
    return () => {
      anim.cancel();
      animRef.current = null;
    };
  }, [isInactive, valuePos, barLengthPx, yStart, yEnd]);

  if (isInactive) return null;
  if (!Number.isFinite(valuePos)) return null;
  if (barLengthPx <= 0) return null;

  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden="true">
      <defs>
        <clipPath id={clipPathId}>
          <path d={silhouettePath} />
        </clipPath>
        <linearGradient id={gradId} x1="0" x2="0" y1="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity={0} />
          <stop offset="10%" stopColor="white" stopOpacity={0} />
          <stop offset="22%" stopColor="white" stopOpacity={String(PULSE_WAVE_PEAK_OPACITY * 0.18)} />
          <stop offset="34%" stopColor="white" stopOpacity={String(PULSE_WAVE_PEAK_OPACITY * 0.5)} />
          <stop offset="44%" stopColor="white" stopOpacity={String(PULSE_WAVE_PEAK_OPACITY * 0.85)} />
          <stop offset="50%" stopColor="white" stopOpacity={String(PULSE_WAVE_PEAK_OPACITY)} />
          <stop offset="56%" stopColor="white" stopOpacity={String(PULSE_WAVE_PEAK_OPACITY * 0.85)} />
          <stop offset="66%" stopColor="white" stopOpacity={String(PULSE_WAVE_PEAK_OPACITY * 0.5)} />
          <stop offset="78%" stopColor="white" stopOpacity={String(PULSE_WAVE_PEAK_OPACITY * 0.18)} />
          <stop offset="90%" stopColor="white" stopOpacity={0} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clipPathId})`} transform={`translate(${margin.left},${margin.top})`} className="ts-chart__bar-pulse" style={{ transition: "opacity 0.15s ease-out" } as React.CSSProperties}>
        <rect ref={rectRef} x={bandX - depth - 1} width={bandWidth + 2 * depth + 2} height={waveHeight} fill={`url(#${gradId})`} y={0} />
      </g>
    </svg>
  );
}
