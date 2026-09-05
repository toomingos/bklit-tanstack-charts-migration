// V1.3 home: failure-modes fixture (child outside a chart throws the legacy
// message; unknown children are ignored per 10 §1 "Failure modes").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleEntry, loadFresh } from './lib/render.mjs';

// Legacy throw contract (repos/bklit-ui chart-context.tsx via useChartStable).
const LEGACY_THROW_NEEDLE = 'must be used within a ChartProvider';

const { checkHoc } = await loadFresh(bundleEntry('hoc.tsx'));
const summary = checkHoc();

test('throw/standalone: a carrier rendered outside a chart throws the legacy message', () => {
  assert.match(summary.standaloneMessage, new RegExp(LEGACY_THROW_NEEDLE));
});

test('throw/unknown-child: a plain div inside a chart is ignored, never thrown on', () => {
  assert.equal(summary.divAreas, 0);
  assert.equal(summary.divLines, 0);
  assert.equal(summary.divGridNull, true);
});
