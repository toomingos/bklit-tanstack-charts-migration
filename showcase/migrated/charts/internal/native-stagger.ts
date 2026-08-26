// T-D3 — bridge to TanStack's native per-index stagger primitive
// (`stagger()` from `@tanstack/charts/motion/definition`), used purely as a
// delay-VALUE calculator.
//
// None of this package's enter-reveal choreography is wired into TanStack's
// own motion pipeline: every caller below drives its reveal with hand-rolled
// WAAPI (`Element.animate()` / CSS animation properties), reproducing
// bklit's exact keyframes/easing byte-for-byte, entirely outside TanStack's
// render/motion cycle. That means there is no `ChartMotionContext` supplied
// by a TanStack renderer to feed `stagger()`'s `delay(context)` callback —
// this helper builds a minimal synthetic one instead.
//
// Only two fields of `ChartMotionContext` are actually read by the delay fn
// (see `motion-definition.ts`): `phase` (must equal `'enter'`, or the fn
// returns `undefined`) and `datumIndex` (since none of these call sites pass
// `by: 'series'`). `role` only matters if a `roles` restriction is passed to
// `stagger()` — none of these calls do — and the remaining
// `ChartMotionContext` fields are structurally required by the type but
// functionally inert for this use; they're filled with harmless
// placeholders.
import { stagger as nativeStagger } from "@tanstack/charts/motion/definition";
import type { ChartMotionContext, ChartMotionRole } from "@tanstack/charts";

/**
 * Computes `offset + each * index` via TanStack's native `stagger()`
 * primitive, replacing a hand-rolled `offset + each * index` formula.
 * `each`/`offset` must already be resolved to milliseconds (any
 * scale/duration factors folded in by the caller) — this function performs
 * no unit conversion of its own, matching how the formulas it replaces were
 * written.
 */
export function nativeStaggerDelayMs(
  each: number,
  offset: number,
  index: number,
  role: ChartMotionRole = "mark",
): number {
  const { delay } = nativeStagger({ each, offset });
  const context: ChartMotionContext = {
    phase: "enter",
    role,
    key: String(index),
    seriesKey: "",
    seriesIndex: index,
    datumIndex: index,
    datumCount: 0,
    datum: undefined,
    point: undefined,
  };
  const delayFn = delay as (context: ChartMotionContext) => number | undefined;
  return delayFn(context) ?? 0;
}
