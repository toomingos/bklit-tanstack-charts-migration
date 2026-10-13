"use client";
// Config-carrier children for the native LiveLineChart. They render nothing;
// the chart reads their props with the kit's `readChildren` (kit/role.ts).
import type { CurveFactory } from "d3-shape";
import { defineCarrier } from "../kit/role";

export interface MomentumColors {
  up: string;
  down: string;
  flat: string;
}

export interface LiveLineConfig {
  readonly dataKey: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  /** Accepted for API parity; the rolling path contract requires linear segments. */
  readonly curve?: CurveFactory;
  readonly fill?: boolean;
  readonly pulse?: boolean;
  readonly dotSize?: number;
  readonly badge?: boolean;
  readonly formatValue?: (value: number) => string;
  readonly momentumColors?: MomentumColors;
}

export interface LiveXAxisConfig {
  readonly numTicks?: number;
  readonly formatTime?: (time: number) => string;
}

export interface LiveYAxisConfig {
  readonly minGap?: number;
  readonly position?: "left" | "right";
  readonly formatValue?: (value: number) => string;
  readonly allowDecimals?: boolean;
}

export const LiveLine = /* @__PURE__ */ defineCarrier<Readonly<LiveLineConfig>>("liveLine", "LiveLine");
export const LiveXAxis = /* @__PURE__ */ defineCarrier<Readonly<LiveXAxisConfig>>("liveXAxis", "LiveXAxis");
export const LiveYAxis = /* @__PURE__ */ defineCarrier<Readonly<LiveYAxisConfig>>("liveYAxis", "LiveYAxis");
