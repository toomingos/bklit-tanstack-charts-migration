// V4.6 legacy port of charts/__tests__/animation.test.ts: import source pointed
// at the migrated barrel; assertions unchanged.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { legacyBarrel } from './lib/legacy.mjs';

const { clipRevealTransition, DEFAULT_CHART_ENTER_TRANSITION } = await legacyBarrel();

describe('clipRevealTransition', () => {
  it('preserves explicit tween ease', () => {
    const tween = {
      type: 'tween',
      duration: 0.9,
      ease: [0.1, 0.2, 0.3, 0.4],
    };
    assert.deepEqual(clipRevealTransition(tween), tween);
  });

  it('applies default ease when tween omits ease', () => {
    const result = clipRevealTransition({
      type: 'tween',
      duration: 0.9,
    });
    assert.equal(result.type, 'tween');
    assert.equal(result.duration, 0.9);
    assert.deepEqual(result.ease, DEFAULT_CHART_ENTER_TRANSITION.ease);
  });

  it('converts spring to tween for svg width reveal', () => {
    const result = clipRevealTransition({
      type: 'spring',
      duration: 1.2,
      bounce: 0.5,
    });
    assert.equal(result.type, 'tween');
    assert.equal(result.duration, 1.2);
    assert.deepEqual(result.ease, DEFAULT_CHART_ENTER_TRANSITION.ease);
  });
});
