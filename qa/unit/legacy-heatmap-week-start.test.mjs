// V4.6 legacy port of charts/heatmap/__tests__/heatmap-week-start.test.ts:
// import source pointed at the migrated barrel; assertions unchanged
// (HeatmapColumn is a type-only import in legacy, dropped for .mjs).
// rotateHeatmapColumnBins and resolveHeatmapRowOpacity are not barrel exports
// (V3.7 backlog) — their cases are test.todo.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyBarrel } from './lib/legacy.mjs';

const { buildHeatmapLegendGradient, buildHeatmapRowOpacity, getHeatmapDayLabels } = await legacyBarrel();

const GRADIENT_PREFIX = /^linear-gradient\(to right,/;
const GRADIENT_START = /#0ea5e9 0%/;
const GRADIENT_END = /#ef4444 100%/;

function sampleColumn() {
  return {
    bin: 0,
    bins: [
      { bin: 0, count: 0, date: new Date(2024, 0, 7) },
      { bin: 1, count: 1, date: new Date(2024, 0, 8) },
      { bin: 2, count: 2, date: new Date(2024, 0, 9) },
      { bin: 3, count: 3, date: new Date(2024, 0, 10) },
      { bin: 4, count: 4, date: new Date(2024, 0, 11) },
      { bin: 5, count: 0, date: new Date(2024, 0, 12) },
      { bin: 6, count: 1, date: new Date(2024, 0, 13) },
    ],
  };
}

describe('heatmap week start helpers', () => {
  it('rotates day labels for Monday-first grids', () => {
    assert.deepEqual(getHeatmapDayLabels(1), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  test.todo(
    'legacy/heatmap-week-start: rotates column bins without changing counts or dates (missing export: rotateHeatmapColumnBins)',
  );
  test.todo(
    'legacy/heatmap-week-start: returns columns unchanged when weekStartDay is 0 (missing export: rotateHeatmapColumnBins)',
  );
});

describe('heatmap row opacity', () => {
  test.todo('legacy/heatmap-week-start: defaults to 1 (missing export: resolveHeatmapRowOpacity)');
  test.todo('legacy/heatmap-week-start: supports a single multiplier (missing export: resolveHeatmapRowOpacity)');
  test.todo('legacy/heatmap-week-start: supports per-row arrays (missing export: resolveHeatmapRowOpacity)');

  it('builds opacity maps from row indices', () => {
    assert.deepEqual(buildHeatmapRowOpacity([5, 6], 0.35), [1, 1, 1, 1, 1, 0.35, 0.35]);
  });

  it('builds opacity maps from a row predicate', () => {
    assert.deepEqual(buildHeatmapRowOpacity((row) => row >= 5, 0.35), [1, 1, 1, 1, 1, 0.35, 0.35]);
  });
});

describe('heatmap legend gradient', () => {
  it('builds evenly spaced color stops', () => {
    const gradient = buildHeatmapLegendGradient([
      { color: '#0ea5e9', fillMode: 'solid', pattern: 'none' },
      { color: '#22c55e', fillMode: 'solid', pattern: 'none' },
      { color: '#eab308', fillMode: 'solid', pattern: 'none' },
      { color: '#f97316', fillMode: 'solid', pattern: 'none' },
      { color: '#ef4444', fillMode: 'solid', pattern: 'none' },
    ]);

    assert.match(gradient, GRADIENT_PREFIX);
    assert.match(gradient, GRADIENT_START);
    assert.match(gradient, GRADIENT_END);
  });
});
