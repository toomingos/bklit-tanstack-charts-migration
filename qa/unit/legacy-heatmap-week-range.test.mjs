// V4.6 legacy port of charts/heatmap/__tests__/heatmap-week-range.test.ts:
// import source pointed at the migrated barrel; assertions unchanged.
// getHeatmapMonthLabelColumnIndex is not a barrel export (V3.7 backlog) — its
// cases are test.todo.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyBarrel } from './lib/legacy.mjs';

const {
  getHeatmapColumnMonthAnchor,
  getHeatmapWeekStartAlignedToRange,
  getHeatmapYearStartMonth,
  resolveHeatmapWeekRange,
} = await legacyBarrel();

describe('heatmap week range alignment', () => {
  it('skips a lead week that is mostly before the range start month', () => {
    const today = new Date(2026, 6, 1);
    today.setHours(0, 0, 0, 0);

    const { startDate, rangeStart } = resolveHeatmapWeekRange(today);

    assert.equal(rangeStart?.toDateString(), 'Fri Aug 01 2025');
    assert.equal(startDate.toDateString(), 'Sun Jul 27 2025');
  });

  it('keeps the week when range start is early in the column', () => {
    // Sep 1 2025 is a Monday — most of that Sun–Sat week is September
    const rangeStart = new Date(2025, 8, 1);
    const startDate = getHeatmapWeekStartAlignedToRange(rangeStart);

    assert.equal(startDate.toDateString(), 'Sun Aug 31 2025');
  });
});

describe('heatmap month label columns', () => {
  test.todo(
    'legacy/heatmap-week-range: snaps month ticks to separator group starts (missing export: getHeatmapMonthLabelColumnIndex) — internal helper replaced (D555)',
  );
  test.todo(
    'legacy/heatmap-week-range: uses the raw column when separators are disabled (missing export: getHeatmapMonthLabelColumnIndex) — internal helper replaced (D555)',
  );
});

describe('heatmap column month anchor', () => {
  it('falls back to the month of the first bin when the 1st is absent', () => {
    const anchor = getHeatmapColumnMonthAnchor({
      bin: 0,
      bins: [
        { bin: 0, count: 1, date: new Date(2025, 7, 3) },
        { bin: 1, count: 0, date: new Date(2025, 7, 4) },
      ],
    });

    assert.equal(anchor?.toDateString(), 'Fri Aug 01 2025');
  });
});

describe('heatmap year start month', () => {
  it('starts twelve months before the current month', () => {
    const today = new Date(2026, 6, 1);
    const start = getHeatmapYearStartMonth(today);

    assert.equal(start.toDateString(), 'Fri Aug 01 2025');
  });
});
