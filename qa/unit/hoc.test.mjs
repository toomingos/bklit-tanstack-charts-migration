// V1.3 home: HOC/registration fixture (config carriers, HOC-wrapped and
// memoised children register per 10 §1 "Tree"). Runs the same summary the
// showcase fixture script (showcase/migrated/fixtures/hoc.check.mjs) prints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleEntry, loadFresh } from './lib/render.mjs';

const { checkHoc } = await loadFresh(bundleEntry('hoc.tsx'));
const summary = checkHoc();

test('hoc/carriers: memo and displayName HOC areas paint inside AreaChart', () => {
  assert.ok(summary.areaPathPresent, `no area path in ${summary.htmlLength} chars of html`);
  assert.equal(summary.scanned, 2, 'scan resolves memo + displayName HOC areas');
});

test('hoc/registry: plain wrappers register through the host registry union (dedupe by props)', () => {
  assert.equal(summary.unionMerged, 2);
  assert.equal(summary.deduped, 1);
});
