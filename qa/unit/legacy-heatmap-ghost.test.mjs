// V4.6 legacy port of charts/heatmap/__tests__/heatmap-ghost.test.ts: import
// source pointed at the migrated barrel; assertions unchanged (HeatmapColumn is
// a type-only import in legacy, dropped for .mjs). isHeatmapGhostBin and
// resolveHeatmapDisplayRange are not barrel exports (V3.7 backlog) — their
// cases are test.todo.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyBarrel } from './lib/legacy.mjs';

const {
  getHeatmapCalendarRangeStart,
  getHeatmapWeekCount,
  getHeatmapWeekStartAlignedToRange,
  getHeatmapYearStartMonth,
  HEATMAP_MONTHS_SIX,
  resolveHeatmapWeekRange,
} = await legacyBarrel();

describe('heatmap ghost cells', () => {
  test.todo('legacy/heatmap-ghost: marks bins outside the display range as ghost (missing export: isHeatmapGhostBin)');
  test.todo(
    'legacy/heatmap-ghost: does not treat inactive in-range days as ghost (missing export: isHeatmapGhostBin)',
  );
  test.todo(
    'legacy/heatmap-ghost: infers GitHub-style display range for default year grids (missing export: resolveHeatmapDisplayRange)',
  );
  test.todo(
    'legacy/heatmap-ghost: infers GitHub-style display range for six-month grids (missing export: resolveHeatmapDisplayRange)',
  );
  test.todo(
    'legacy/heatmap-ghost: returns null bounds for non-year custom grids (missing export: resolveHeatmapDisplayRange)',
  );
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
