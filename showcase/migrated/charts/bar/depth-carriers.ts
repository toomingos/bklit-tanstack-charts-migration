"use client";
// The BarDepth* children: importing one is what bundles the depth marks (depth.ts).
import { defineCarrier } from "../kit/role";
import { buildDepthMarks, depthBarMark } from "./depth";
import { registerDepth } from "./depth-feature";
import type { BarDepthBackProps, BarDepthFrontProps, BarDepthProviderProps, BarPulseProps } from "./carriers";

registerDepth({ marks: buildDepthMarks, bar: depthBarMark });

/** Wraps the depth children and sets their shared options: segmented side faces, the ground shadow and a minimum bar height. It renders nothing itself; place it as a child of the chart. */
export const BarDepthProvider = /* @__PURE__ */ defineCarrier<BarDepthProviderProps>("barDepthProvider", "BarDepthProvider");
/** The 3D side and top faces of the bars in the depth effect. It renders nothing itself; place it as a child of the chart. */
export const BarDepthBack = /* @__PURE__ */ defineCarrier<BarDepthBackProps>("barDepthBack", "BarDepthBack");
/** The glass front face of the bars in the depth effect. It renders nothing itself; place it as a child of the chart. */
export const BarDepthFront = /* @__PURE__ */ defineCarrier<BarDepthFrontProps>("barDepthFront", "BarDepthFront");
/** A pulsing highlight on one bar (the last by default). It renders nothing itself; place it as a child of the chart. */
export const BarPulse = /* @__PURE__ */ defineCarrier<BarPulseProps>("barPulse", "BarPulse");
