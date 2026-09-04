import { resolveIndicatorPixelWidth } from "./tooltip-mappers";
import { resolveVerticalFadeSides } from './fade-mask';
import type { IndicatorFadeEdges, VerticalFadeSides } from './fade-mask';
import type { IndicatorWidth } from "./types";

interface IndicatorGeometry {
  pixelWidth: number;
  rectX: number;
  lineX: number;
}

interface ComputeIndicatorGeometryOptions {
  readonly x: number;
  readonly columnWidth: number | undefined;
  readonly span: number | undefined;
  readonly width: IndicatorWidth | undefined;
}

const computeIndicatorGeometry = (
  options: Readonly<ComputeIndicatorGeometryOptions>,
): IndicatorGeometry => {
  const { x, columnWidth, span, width } = options;
  const pixelWidth = resolveIndicatorPixelWidth({ columnWidth, span, width });
  return { lineX: x, pixelWidth, rectX: x - pixelWidth / 2 };
};

interface IndicatorRenderMode {
  fadeSides: VerticalFadeSides;
  // Defined only when the caller passed a non-empty dasharray; mirrors the
  // Original `Boolean(strokeDasharray)` gate exactly ("" and undefined both
  // Fall through to the solid/faded rect rendering).
  resolvedDasharray: string | undefined;
}

const computeIndicatorRenderMode = (
  strokeDasharray: string | undefined,
  fadeEdges: IndicatorFadeEdges | boolean,
): IndicatorRenderMode => ({
  fadeSides: resolveVerticalFadeSides(fadeEdges),
  resolvedDasharray: (strokeDasharray?.length ?? 0) > 0 ? strokeDasharray : undefined,
});

export { computeIndicatorGeometry, computeIndicatorRenderMode };
export type { ComputeIndicatorGeometryOptions, IndicatorGeometry, IndicatorRenderMode };
