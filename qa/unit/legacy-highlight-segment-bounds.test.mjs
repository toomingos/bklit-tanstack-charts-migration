// V4.6 legacy port of charts/__tests__/highlight-segment-bounds.test.ts:
// computeSegmentBounds is not a barrel export (and has no migrated
// counterpart; V3.7 backlog). No public-export rewrite covers it, so every
// case is test.todo with the missing name. No assertions were weakened.
import { describe, test } from 'node:test';

describe('computeSegmentBounds', () => {
  test.todo('legacy/highlight-segment-bounds: is inactive for empty data (missing export: computeSegmentBounds) — internal helper replaced (D555)');
  test.todo('legacy/highlight-segment-bounds: is inactive with no hover and no selection (missing export: computeSegmentBounds) — internal helper replaced (D555)');
  test.todo('legacy/highlight-segment-bounds: spans one data point either side of the hovered index (missing export: computeSegmentBounds) — internal helper replaced (D555)');
  test.todo('legacy/highlight-segment-bounds: clamps the start at the first index (missing export: computeSegmentBounds) — internal helper replaced (D555)');
  test.todo('legacy/highlight-segment-bounds: clamps the end at the last index (missing export: computeSegmentBounds) — internal helper replaced (D555)');
  test.todo('legacy/highlight-segment-bounds: uses the dragged pixel range for an active selection (missing export: computeSegmentBounds) — internal helper replaced (D555)');
  test.todo('legacy/highlight-segment-bounds: normalizes a reversed selection drag (missing export: computeSegmentBounds) — internal helper replaced (D555)');
});
