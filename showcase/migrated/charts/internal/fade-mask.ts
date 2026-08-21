// Single fade-mask module (initiative 3 D3): verbatim port of bklit
// `fade-edges.ts` + `indicator-fade.ts` semantics in one `internal/` file —
// one impl, one import path. Consumed by:
//   - the hover-chrome crosshair gradient (indicatorFadeGradientStops —
//     replaces the previously inlined `[["0%",0],["10%",1],["50%",1],["90%",1],["100%",0]]`
//     loop duplicated across the five hover-chrome forks),
//   - the line/area edge-fade mask attributes (resolveFadeEdgesMask),
//   - (future) initiative 4 indicator-fade and initiative 10 series dash-tail
//     fades, which re-read these same helpers.
//
// The line/area marks-group fade itself is produced by the CSS `mask-image`
// rules in styles.css (equivalent to bklit's SVG linearGradient mask, no
// rendered-DOM patching); the `resolveFadeEdgesMask` helper below is the
// single source that decides WHICH mask attribute(s) to set.

/** Which side(s) of a series should fade to transparent at the chart edges.
 *  - `true`  → fade both edges (default for `<Line>`)
 *  - `false` → no fade (default for `<Area>`)
 *  - `"left"` / `"right"` → fade only that side */
export type FadeEdges = boolean | "left" | "right";

export interface FadeSides {
  /** Whether the left edge should fade out. */
  left: boolean;
  /** Whether the right edge should fade out. */
  right: boolean;
  /** True if either side fades — use to gate gradient/mask defs. */
  any: boolean;
}

export function resolveFadeSides(fade: FadeEdges): FadeSides {
  if (fade === false) {
    return { left: false, right: false, any: false };
  }
  if (fade === "left") {
    return { left: true, right: false, any: true };
  }
  if (fade === "right") {
    return { left: false, right: true, any: true };
  }
  return { left: true, right: true, any: true };
}

export interface FadeGradientStop {
  offset: string;
  opacity: number;
}

/**
 * Stops for a horizontal fade gradient with opacity 0 at the faded side(s)
 * and opacity 1 in the middle. Matches the historic 0/15/85/100 pattern.
 */
export function fadeGradientStops(sides: FadeSides): FadeGradientStop[] {
  return [
    { offset: "0%", opacity: sides.left ? 0 : 1 },
    { offset: "15%", opacity: 1 },
    { offset: "85%", opacity: 1 },
    { offset: "100%", opacity: sides.right ? 0 : 1 },
  ];
}

/** Horizontal fade gradient pinned to the chart viewport (not the series path
 *  bounds). */
export function viewportFadeGradientAttrs(innerWidth: number) {
  return {
    gradientUnits: "userSpaceOnUse" as const,
    x1: 0,
    x2: innerWidth,
    y1: 0,
    y2: 0,
  };
}

/** Vertical fade on the tooltip crosshair indicator. */
export type IndicatorFadeEdges = "both" | "none" | "top" | "bottom";

export interface VerticalFadeSides {
  top: boolean;
  bottom: boolean;
  any: boolean;
}

export function resolveVerticalFadeSides(
  fade: IndicatorFadeEdges | boolean
): VerticalFadeSides {
  if (fade === false || fade === "none") {
    return { top: false, bottom: false, any: false };
  }
  if (fade === true || fade === "both") {
    return { top: true, bottom: true, any: true };
  }
  if (fade === "top") {
    return { top: true, bottom: false, any: true };
  }
  return { top: false, bottom: true, any: true };
}

export interface IndicatorFadeGradientStop {
  offset: string;
  opacity: number;
}

/** Opacity stops for the crosshair vertical gradient. */
export function indicatorFadeGradientStops(
  sides: VerticalFadeSides,
  fadeLengthPercent = 10
): IndicatorFadeGradientStop[] {
  const fade = Math.min(40, Math.max(2, fadeLengthPercent));
  const innerEnd = 100 - fade;

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

/** bklit TooltipIndicator default: vertical fade `"both"` at `fadeLength=10`.
 *  Single definition site for the crosshair gradient stops previously inlined
 *  in every hover-chrome fork. */
export function crosshairFadeStops(): IndicatorFadeGradientStop[] {
  return indicatorFadeGradientStops(resolveVerticalFadeSides("both"), 10);
}

export function clampFadeLength(length: number): number {
  return Math.min(45, Math.max(0, length));
}

export function edgeFadeMaskStops(lengthPercent: number): Array<{ offset: string; opacity: number }> {
  const edge = clampFadeLength(lengthPercent);
  return [
    { offset: "0%", opacity: 0 },
    { offset: `${edge}%`, opacity: 1 },
    { offset: `${100 - edge}%`, opacity: 1 },
    { offset: "100%", opacity: 0 },
  ];
}

export interface FadeEdgesMaskAttrs {
  /** Set to `""` (present) to enable the both-edge fade mask, else undefined. */
  "data-bkm-fade-edges"?: string;
  /** Set to `""` (present) to enable left-only fade, else undefined. */
  "data-bkm-fade-edges-left"?: string;
  /** Set to `""` (present) to enable right-only fade, else undefined. */
  "data-bkm-fade-edges-right"?: string;
}

/**
 * Resolves the marks-group edge-fade mask attributes for a list of per-series
 * `fadeEdges` values ALREADY defaulted by the caller (`?? true` for <Line>,
 * `?? false` for <Area> — line-chart.tsx / area-chart.tsx apply their own
 * defaults before calling). Reproduces line-chart.tsx's exact attribute
 * computation (single source now): both-edge fade when ANY series is non-false,
 * with the directional left/right attributes set when any series requests that
 * side (the CSS `:not(...)` rules then pick left-only / right-only / both).
 */
export function resolveFadeEdgesMask(
  fades: readonly (boolean | "left" | "right")[]
): FadeEdgesMaskAttrs {
  const any = fades.some((f) => f !== false);
  const left = fades.some((f) => f === true || f === "left");
  const right = fades.some((f) => f === true || f === "right");
  return {
    "data-bkm-fade-edges": any ? "" : undefined,
    "data-bkm-fade-edges-left": left ? "" : undefined,
    "data-bkm-fade-edges-right": right ? "" : undefined,
  };
}
