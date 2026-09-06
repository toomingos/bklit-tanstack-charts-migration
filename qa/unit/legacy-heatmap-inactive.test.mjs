// V4.6 legacy port of charts/heatmap/__tests__/heatmap-inactive.test.ts: hover
// helpers loaded from the migrated tree through legacyInternal (D555); the
// inactive-effect helpers have no migrated counterpart — their cases stay todo
// (D555). Assertions unchanged.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyInternal } from './lib/legacy.mjs';

const { isHeatmapHoverEffectEnabled, resolveHeatmapHoverStyle } = await legacyInternal('internal/heatmap-utils.ts');

describe('heatmap inactive hover styling', () => {
  test.todo('legacy/heatmap-inactive: disables effect when both props are 1 (missing export: isHeatmapInactiveEffectEnabled) — internal helper replaced (D555)');
  test.todo('legacy/heatmap-inactive: enables effect when opacity or scale differs from 1 (missing export: isHeatmapInactiveEffectEnabled) — internal helper replaced (D555)');
  test.todo('legacy/heatmap-inactive: returns active style for non-inactive cells (missing export: resolveHeatmapInactiveStyle) — internal helper replaced (D555)');
  test.todo('legacy/heatmap-inactive: returns inactive opacity and scale independently (missing export: resolveHeatmapInactiveStyle) — internal helper replaced (D555)');
});

describe('heatmap hover styling with activeScale', () => {
  const params = {
    inactiveOpacity: 0.45,
    inactiveScale: 1,
    activeScale: 1.1,
  };

  it('enables effect when activeScale differs from 1', () => {
    assert.equal(isHeatmapHoverEffectEnabled(params), true);
    assert.equal(
      isHeatmapHoverEffectEnabled({
        inactiveOpacity: 1,
        inactiveScale: 1,
        activeScale: 1,
      }),
      false,
    );
  });

  it('scales highlighted cells with activeScale', () => {
    assert.deepEqual(resolveHeatmapHoverStyle(true, false, params), {
      opacity: 1,
      scale: 1.1,
    });
  });

  it('dims inactive cells without scaling when inactiveScale is 1', () => {
    assert.deepEqual(resolveHeatmapHoverStyle(false, true, params), {
      opacity: 0.45,
      scale: 1,
    });
  });
});
