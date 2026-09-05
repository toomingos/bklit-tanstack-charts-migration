// V4.6 legacy port of charts/__tests__/bar-depth-geometry.test.ts: none of
// BAR_DEPTH_MAX_PX, BAR_DEPTH_PERSPECTIVE_RATIO, barDepthAndRise,
// barDepthMaxDepth is a barrel export (V1.6 un-exported internal; V3.7
// backlog). No public-export rewrite covers geometry helpers, so every case is
// test.todo with the missing name. No assertions were weakened — nothing runs.
import { describe, test } from 'node:test';

describe('barDepthMaxDepth', () => {
  test.todo('legacy/bar-depth-geometry: caps at BAR_DEPTH_MAX_PX when the gap is wide (missing export: barDepthMaxDepth, BAR_DEPTH_MAX_PX)');
  test.todo('legacy/bar-depth-geometry: is bounded by the inter-bar gap on dense charts (missing export: barDepthMaxDepth)');
  test.todo('legacy/bar-depth-geometry: is 0 when there is no gap between bars (missing export: barDepthMaxDepth)');
});

describe('barDepthAndRise', () => {
  test.todo('legacy/bar-depth-geometry: returns no depth for a dead-center bar (missing export: barDepthAndRise)');
  test.todo('legacy/bar-depth-geometry: scales depth with offset, capped by maxDepth at the edge (missing export: barDepthAndRise)');
  test.todo('legacy/bar-depth-geometry: caps depth by the bar height so short bars stay proportional (missing export: barDepthAndRise)');
  test.todo('legacy/bar-depth-geometry: derives the rise from depth via the perspective ratio (missing export: barDepthAndRise, BAR_DEPTH_PERSPECTIVE_RATIO)');
  test.todo('legacy/bar-depth-geometry: clamps out-of-range inputs defensively (missing export: barDepthAndRise)');
});
