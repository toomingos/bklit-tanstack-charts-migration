// V4.6 legacy port of charts/__tests__/series-bar-layout.test.ts: neither
// computeSeriesBarRevealClipPadding nor computeSeriesBarWidth is a barrel
// export (V3.7 backlog). No public-export rewrite covers them, so every case
// is test.todo with the missing name. No assertions were weakened.
import { describe, test } from 'node:test';

describe('computeSeriesBarWidth', () => {
  test.todo('legacy/series-bar-layout: caps grouped bar width to the slot (missing export: computeSeriesBarWidth)');
});

describe('computeSeriesBarRevealClipPadding', () => {
  test.todo('legacy/series-bar-layout: uses half the bar width for a single stacked column (missing export: computeSeriesBarRevealClipPadding)');
  test.todo('legacy/series-bar-layout: uses half the group width for grouped bars (missing export: computeSeriesBarRevealClipPadding)');
});
