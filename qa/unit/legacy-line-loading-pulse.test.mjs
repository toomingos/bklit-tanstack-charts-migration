// V4.6 legacy port of charts/__tests__/line-loading-pulse.test.ts: import source
// pointed at the migrated barrel; assertions unchanged.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { legacyBarrel } from './lib/legacy.mjs';

const { resolveLineLoadingPulseMode } = await legacyBarrel();

describe('resolveLineLoadingPulseMode', () => {
  it('maps loading phases to pulse modes', () => {
    assert.equal(resolveLineLoadingPulseMode('loading'), 'loop');
    assert.equal(resolveLineLoadingPulseMode('exiting'), 'exit');
    assert.equal(resolveLineLoadingPulseMode('revealingLoading'), 'enter');
  });

  it('returns null for non-loading phases', () => {
    assert.equal(resolveLineLoadingPulseMode('ready'), null);
    assert.equal(resolveLineLoadingPulseMode('revealing'), null);
    assert.equal(resolveLineLoadingPulseMode('exitingReady'), null);
  });
});
