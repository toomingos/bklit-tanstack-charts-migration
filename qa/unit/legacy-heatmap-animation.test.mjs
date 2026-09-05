// V4.6 legacy port of charts/heatmap/__tests__/heatmap-animation.test.ts: none
// of computeHeatmapEnterFadeDelayMs, computeHeatmapLevelRange,
// HEATMAP_DEFAULT_ENTER_DURATION_MS, HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY,
// HEATMAP_ENTER_STAGGER_SPREAD, heatmapLoadingCellParticipates,
// resolveHeatmapEnterFadeDurationSec is a barrel export (V3.7 backlog). No
// public-export rewrite covers them, so every case is test.todo with the
// missing name. No assertions were weakened — nothing runs.
import { describe, test } from 'node:test';

describe('computeHeatmapLevelRange', () => {
  test.todo('legacy/heatmap-animation: returns the min and max levels present in the dataset (missing export: computeHeatmapLevelRange)');
  test.todo('legacy/heatmap-animation: handles datasets with only bright cells (missing export: computeHeatmapLevelRange)');
});

describe('enter fade helpers', () => {
  test.todo('legacy/heatmap-animation: defaults enter duration to 1.6s (missing export: HEATMAP_DEFAULT_ENTER_DURATION_MS)');
  test.todo('legacy/heatmap-animation: derives fade duration from the motion transition when provided (missing export: resolveHeatmapEnterFadeDurationSec)');
  test.todo('legacy/heatmap-animation: keeps fade delays within the animation window (missing export: computeHeatmapEnterFadeDelayMs, HEATMAP_ENTER_STAGGER_SPREAD)');
  test.todo('legacy/heatmap-animation: defaults loading cell max opacity to 85% (missing export: HEATMAP_DEFAULT_LOADING_CELL_MAX_OPACITY)');
  test.todo('legacy/heatmap-animation: gates loading shimmer participation by randomness (missing export: heatmapLoadingCellParticipates)');
});
