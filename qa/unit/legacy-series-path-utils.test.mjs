// V4.6 legacy port of charts/__tests__/series-path-utils.test.ts: none of
// computeSeriesPathPoints, interpolateSeriesPathPoints,
// seriesPathTransitionSignature is a barrel export (and they have no migrated
// counterpart; V3.7 backlog). No public-export rewrite covers them, so every
// case is test.todo with the missing name. No assertions were weakened.
import { describe, test } from 'node:test';

describe('series-path-utils', () => {
  test.todo('legacy/series-path-utils: builds stable transition signatures from data and x-domain (missing export: seriesPathTransitionSignature)');
  test.todo('legacy/series-path-utils: interpolates matched points toward the next layout (missing export: interpolateSeriesPathPoints)');
  test.todo('legacy/series-path-utils: anchors new points to the previous series position (missing export: interpolateSeriesPathPoints)');
  test.todo('legacy/series-path-utils: computes pixel positions from scales (missing export: computeSeriesPathPoints)');
});
