// Verbatim port of repos/bklit-ui/packages/ui/src/charts/heatmap/
// heatmap-animation.ts — the seeded-PRNG reveal-delay math and lifecycle
// timing constants (docs/LOG.md D31: "seeded-PRNG per-cell reveal delays
// (Lehmer PRNG) via WAAPI").
//
// All constants below are verbatim (values AND doc comments) against the
// real bklit source re-verified directly — no discrepancy between bklit's
// own JSDoc and its runtime defaults was found for
// HEATMAP_LOADING_CHART_OPACITY (1) or HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS
// (1); an earlier draft of this file incorrectly asserted a "stale JSDoc"
// discrepancy for these two constants, which has been corrected here after
// re-reading the real source.

import { getHeatmapContributionLevel } from "./heatmap-utils";

export const HEATMAP_DEFAULT_ENTER_DURATION_MS = 1600;
export const HEATMAP_DEFAULT_ENTER_EASE = [0.85, 0, 0.916, 0.282] as const;

export interface HeatmapEnterTransition {
  type?: "tween" | "spring";
  duration?: number;
  ease?: readonly [number, number, number, number];
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  delay?: number;
}

export const HEATMAP_DEFAULT_ENTER_TRANSITION: HeatmapEnterTransition = {
  type: "tween",
  duration: 1.6,
  ease: HEATMAP_DEFAULT_ENTER_EASE,
};

/** Chart opacity while `status="loading"` (verbatim). */
export const HEATMAP_LOADING_CHART_OPACITY = 1;

/** Default max per-cell opacity during loading shimmer (verbatim). */
export const HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY = 0.85;

/** Default share of cells that participate in loading shimmer, 0-1 (verbatim). */
export const HEATMAP_DEFAULT_LOADING_CELL_RANDOMNESS = 1;

export const HEATMAP_LOADING_BASE_CELL_OPACITY = 0.2;
export const HEATMAP_LOADING_CONCEAL_MS = 450;
export const HEATMAP_ENTER_STAGGER_SPREAD = 0.6;

// --- Lehmer / Park-Miller PRNG (verbatim) -----------------------------------

export function seededRandom(seed: number): () => number {
  let state = seed % 2_147_483_647;
  if (state <= 0) state += 2_147_483_646;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

export function heatmapCellSeed(column: number, row: number): number {
  return column * 1009 + row * 9176;
}

export interface ComputeHeatmapEnterFadeDelayParams {
  column: number;
  row: number;
  revealEpoch: number;
  animationDurationMs: number;
  enterStaggerScale: number;
  fadeDurationSec: number;
}

export function computeHeatmapEnterFadeDelayMs(params: ComputeHeatmapEnterFadeDelayParams): number {
  const seed = heatmapCellSeed(params.column, params.row) + params.revealEpoch * 524_287;
  const random = seededRandom(seed);
  const fadeMs = params.fadeDurationSec * 1000;
  const maxDelayMs = Math.max(0, params.animationDurationMs - fadeMs);
  const spreadMs = maxDelayMs * HEATMAP_ENTER_STAGGER_SPREAD * Math.max(params.enterStaggerScale, 0.25);
  return random() * spreadMs;
}

export function heatmapLoadingCellParticipates(column: number, row: number, randomness: number): boolean {
  if (randomness >= 1) return true;
  if (randomness <= 0) return false;
  const seed = heatmapCellSeed(column, row) + 73_133;
  const random = seededRandom(seed);
  return random() < randomness;
}

export function resolveHeatmapEnterFadeDurationSec(
  enterTransition: HeatmapEnterTransition | undefined,
  animationDurationMs: number,
): number {
  if (enterTransition && typeof enterTransition.duration === "number") return enterTransition.duration;
  return Math.min(0.45, (animationDurationMs / 1000) * 0.3);
}

/** Min/max contribution levels present in the dataset. bklit heatmap-animation.ts:51-80. */
export interface HeatmapLevelRange {
  min: number;
  max: number;
}

export function computeHeatmapLevelRange(data: { bins: { count: number }[] }[]): HeatmapLevelRange {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const column of data) {
    for (const bin of column.bins) {
      const level = getHeatmapContributionLevel(bin.count);
      if (level < min) min = level;
      if (level > max) max = level;
    }
  }
  // bklit heatmap-animation.ts:75-77 — empty-data fallback is {min:0, max:4},
  // not {min:0, max:0} (a prior pass on this port had the wrong fallback).
  if (!(Number.isFinite(min) && Number.isFinite(max))) return { min: 0, max: 4 };
  return { min, max };
}
