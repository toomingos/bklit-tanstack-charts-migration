// V4.6 legacy port of charts/heatmap/__tests__/heatmap-animation.test.ts: helpers
// loaded from the migrated tree through legacyInternal (D555);
// heatmapLoadingCellParticipates has no migrated counterpart — its case stays
// todo (D555). Assertions unchanged.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyInternal } from './lib/legacy.mjs';

const {
  computeHeatmapEnterFadeDelayMs,
  computeHeatmapLevelRange,
  HEATMAP_DEFAULT_ENTER_DURATION_MS,
  HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
  HEATMAP_ENTER_STAGGER_SPREAD,
  resolveHeatmapEnterFadeDurationSec,
} = await legacyInternal('internal/heatmap-lifecycle.ts');

function column(counts) {
  return {
    bin: 0,
    bins: counts.map((count, day) => ({
      bin: day,
      count,
      date: new Date(2025, 0, day + 1),
    })),
  };
}

describe('computeHeatmapLevelRange', () => {
  it('returns the min and max levels present in the dataset', () => {
    const data = [column([0, 1, 4]), column([2, 4, 4])];
    assert.deepEqual(computeHeatmapLevelRange(data), { min: 0, max: 4 });
  });

  it('handles datasets with only bright cells', () => {
    const data = [column([4, 4]), column([3, 4])];
    assert.deepEqual(computeHeatmapLevelRange(data), { min: 3, max: 4 });
  });
});

describe('enter fade helpers', () => {
  it('defaults enter duration to 1.6s', () => {
    assert.equal(HEATMAP_DEFAULT_ENTER_DURATION_MS, 1600);
  });

  it('derives fade duration from the motion transition when provided', () => {
    assert.equal(resolveHeatmapEnterFadeDurationSec({ duration: 0.8 }, 1600), 0.8);
  });

  it('keeps fade delays within the animation window', () => {
    const fadeDurationSec = 0.4;
    const animationDurationMs = 1600;
    const delayMs = computeHeatmapEnterFadeDelayMs({
      column: 4,
      row: 2,
      revealEpoch: 1,
      animationDurationMs,
      enterStaggerScale: 1,
      fadeDurationSec,
    });

    const maxDelayMs = (animationDurationMs - fadeDurationSec * 1000) * HEATMAP_ENTER_STAGGER_SPREAD;
    assert.ok(delayMs >= 0);
    assert.ok(delayMs <= maxDelayMs);
  });

  it('defaults loading cell max opacity to 85%', () => {
    assert.equal(HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY, 0.85);
  });

  test.todo('legacy/heatmap-animation: gates loading shimmer participation by randomness (missing export: heatmapLoadingCellParticipates) — internal helper replaced (D555)');
});
