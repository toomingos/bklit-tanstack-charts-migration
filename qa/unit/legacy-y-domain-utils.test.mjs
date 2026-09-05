// V4.6 legacy port of charts/__tests__/y-domain-utils.test.ts: import source
// pointed at the migrated barrel; assertions unchanged. domainsEqual and
// isReferenceAreaVisiblePhase are not barrel exports (V3.7 backlog) — their
// cases are test.todo.
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import { legacyBarrel } from './lib/legacy.mjs';

const { mergeYDomainRecords, niceYDomain, shouldTweenYDomain } = await legacyBarrel();

describe('shouldTweenYDomain', () => {
  it('skips tween when both endpoints move less than 2% of span', () => {
    assert.equal(shouldTweenYDomain([0, 100], [1, 101]), false);
  });

  it('tweens when min endpoint shifts enough', () => {
    assert.equal(shouldTweenYDomain([0, 100], [5, 100]), true);
  });

  it('tweens when max endpoint shifts enough', () => {
    assert.equal(shouldTweenYDomain([0, 100], [0, 110]), true);
  });
});

describe('niceYDomain', () => {
  it('expands raw domain to nice tick boundaries', () => {
    const [min, max] = niceYDomain([13, 87]);
    assert.ok(min <= 13);
    assert.ok(max >= 87);
  });
});

describe('mergeYDomainRecords', () => {
  it('normalizes axis ids and merges maps', () => {
    const merged = mergeYDomainRecords({ left: [0, 100] }, { right: [10, 50] });
    assert.deepEqual(merged.left, [0, 100]);
    assert.deepEqual(merged.right, [10, 50]);
  });
});

describe('domainsEqual', () => {
  test.todo('legacy/y-domain-utils: returns true when axis domains match (missing export: domainsEqual)');
  test.todo('legacy/y-domain-utils: returns false when any endpoint differs (missing export: domainsEqual)');
});

describe('isReferenceAreaVisiblePhase', () => {
  test.todo(
    'legacy/y-domain-utils: shows reference areas during ready reveal phases (missing export: isReferenceAreaVisiblePhase)',
  );
  test.todo(
    'legacy/y-domain-utils: hides reference areas during loading and exit phases (missing export: isReferenceAreaVisiblePhase)',
  );
});
