// Bklit fade-edges + indicator-fade semantics in one module; the edge fade itself is CSS mask-image.
import type { ChartLinearGradient } from "@tanstack/charts";


type FadeEdges = boolean | "left" | "right";

interface FadeSides {
  readonly left: boolean;
  readonly right: boolean;
  readonly any: boolean;
}

const resolveFadeSides = (fade: FadeEdges): FadeSides => {
  if (fade === false) {
    return { any: false, left: false, right: false };
  }
  if (fade === "left") {
    return { any: true, left: true, right: false };
  }
  if (fade === "right") {
    return { any: true, left: false, right: true };
  }
  return { any: true, left: true, right: true };
}

interface FadeGradientStop {
  readonly offset: string;
  readonly opacity: number;
}

const fadeGradientStops = (sides: FadeSides): FadeGradientStop[] => [
    { offset: "0%", opacity: sides.left ? 0 : 1 },
    { offset: "15%", opacity: 1 },
    { offset: "85%", opacity: 1 },
    { offset: "100%", opacity: sides.right ? 0 : 1 },
  ];


// Fade gradient pinned to the viewport, not the series path bounds.
interface ViewportFadeGradientAttrs {
  readonly gradientUnits: "userSpaceOnUse";
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

const viewportFadeGradientAttrs = (innerWidth: number): ViewportFadeGradientAttrs => (
  {
    gradientUnits: "userSpaceOnUse",
    x1: 0,
    x2: innerWidth,
    y1: 0,
    y2: 0,
  }
);

type IndicatorFadeEdges = "both" | "none" | "top" | "bottom";

interface VerticalFadeSides {
  readonly top: boolean;
  readonly bottom: boolean;
  readonly any: boolean;
}

const resolveVerticalFadeSides = (fade: IndicatorFadeEdges | boolean): VerticalFadeSides => {
  if (fade === false || fade === "none") {
    return { any: false, bottom: false, top: false };
  }
  if (fade === true || fade === "both") {
    return { any: true, bottom: true, top: true };
  }
  if (fade === "top") {
    return { any: true, bottom: false, top: true };
  }
  return { any: true, bottom: true, top: false };
}

interface IndicatorFadeGradientStop {
  readonly offset: string;
  readonly opacity: number;
}

const FULL_PERCENT = 100;
// Spec gradients want 0..1 ratios; island stops carry "NN%" strings.
const percentOffsetToRatio = (offset: string): number => {
  const match = /^([0-9.]+)%$/u.exec(offset.trim());
  if (!match) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(match[1]) / FULL_PERCENT));
};

// Bbox vertical fade reproduces a retired plot-span userSpace crosshair gradient.
// The crosshair mark spans the plot, so bbox 0..1 paints the same pixels.
const toSpecCrosshairGradient = (
  def: Readonly<{ color: string; id: string; stops: readonly Readonly<{ offset: string; opacity: number }>[] }>,
): ChartLinearGradient => ({
  id: def.id,
  stops: def.stops.map((stop) => ({ color: def.color, offset: percentOffsetToRatio(stop.offset), opacity: stop.opacity })),
  x1: 0,
  x2: 0,
  y1: 0,
  y2: 1,
});
// Indicator fade length is clamped to this percent at maximum so the gradient never inverts.
const INDICATOR_FADE_MAX_LENGTH_PERCENT = 40;
// Crosshair default fade length in percent (bklit vertical fade "both" default).
const CROSSHAIR_FADE_LENGTH_PERCENT = 10;
// Edge fade length is clamped to this percent at maximum so the two edge fades never overlap.
const EDGE_FADE_MAX_LENGTH_PERCENT = 45;

const indicatorFadeGradientStops = (sides: VerticalFadeSides, fadeLengthPercent = 10): IndicatorFadeGradientStop[] => {
  const fade = Math.min(INDICATOR_FADE_MAX_LENGTH_PERCENT, Math.max(2, fadeLengthPercent));
  const innerEnd = FULL_PERCENT - fade;

  if (!sides.any) {
    return [{ offset: "0%", opacity: 1 }];
  }

  if (sides.top && sides.bottom) {
    return [
      { offset: "0%", opacity: 0 },
      { offset: `${fade}%`, opacity: 1 },
      { offset: "50%", opacity: 1 },
      { offset: `${innerEnd}%`, opacity: 1 },
      { offset: "100%", opacity: 0 },
    ];
  }

  if (sides.top) {
    return [
      { offset: "0%", opacity: 0 },
      { offset: `${fade}%`, opacity: 1 },
      { offset: "100%", opacity: 1 },
    ];
  }

  return [
    { offset: "0%", opacity: 1 },
    { offset: `${innerEnd}%`, opacity: 1 },
    { offset: "100%", opacity: 0 },
  ];
}

// Default crosshair stops (vertical fade "both", fadeLength 10).
const crosshairFadeStops = (): IndicatorFadeGradientStop[] => indicatorFadeGradientStops(resolveVerticalFadeSides("both"), CROSSHAIR_FADE_LENGTH_PERCENT);


const clampFadeLength = (length: number): number => Math.min(EDGE_FADE_MAX_LENGTH_PERCENT, Math.max(0, length));


const edgeFadeMaskStops = (lengthPercent: number): { offset: string; opacity: number }[] => {
  const edge = clampFadeLength(lengthPercent);
  return [
    { offset: "0%", opacity: 0 },
    { offset: `${edge}%`, opacity: 1 },
    { offset: `${FULL_PERCENT - edge}%`, opacity: 1 },
    { offset: "100%", opacity: 0 },
  ];
}

interface FadeEdgesMaskAttrs {
  "data-bkm-fade-edges"?: string;
  "data-bkm-fade-edges-left"?: string;
  "data-bkm-fade-edges-right"?: string;
}

// Caller pre-defaults fadeEdges (Line true, Area false); both-edge fade when any
// Series is non-false, directional attrs per side (CSS :not() picks the variant).
const resolveFadeEdgesMask = (fades: readonly (boolean | "left" | "right")[]): FadeEdgesMaskAttrs => {
  const any = fades.some((fade) => fade !== false);
  const left = fades.some((fade) => fade === true || fade === "left");
  const right = fades.some((fade) => fade === true || fade === "right");
  return {
    "data-bkm-fade-edges": any ? "" : undefined,
    "data-bkm-fade-edges-left": left ? "" : undefined,
    "data-bkm-fade-edges-right": right ? "" : undefined,
  };
}

export type {
  FadeEdges,
  FadeEdgesMaskAttrs,
  FadeGradientStop,
  FadeSides,
  IndicatorFadeEdges,
  IndicatorFadeGradientStop,
  VerticalFadeSides,
};
export {
  clampFadeLength,
  crosshairFadeStops,
  edgeFadeMaskStops,
  fadeGradientStops,
  indicatorFadeGradientStops,
  percentOffsetToRatio,
  resolveFadeEdgesMask,
  resolveFadeSides,
  resolveVerticalFadeSides,
  toSpecCrosshairGradient,
  viewportFadeGradientAttrs,
};
