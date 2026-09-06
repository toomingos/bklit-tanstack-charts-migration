// V4.6 legacy port of charts/__tests__/decimate-time-series.test.ts: helpers
// loaded from the migrated tree through legacyInternal (D555); decimateOhlcData
// has no migrated counterpart — its case stays todo (D555). Assertions unchanged.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyInternal } from './lib/legacy.mjs';

const { decimateTimeSeries, maxRenderPointsForWidth } = await legacyInternal('internal/decimate.ts');

describe('decimateTimeSeries', () => {
  it('returns the original array when under the point budget', () => {
    const data = [{ v: 1 }, { v: 2 }, { v: 3 }];
    assert.equal(decimateTimeSeries(data, 10), data);
  });

  it('always keeps the first and last points', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ v: i }));
    const sampled = decimateTimeSeries(data, 20, ['v']);
    assert.equal(sampled[0]?.v, 0);
    assert.equal(sampled.at(-1)?.v, 99);
    assert.equal(sampled.length, 20);
  });

  it('preserves spikes in the series', () => {
    const data = Array.from({ length: 50 }, (_, i) => ({
      v: i === 25 ? 1000 : i,
    }));
    const sampled = decimateTimeSeries(data, 10, ['v']);
    assert(sampled.some((point) => point.v === 1000));
  });
});

describe('decimateOhlcData', () => {
  test.todo('legacy/decimate-time-series: preserves bucket high/low extremes (missing export: decimateOhlcData) — internal helper replaced (D555)');
});

describe('maxRenderPointsForWidth', () => {
  it('returns at least 64 points', () => {
    assert.equal(maxRenderPointsForWidth(10), 64);
  });

  it('scales with chart width', () => {
    assert.equal(maxRenderPointsForWidth(400), 600);
  });
});
