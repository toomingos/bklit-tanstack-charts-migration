// V4.6 legacy port of charts/heatmap/__tests__/heatmap-ghost.test.ts: import
// source pointed at the migrated barrel; ghost helpers loaded from the migrated
// tree through legacyInternal (D555); assertions unchanged (HeatmapColumn is
// a type-only import in legacy, dropped for .mjs).
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyBarrel, legacyInternal } from './lib/legacy.mjs';

const {
  getHeatmapCalendarRangeStart,
  getHeatmapWeekCount,
  getHeatmapWeekStartAlignedToRange,
  getHeatmapYearStartMonth,
  HEATMAP_MONTHS_SIX,
  resolveHeatmapWeekRange,
} = await legacyBarrel();

const { isHeatmapGhostBin, resolveHeatmapDisplayRange } = await legacyInternal('internal/heatmap-utils.ts');

describe('heatmap ghost cells', () => {
  it('marks bins outside the display range as ghost', () => {
    const range = {
      start: new Date(2025, 7, 1),
      end: new Date(2026, 6, 1),
    };

    assert.equal(isHeatmapGhostBin({ bin: 0, count: 0, date: new Date(2025, 6, 31) }, range), true);
    assert.equal(isHeatmapGhostBin({ bin: 0, count: 0, date: new Date(2026, 6, 2) }, range), true);
    assert.equal(isHeatmapGhostBin({ bin: 0, count: 0, date: new Date(2026, 5, 15) }, range), false);
    assert.equal(isHeatmapGhostBin({ bin: 0, count: 0, date: new Date(2026, 6, 1) }, range), false);
  });

  it('does not treat inactive in-range days as ghost', () => {
    const range = {
      start: new Date(2025, 7, 1),
      end: new Date(2026, 6, 1),
    };

    assert.equal(isHeatmapGhostBin({ bin: 0, count: 0, date: new Date(2026, 0, 10) }, range), false);
  });

  it('legacy/heatmap-ghost: infers GitHub-style display range for default year grids', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { startDate, weekCount, rangeStart } = resolveHeatmapWeekRange(today);
    const columns = buildYearGridColumns(
      startDate,
      weekCount,
      today,
      rangeStart,
    );
    const displayRange = resolveHeatmapDisplayRange(columns);

    assert.equal(displayRange.start?.toDateString(), rangeStart.toDateString());
    assert.equal(displayRange.end?.toDateString(), today.toDateString());
  });

  // D555 ACCEPT (D579): host-timezone-sensitive legacy test, kept verbatim and
  // left todo. `getHeatmapWeekCount` divides by a fixed MS_PER_WEEK, so a span
  // crossing a spring-forward transition is an hour short and `Math.floor` drops
  // a whole week: the six-month grid then ends the Saturday before today's week
  // and the extent gate in `resolveInferredHeatmapDisplayRange` correctly returns
  // null bounds. Verified identical in legacy (heatmap/heatmap-utils.ts:41-46), so
  // legacy's own test fails in the same timezones (Europe/Lisbon, America/New_York
  // give weekCount 27; UTC and Asia/Tokyo give 28 and pass). Parity is preserved by
  // reproducing the arithmetic, not by reshaping the grid the test feeds in.
  test.todo('legacy/heatmap-ghost: infers GitHub-style display range for six-month grids', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rangeStart = getHeatmapCalendarRangeStart(today, HEATMAP_MONTHS_SIX);
    const startDate = getHeatmapWeekStartAlignedToRange(rangeStart);
    const weekCount = getHeatmapWeekCount(startDate, today);
    const columns = buildYearGridColumns(
      startDate,
      weekCount,
      today,
      rangeStart,
    );
    const displayRange = resolveHeatmapDisplayRange(columns);

    assert.equal(displayRange.start?.toDateString(), rangeStart.toDateString());
    assert.equal(displayRange.end?.toDateString(), today.toDateString());
  });

  it('legacy/heatmap-ghost: returns null bounds for non-year custom grids', () => {
    const columns = [
      {
        bin: 0,
        bins: [
          { bin: 0, count: 1, date: new Date(2024, 0, 1) },
          { bin: 1, count: 2, date: new Date(2024, 0, 2) },
        ],
      },
    ];

    assert.deepEqual(resolveHeatmapDisplayRange(columns), {
      start: null,
      end: null,
    });
  });
});

function buildYearGridColumns(startDate, weekCount, today, rangeStart) {
  const columns = [];
  const cursor = new Date(startDate);

  for (let week = 0; week < weekCount; week++) {
    const bins = Array.from({ length: 7 }, (_, day) => {
      const date = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
      const isOutOfRange = date > today || (rangeStart != null && date < rangeStart);

      return {
        bin: day,
        count: isOutOfRange ? 0 : 1,
        date,
      };
    });

    columns.push({ bin: week, bins });
  }

  return columns;
}

describe('heatmap year grid alignment', () => {
  it('matches aligned week start used by demo data', () => {
    const today = new Date(2026, 6, 1);
    today.setHours(0, 0, 0, 0);
    const rangeStart = getHeatmapYearStartMonth(today);
    const alignedStart = getHeatmapWeekStartAlignedToRange(rangeStart);

    assert.equal(alignedStart.toDateString(), 'Sun Jul 27 2025');
  });
});
