// V4.6 legacy port of charts/__tests__/decimate-time-series.test.ts: none of
// decimateOhlcData, decimateTimeSeries, maxRenderPointsForWidth is a barrel
// export (V3.7 backlog). No public-export rewrite covers them, so every case
// is test.todo with the missing name. No assertions were weakened — nothing runs.
import { describe, test } from 'node:test';

describe('decimateTimeSeries', () => {
  test.todo('legacy/decimate-time-series: returns the original array when under the point budget (missing export: decimateTimeSeries)');
  test.todo('legacy/decimate-time-series: always keeps the first and last points (missing export: decimateTimeSeries)');
  test.todo('legacy/decimate-time-series: preserves spikes in the series (missing export: decimateTimeSeries)');
});

describe('decimateOhlcData', () => {
  test.todo('legacy/decimate-time-series: preserves bucket high/low extremes (missing export: decimateOhlcData)');
});

describe('maxRenderPointsForWidth', () => {
  test.todo('legacy/decimate-time-series: returns at least 64 points (missing export: maxRenderPointsForWidth)');
  test.todo('legacy/decimate-time-series: scales with chart width (missing export: maxRenderPointsForWidth)');
});
