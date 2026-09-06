// V4.6 legacy port of charts/__tests__/series-bar-layout.test.ts: helpers
// loaded from the migrated tree through legacyInternal (D555); assertions unchanged.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { legacyInternal } from './lib/legacy.mjs';

const { computeSeriesBarRevealClipPadding, computeSeriesBarWidth } = await legacyInternal('internal/series-bar-layout.ts');

describe('computeSeriesBarWidth', () => {
  it('caps grouped bar width to the slot', () => {
    const width = computeSeriesBarWidth({
      innerWidth: 400,
      dataLength: 12,
      columnWidth: 400 / 11,
      seriesCount: 2,
      composedBarGap: 4,
    });
    assert.ok(width >= 2);
    assert.ok(width <= 40);
  });
});

describe('computeSeriesBarRevealClipPadding', () => {
  it('uses half the bar width for a single stacked column', () => {
    assert.equal(
      computeSeriesBarRevealClipPadding({
        barWidth: 24,
        seriesCount: 3,
        stacked: true,
      }),
      12,
    );
  });

  it('uses half the group width for grouped bars', () => {
    assert.equal(
      computeSeriesBarRevealClipPadding({
        barWidth: 20,
        seriesCount: 2,
        gap: 4,
      }),
      22,
    );
  });
});
