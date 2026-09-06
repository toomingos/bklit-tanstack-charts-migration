// V4.6 legacy port of charts/__tests__/loading-sweep.test.ts: getSkeletonHeights
// is not a barrel export (and has no migrated counterpart; V3.7 backlog). No
// public-export rewrite covers it, so every case is test.todo with the missing
// name. No assertions were weakened — nothing runs.
import { describe, test } from 'node:test';

describe('getSkeletonHeights', () => {
  test.todo('legacy/loading-sweep: returns the requested number of heights (missing export: getSkeletonHeights) — V3.4b');
  test.todo('legacy/loading-sweep: is deterministic for the same (count, seed) (missing export: getSkeletonHeights) — V3.4b');
  test.todo('legacy/loading-sweep: re-rolls when the seed changes (missing export: getSkeletonHeights) — V3.4b');
  test.todo('legacy/loading-sweep: stays within the default [20, 80) range (missing export: getSkeletonHeights) — V3.4b');
  test.todo('legacy/loading-sweep: respects a custom range (missing export: getSkeletonHeights) — V3.4b');
});
