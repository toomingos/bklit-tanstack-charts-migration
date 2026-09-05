// V4.6 legacy port of charts/__tests__/sunburst-hover-grow.test.ts: only
// defaultSunburstGrowPadding is a barrel export; the hover-grow internals are
// not (V3.7 backlog) — their cases are test.todo. The runnable assertion is
// unchanged.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyBarrel } from './lib/legacy.mjs';

const { defaultSunburstGrowPadding } = await legacyBarrel();

describe('sunburst hover grow geometry', () => {
  test.todo(
    'legacy/sunburst-hover-grow: counts visible path segments from focus to hover (missing export: visibleHoverPathLength)',
  );
  test.todo(
    'legacy/sunburst-hover-grow: budgets hover grow by ring width and path depth (missing export: hoverGrowForPathSegment)',
  );
  test.todo(
    'legacy/sunburst-hover-grow: sums ancestor grow along the id path (missing export: ancestorGrowOffset)',
  );
  test.todo(
    'legacy/sunburst-hover-grow: pushes descendants and thickens the hovered segment (missing export: applyHoverGrow)',
  );

  it('reserves grow padding from depth and hover pop', () => {
    assert.equal(defaultSunburstGrowPadding(4, 520, 8), 25);
  });

  test.todo(
    'legacy/sunburst-hover-grow: caps expanded thickness to the first drill reference ring (missing export: maxHoverSegmentThickness, applyHoverGrow)',
  );
});
