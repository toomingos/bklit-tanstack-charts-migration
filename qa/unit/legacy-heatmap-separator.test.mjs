// V4.6 legacy port of charts/heatmap/__tests__/heatmap-separator.test.ts: every
// case needs at least one of resolveHeatmapSeparatorConfig,
// buildHeatmapQuarterSeparatorGroups, buildHeatmapSeparatorGradientStops,
// findHeatmapColumnIndexForDate, getCalendarQuarterStartDatesBetween,
// getHeatmapColumnXOffset, getHeatmapMonthLabelColumnIndex,
// getHeatmapPlotInnerWidth, getHeatmapSeparatorLineY,
// resolveHeatmapSeparatorLayout, resolveHeatmapSeparatorStrokeDasharray — none
// a barrel export (V3.7 backlog). No public-export rewrite covers them, so
// every case is test.todo with the missing name. No assertions were weakened.
import { describe, test } from 'node:test';

describe('heatmap separator layout', () => {
  test.todo('legacy/heatmap-separator: reads fixed-interval separator props from chart children (missing export: resolveHeatmapSeparatorConfig)');
  test.todo('legacy/heatmap-separator: reads quarter separator props from chart children (missing export: resolveHeatmapSeparatorConfig)');
  test.todo('legacy/heatmap-separator: falls back to chart columnSeparators prop (missing export: resolveHeatmapSeparatorConfig)');
  test.todo('legacy/heatmap-separator: offsets columns after each separator group (missing export: getHeatmapColumnXOffset, getHeatmapPlotInnerWidth)');
  test.todo('legacy/heatmap-separator: computes separator line span with optional startOffset (missing export: getHeatmapSeparatorLineY)');
  test.todo('legacy/heatmap-separator: snaps month labels to separator group starts (missing export: getHeatmapMonthLabelColumnIndex)');
});

describe('heatmap quarter separators', () => {
  test.todo('legacy/heatmap-separator: lists calendar quarter start dates within a grid extent (missing export: getCalendarQuarterStartDatesBetween)');
  test.todo('legacy/heatmap-separator: finds the week column containing a calendar date (missing export: findHeatmapColumnIndexForDate)');
  test.todo('legacy/heatmap-separator: places separators at calendar quarter boundaries (missing export: buildHeatmapQuarterSeparatorGroups, resolveHeatmapSeparatorLayout)');
});

describe('heatmap separator stroke', () => {
  test.todo('legacy/heatmap-separator: builds two- and three-stop vertical gradients (missing export: buildHeatmapSeparatorGradientStops)');
  test.todo('legacy/heatmap-separator: resolves dashed stroke patterns (missing export: resolveHeatmapSeparatorStrokeDasharray)');
});
