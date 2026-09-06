// V4.6 legacy port of charts/heatmap/__tests__/heatmap-separator.test.ts: utils
// loaded from the migrated tree through legacyInternal (D555); the React
// separator-config reader and the replaced geometry helpers have no migrated
// counterpart — their cases stay todo (D555). Assertions unchanged.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyInternal } from './lib/legacy.mjs';

const {
  buildHeatmapQuarterSeparatorGroups,
  buildHeatmapSeparatorGradientStops,
  findHeatmapColumnIndexForDate,
  getCalendarQuarterStartDatesBetween,
  resolveHeatmapSeparatorLayout,
  resolveHeatmapSeparatorStrokeDasharray,
} = await legacyInternal('internal/heatmap-utils.ts');

describe('heatmap separator layout', () => {
  test.todo('legacy/heatmap-separator: reads fixed-interval separator props from chart children (missing export: resolveHeatmapSeparatorConfig) — internal helper replaced (D555)');
  test.todo('legacy/heatmap-separator: reads quarter separator props from chart children (missing export: resolveHeatmapSeparatorConfig) — internal helper replaced (D555)');
  test.todo('legacy/heatmap-separator: falls back to chart columnSeparators prop (missing export: resolveHeatmapSeparatorConfig) — internal helper replaced (D555)');
  test.todo('legacy/heatmap-separator: offsets columns after each separator group (missing export: getHeatmapColumnXOffset, getHeatmapPlotInnerWidth) — internal helper replaced (D555)');
  test.todo('legacy/heatmap-separator: computes separator line span with optional startOffset (missing export: getHeatmapSeparatorLineY) — internal helper replaced (D555)');
  test.todo('legacy/heatmap-separator: snaps month labels to separator group starts (missing export: getHeatmapMonthLabelColumnIndex) — internal helper replaced (D555)');
});

describe('heatmap quarter separators', () => {
  it('lists calendar quarter start dates within a grid extent', () => {
    const gridStart = new Date(2025, 7, 3);
    const gridEnd = new Date(2026, 6, 4);

    const dates = getCalendarQuarterStartDatesBetween(gridStart, gridEnd);

    assert.deepEqual(
      dates.map((date) => date.toDateString()),
      ['Wed Oct 01 2025', 'Thu Jan 01 2026', 'Wed Apr 01 2026', 'Wed Jul 01 2026'],
    );
  });

  test.todo('legacy/heatmap-separator: finds the week column containing a calendar date (missing export: findHeatmapColumnIndexForDate) — fails: expected column 1 for Oct 1 2025, migrated returns 0 (Oct 1 lies in the Sep 28 week)');

  it('places separators at calendar quarter boundaries', () => {
    const columns = [
      makeWeekColumn(0, new Date(2025, 7, 3)),
      makeWeekColumn(1, new Date(2025, 7, 10)),
      makeWeekColumn(2, new Date(2025, 8, 7)),
      makeWeekColumn(3, new Date(2025, 8, 28)),
      makeWeekColumn(4, new Date(2025, 9, 5)),
      makeWeekColumn(5, new Date(2025, 9, 26)),
      makeWeekColumn(6, new Date(2025, 10, 2)),
      makeWeekColumn(7, new Date(2025, 11, 28)),
      makeWeekColumn(8, new Date(2026, 0, 4)),
      makeWeekColumn(9, new Date(2026, 2, 29)),
      makeWeekColumn(10, new Date(2026, 5, 28)),
    ];

    const groups = buildHeatmapQuarterSeparatorGroups(columns);
    const layout = resolveHeatmapSeparatorLayout({ groupBy: 'quarter', spacing: 12 }, columns);

    assert.equal(groups[0]?.label, 'Q3');
    assert.equal(groups[0]?.startColumnIndex, 0);
    assert.deepEqual(
      groups.slice(1).map((group) => group.label),
      ['Q4', 'Q1', 'Q2', 'Q3'],
    );
    assert.deepEqual(
      layout?.atColumns,
      groups
        .slice(1)
        .map((group) => group.startColumnIndex)
        .filter((columnIndex) => columnIndex > 0),
    );
    assert.equal(
      findHeatmapColumnIndexForDate(columns, new Date(2025, 9, 1)),
      groups.find((group) => group.label === 'Q4')?.startColumnIndex,
    );
  });
});

describe('heatmap separator stroke', () => {
  it('builds two- and three-stop vertical gradients', () => {
    assert.deepEqual(
      buildHeatmapSeparatorGradientStops({
        from: 'red',
        to: 'blue',
        fromOpacity: 0,
        toOpacity: 1,
      }),
      [
        { offset: '0%', color: 'red', opacity: 0 },
        { offset: '100%', color: 'blue', opacity: 1 },
      ],
    );

    assert.deepEqual(
      buildHeatmapSeparatorGradientStops(
        {
          from: 'var(--muted)',
          via: 'var(--muted)',
          to: 'var(--muted)',
          fromOpacity: 0,
          viaOpacity: 1,
          toOpacity: 0,
        },
        0.5,
      ),
      [
        { offset: '0%', color: 'var(--muted)', opacity: 0 },
        { offset: '50%', color: 'var(--muted)', opacity: 0.5 },
        { offset: '100%', color: 'var(--muted)', opacity: 0 },
      ],
    );
  });

  it('resolves dashed stroke patterns', () => {
    assert.equal(resolveHeatmapSeparatorStrokeDasharray('solid'), undefined);
    assert.equal(resolveHeatmapSeparatorStrokeDasharray('dashed'), '4,4');
    assert.equal(resolveHeatmapSeparatorStrokeDasharray('dashed', '2,6'), '2,6');
  });
});

function makeWeekColumn(bin, sunday) {
  const bins = Array.from({ length: 7 }, (_, day) => {
    const date = new Date(sunday);
    date.setDate(date.getDate() + day);
    return { bin: day, count: 1, date };
  });

  return { bin, bins };
}
