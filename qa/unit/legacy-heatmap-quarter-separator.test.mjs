// V4.6 legacy port of charts/__tests__/heatmap-quarter-separator.test.ts: the
// single case needs buildHeatmapQuarterSeparatorGroups and getCalendarQuarter,
// neither a barrel export (V3.7 backlog). No public-export rewrite covers
// them, so the case is test.todo. No assertions were weakened — nothing runs.
import { test } from 'node:test';

test.todo(
  'legacy/heatmap-quarter-separator: labels the first quarter from the calendar range start, not the lead week (missing export: buildHeatmapQuarterSeparatorGroups, getCalendarQuarter)',
);
