// The native `brushX` factory, supplied by kit/brush.tsx so charts that never import ChartBrush do not bundle d3-brush.
import type { brushX } from "@tanstack/charts/interaction/brush";

export type BrushXFactory = typeof brushX;

let factory: BrushXFactory | undefined;

export const registerBrushX = (next: BrushXFactory): void => {
  factory = next;
};

export const getBrushX = (): BrushXFactory | undefined => factory;
