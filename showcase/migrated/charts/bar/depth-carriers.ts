"use client";
// The BarDepth* children: importing one is what bundles the depth marks (depth.ts).
import { defineCarrier } from "../kit/role";
import { buildDepthMarks, depthBarMark } from "./depth";
import { registerDepth } from "./depth-feature";
import type { BarDepthBackProps, BarDepthFrontProps, BarDepthProviderProps, BarPulseProps } from "./carriers";

registerDepth({ marks: buildDepthMarks, bar: depthBarMark });

export const BarDepthProvider = /* @__PURE__ */ defineCarrier<BarDepthProviderProps>("barDepthProvider", "BarDepthProvider");
export const BarDepthBack = /* @__PURE__ */ defineCarrier<BarDepthBackProps>("barDepthBack", "BarDepthBack");
export const BarDepthFront = /* @__PURE__ */ defineCarrier<BarDepthFrontProps>("barDepthFront", "BarDepthFront");
export const BarPulse = /* @__PURE__ */ defineCarrier<BarPulseProps>("barPulse", "BarPulse");
