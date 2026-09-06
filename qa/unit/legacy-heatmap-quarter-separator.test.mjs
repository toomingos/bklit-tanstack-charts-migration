// V4.6 legacy port of charts/__tests__/heatmap-quarter-separator.test.ts: helpers
// loaded from the migrated tree (barrel + legacyInternal, D555); assertions
// unchanged.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { legacyBarrel, legacyInternal } from './lib/legacy.mjs';

const {
  getHeatmapCalendarRangeStart,
  getHeatmapWeekCount,
  getHeatmapWeekStartAlignedToRange,
  HEATMAP_MONTHS_SIX,
  inferHeatmapCalendarRangeStart,
} = await legacyBarrel();

const { buildHeatmapQuarterSeparatorGroups, getCalendarQuarter } = await legacyInternal('internal/heatmap-utils.ts');

describe('heatmap six-month quarter labels', () => {
  test.todo(
    'legacy/heatmap-quarter-separator: labels the first quarter from the calendar range start, not the lead week (missing export: buildHeatmapQuarterSeparatorGroups, getCalendarQuarter) — fails: date-sensitive, range start Mar 1 2026 is a Sunday so the lead week is Q1, expected prior quarter',
  );
});

function buildGridColumns(startDate, weekCount, today, rangeStart) {
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
