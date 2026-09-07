// D623: resolveBarPulseOverlay used to be a first-match scan (bar-pulse-mark.ts)
// feeding one chart-wide seam (bar-chart.tsx / resource-host.tsx / styles.css) --
// with two <BarPulse> marks, the second painted through the first's silhouette
// and swept the first's distance. This covers the array-returning replacement,
// resolveBarPulseOverlays, and the per-pulse mask id it now pairs with.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { legacyInternal } from './lib/legacy.mjs';

const { resolveBarPulseOverlays } = await legacyInternal('internal/bar-pulse-mark.ts');
const { barPulseMaskId } = await legacyInternal('internal/resource-host.tsx');

// Three categories, two pulse configs pointed at different data keys and
// different active bars -- distinct geometry on every axis (position, height,
// perspective offset) so a collapsed-to-one-pulse bug cannot hide behind
// coincidentally-equal numbers.
const data = [
  { category: 'a', profit: 40, sales: 10 },
  { category: 'b', profit: 5, sales: 30 },
  { category: 'c', profit: 60, sales: 55 },
];
const categoryAccessor = (datum) => datum.category;
const projectValue = (_dataKey, value) => value;
const bandWidth = 40;
const bandStep = 60;
const xScale = {
  bandwidth: bandWidth,
  domain: data.map((datum) => datum.category),
  map: (label) => {
    const index = data.findIndex((datum) => datum.category === label);
    return index * bandStep + bandStep / 2;
  },
};
const yScale = { map: (value) => 200 - value * 2 };
const scales = { x: xScale, y: yScale };
const baseArgs = { categoryAccessor, chartWidth: 180, chartX: 0, data, projectValue, scales };

describe('resolveBarPulseOverlays', () => {
  it('returns one overlay per live pulse, not just the first', () => {
    const pulses = [
      { activeIndex: 0, dataKey: 'sales' },
      { activeIndex: 2, dataKey: 'profit' },
    ];
    const overlays = resolveBarPulseOverlays({ ...baseArgs, pulses });
    assert.equal(overlays.length, 2);
  });

  it('gives each pulse its own DOM key matching bar-pulse-<dataKey>', () => {
    const pulses = [
      { activeIndex: 0, dataKey: 'sales' },
      { activeIndex: 2, dataKey: 'profit' },
    ];
    const [first, second] = resolveBarPulseOverlays({ ...baseArgs, pulses });
    assert.equal(first.markId, 'bar-pulse-sales');
    assert.equal(second.markId, 'bar-pulse-profit');
    assert.notEqual(first.markId, second.markId);
  });

  it('resolves distinct clip silhouettes and travel distances per pulse (the singleton this fixes)', () => {
    const pulses = [
      { activeIndex: 0, dataKey: 'sales' },
      { activeIndex: 2, dataKey: 'profit' },
    ];
    const [first, second] = resolveBarPulseOverlays({ ...baseArgs, pulses });
    assert.notEqual(first.clipD, second.clipD);
    assert.notEqual(first.travelPx, second.travelPx);
  });

  it('keeps the single-pulse case a one-entry array (N=1 unchanged)', () => {
    const pulses = [{ activeIndex: 0, dataKey: 'sales' }];
    const overlays = resolveBarPulseOverlays({ ...baseArgs, pulses });
    assert.equal(overlays.length, 1);
    assert.equal(overlays[0].markId, 'bar-pulse-sales');
  });

  it('drops paused or out-of-range pulses without dropping the rest', () => {
    const pulses = [
      { activeIndex: 0, dataKey: 'sales' },
      { dataKey: 'profit', pulsePaused: true },
    ];
    const overlays = resolveBarPulseOverlays({ ...baseArgs, pulses });
    assert.equal(overlays.length, 1);
    assert.equal(overlays[0].markId, 'bar-pulse-sales');
  });

  it('returns an empty array, never null, when no pulse renders', () => {
    const overlays = resolveBarPulseOverlays({ ...baseArgs, pulses: [] });
    assert.deepEqual(overlays, []);
  });
});

describe('barPulseMaskId', () => {
  it('scopes the mask id by pulseId so two pulses on one mount never collide', () => {
    const salesId = barPulseMaskId('bkm-1', 'bar-pulse-sales');
    const profitId = barPulseMaskId('bkm-1', 'bar-pulse-profit');
    assert.notEqual(salesId, profitId);
    assert.ok(salesId.includes('sales'));
    assert.ok(profitId.includes('profit'));
  });

  it('stays scoped by mount id, matching the pre-D623 single-pulse id shape', () => {
    const idPrefix = 'bkm-42';
    const id = barPulseMaskId(idPrefix, 'bar-pulse-sales');
    assert.ok(id.startsWith(idPrefix));
  });
});
