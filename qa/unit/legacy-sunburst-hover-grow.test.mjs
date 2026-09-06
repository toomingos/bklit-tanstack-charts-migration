// V4.6 legacy port of charts/__tests__/sunburst-hover-grow.test.ts: only
// defaultSunburstGrowPadding is a barrel export; the hover-grow internals are
// not (V3.7 backlog) — their cases are test.todo. The runnable assertion is
// unchanged.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyBarrel, legacyInternal } from './lib/legacy.mjs';

const { defaultSunburstGrowPadding } = await legacyBarrel();
const { hoverGrowForPathSegment } = await legacyInternal('internal/parity/sunburst-geometry.ts');

describe('sunburst hover grow geometry', () => {
  test.todo(
    'legacy/sunburst-hover-grow: counts visible path segments from focus to hover (missing export: visibleHoverPathLength) — internal helper replaced (D555)',
  );
  it('budgets hover grow by ring width and path depth', () => {
    assert.ok(Math.abs(hoverGrowForPathSegment(10, 65, 4) - 4.55) < 1e-9);
    assert.equal(hoverGrowForPathSegment(10, 200, 1), 10);
    assert.equal(hoverGrowForPathSegment(10, 65, 1), 6.5);
  });
  test.todo(
    'legacy/sunburst-hover-grow: sums ancestor grow along the id path (missing export: ancestorGrowOffset) — internal helper replaced (D555)',
  );
  test.todo(
    'legacy/sunburst-hover-grow: pushes descendants and thickens the hovered segment (missing export: applyHoverGrow) — internal helper replaced (D555)',
  );

  it('reserves grow padding from depth and hover pop', () => {
    assert.equal(defaultSunburstGrowPadding(4, 520, 8), 25);
  });

  test.todo(
    'legacy/sunburst-hover-grow: caps expanded thickness to the first drill reference ring (missing export: maxHoverSegmentThickness, applyHoverGrow) — internal helper replaced (D555)',
  );
});
