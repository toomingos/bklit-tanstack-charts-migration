// C5/B2/B5 (D432): converts an arbitrary caller-supplied CSS easing string
// (the `animationEasing` prop, e.g. "cubic-bezier(0.85, 0, 0.15, 1)") into
// the JS progress function TanStack's native motion tween accepts.
// `ChartAnimationOptions['easing']` (@tanstack/charts dist/types.d.ts:955)
// is a fixed keyword union or `(progress: number) => number` — never a raw
// CSS string — so the old WAAPI reveal's `revealEasingCss` cannot be handed
// to a mark's `motion` transition directly.
//
// `./bezier-easing.ts` only solves the ONE hardcoded bklit default curve
// (0.85, 0, 0.15, 1) and is shared by other executors' charts (area/line/
// composed-chart.tsx, use-animated-y-domains.ts) — it must not be
// repurposed to take parameters. This is a parallel utility, scoped only to
// bar/candlestick/scatter (the three charts that still expose a raw
// `animationEasing` string prop for their entrance reveal), that
// generalizes the same Newton-iteration cubic-bezier solve to arbitrary
// control points.
import type { ChartAnimationOptions } from "@tanstack/charts";

export type MotionEasing = NonNullable<ChartAnimationOptions["easing"]>;

const NAMED_EASINGS = new Set(["linear", "ease", "ease-in", "ease-out", "ease-in-out"]);

const CUBIC_BEZIER_RE = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/i;

/** Generic cubic-bezier(x1,y1,x2,y2) progress-function solver — same
 * Newton-iteration shape as `./bezier-easing.ts`'s hardcoded version,
 * parametrized over the four control-point coordinates. */
function cubicBezierEasing(x1: number, y1: number, x2: number, y2: number): (p: number) => number {
  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const bx = (t: number) => 3 * t * (1 - t) * (1 - t) * x1 + 3 * t * t * (1 - t) * x2 + t * t * t;
    const by = (t: number) => 3 * t * (1 - t) * (1 - t) * y1 + 3 * t * t * (1 - t) * y2 + t * t * t;
    let t = p;
    for (let i = 0; i < 6; i++) {
      const err = bx(t) - p;
      if (Math.abs(err) < 1e-5) break;
      const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * t * (1 - t) * (x2 - x1) + 3 * t * t * (1 - x2);
      if (dx === 0) break;
      t -= err / dx;
    }
    return by(t);
  };
}

// Matches internal/animation-defaults.ts's DEFAULT_ANIMATION_EASING exactly
// (cubic-bezier(0.85, 0, 0.15, 1)) — the fallback below is deliberately the
// same curve `./bezier-easing.ts` hardcodes, just re-derived generically so
// this module has no runtime dependency on that shared file.
const DEFAULT_EASING = cubicBezierEasing(0.85, 0, 0.15, 1);

/** Converts a bklit `animationEasing` CSS string prop into a native motion
 * tween `easing`. Named CSS keywords pass straight through (native motion
 * accepts the same five: linear/ease/ease-in/ease-out/ease-in-out). A
 * `cubic-bezier(...)` string is solved generically. Anything else
 * unparseable (e.g. `steps(...)`, a CSS custom property) falls back to the
 * bklit default curve rather than throwing. */
export function resolveMotionEasing(css: string | undefined): MotionEasing {
  if (!css) return DEFAULT_EASING;
  const trimmed = css.trim().toLowerCase();
  if (NAMED_EASINGS.has(trimmed)) return trimmed as MotionEasing;
  const match = CUBIC_BEZIER_RE.exec(trimmed);
  if (match) {
    const [, x1, y1, x2, y2] = match;
    return cubicBezierEasing(Number(x1), Number(y1), Number(x2), Number(y2));
  }
  return DEFAULT_EASING;
}
