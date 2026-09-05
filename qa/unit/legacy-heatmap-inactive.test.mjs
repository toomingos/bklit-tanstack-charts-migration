// V4.6 legacy port of charts/heatmap/__tests__/heatmap-inactive.test.ts: none
// of isHeatmapHoverEffectEnabled, isHeatmapInactiveEffectEnabled,
// resolveHeatmapHoverStyle, resolveHeatmapInactiveStyle is a barrel export
// (V3.7 backlog). No public-export rewrite covers them, so every case is
// test.todo with the missing name. No assertions were weakened — nothing runs.
import { describe, test } from 'node:test';

describe('heatmap inactive hover styling', () => {
  test.todo('legacy/heatmap-inactive: disables effect when both props are 1 (missing export: isHeatmapInactiveEffectEnabled)');
  test.todo('legacy/heatmap-inactive: enables effect when opacity or scale differs from 1 (missing export: isHeatmapInactiveEffectEnabled)');
  test.todo('legacy/heatmap-inactive: returns active style for non-inactive cells (missing export: resolveHeatmapInactiveStyle)');
  test.todo('legacy/heatmap-inactive: returns inactive opacity and scale independently (missing export: resolveHeatmapInactiveStyle)');
});

describe('heatmap hover styling with activeScale', () => {
  test.todo('legacy/heatmap-inactive: enables effect when activeScale differs from 1 (missing export: isHeatmapHoverEffectEnabled)');
  test.todo('legacy/heatmap-inactive: scales highlighted cells with activeScale (missing export: resolveHeatmapHoverStyle)');
  test.todo('legacy/heatmap-inactive: dims inactive cells without scaling when inactiveScale is 1 (missing export: resolveHeatmapHoverStyle)');
});
