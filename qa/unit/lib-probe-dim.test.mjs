// Ancestor-opacity composition for the dim probe (lib-probe.mjs): `opacity`
// multiplies down the chain while fill/stroke channels stay per-element.
// Drives the exported pure surface only — no browser needed.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DIM_THRESHOLD, probeColorAlpha, probeEffectiveOpacity, probeIsDimmed } from '../gate/probes/lib-probe.mjs';

describe('probeEffectiveOpacity', () => {
  it('passes through the own value with no ancestors', () => {
    assert.equal(probeEffectiveOpacity(0.3), 0.3);
    assert.equal(probeEffectiveOpacity('0.3'), 0.3);
  });

  it('multiplies ancestor opacities', () => {
    assert.equal(probeEffectiveOpacity(1, [0.3]), 0.3);
    assert.equal(probeEffectiveOpacity(0.5, [0.5]), 0.25);
  });

  it('treats "" / undefined / null as 1 (getComputedStyle robustness)', () => {
    assert.equal(probeEffectiveOpacity('', ['']), 1);
    assert.equal(probeEffectiveOpacity(undefined, [undefined]), 1);
    assert.equal(probeEffectiveOpacity(1, [null]), 1);
  });
});

describe('probeIsDimmed with ancestor composition', () => {
  it('counts a leaf with own opacity 1 inside a 0.3 group as dimmed', () => {
    assert.equal(probeIsDimmed({ opacity: 1 }), false);
    assert.equal(probeIsDimmed({ opacity: 1, ancestorOpacities: [0.3] }), true);
  });

  it('leaves the per-element channels uncomposed', () => {
    // Ancestors do not rescue a dim leaf, nor dim via fill channels.
    assert.equal(probeIsDimmed({ opacity: 0.3, ancestorOpacities: [1] }), true);
    assert.equal(probeIsDimmed({ opacity: 1, fillOpacity: 0.3 }), true);
    assert.equal(probeIsDimmed({ opacity: 1, ancestorOpacities: [1] }), false);
  });

  it('keeps the D616 veto: exact "transparent" hint vetoes, color-mix substring does not', () => {
    assert.equal(probeColorAlpha('rgba(0, 0, 0, 0)', 'transparent'), 1);
    // In the browser, computed style resolves color-mix() to slash-alpha
    // form; the authored string rides only as the raw hint.
    const authored = 'color-mix(in srgb, var(--chart-1) 40%, transparent)';
    assert.equal(probeColorAlpha('rgb(31 41 55 / 0.4)', authored), 0.4);
    assert.equal(probeIsDimmed({ opacity: 1, fill: 'rgb(31 41 55 / 0.4)', rawFill: authored }), true);
    assert.equal(probeIsDimmed({ opacity: 1, fill: 'rgba(0,0,0,0)', rawFill: 'transparent' }), false);
  });
});
