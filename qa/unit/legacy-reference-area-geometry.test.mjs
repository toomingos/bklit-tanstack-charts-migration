// V4.6 legacy port of charts/__tests__/reference-area-geometry.test.ts: import
// source pointed at the migrated barrel; assertions unchanged (baseOptions
// de-typed for .mjs). resolveReferenceDataRange is not a barrel export
// (V3.7 backlog) — its cases are test.todo.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyBarrel } from './lib/legacy.mjs';

const { computeReferenceAreaRect } = await legacyBarrel();

const innerWidth = 400;
const innerHeight = 200;

const xScale = (date) => date.getTime() / 10;
const yScale = (value) => innerHeight - value;

function baseOptions(overrides = {}) {
  return {
    innerWidth,
    innerHeight,
    xScale,
    yScale,
    ...overrides,
  };
}

describe('computeReferenceAreaRect', () => {
  it('maps a full-width horizontal band between y1 and y2', () => {
    const rect = computeReferenceAreaRect(baseOptions({ y1: 40, y2: 80 }));
    assert.deepEqual(rect, { x: 0, y: 120, width: 400, height: 40 });
  });

  it('maps a partial x-range when x1 and x2 are set', () => {
    const rect = computeReferenceAreaRect(
      baseOptions({
        x1: new Date(1000),
        x2: new Date(2000),
        y1: 50,
        y2: 100,
      }),
    );
    assert.deepEqual(rect, { x: 100, y: 100, width: 100, height: 50 });
  });

  it('clamps to the plot when ifOverflow is hidden', () => {
    const rect = computeReferenceAreaRect(
      baseOptions({
        y1: 150,
        y2: 250,
        ifOverflow: 'hidden',
      }),
    );
    assert.deepEqual(rect, { x: 0, y: 0, width: 400, height: 50 });
  });

  it('returns null when discard and partly outside the plot', () => {
    const rect = computeReferenceAreaRect(
      baseOptions({
        y1: 150,
        y2: 250,
        ifOverflow: 'discard',
      }),
    );
    assert.equal(rect, null);
  });

  it('does not clamp when ifOverflow is visible', () => {
    const rect = computeReferenceAreaRect(
      baseOptions({
        y1: 150,
        y2: 250,
        ifOverflow: 'visible',
      }),
    );
    assert.deepEqual(rect, { x: 0, y: -50, width: 400, height: 100 });
  });

  it('returns null for zero plot size', () => {
    assert.equal(computeReferenceAreaRect(baseOptions({ innerWidth: 0, innerHeight: 200, y1: 10, y2: 20 })), null);
  });
});

describe('resolveReferenceDataRange', () => {
  test.todo(
    'legacy/reference-area-geometry: returns inclusive bounds between y1 and y2 (missing export: resolveReferenceDataRange)',
  );
  test.todo(
    'legacy/reference-area-geometry: extends to domain edges when y bounds are omitted (missing export: resolveReferenceDataRange)',
  );
});
