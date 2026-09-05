// V4.3 gate: legacy motion curves vs package tween/spring at 64 points stay
// within tolerance (line-pulse is parity-contract §5 exception-1, not FAIL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCurveParity } from '../curve-parity.mjs';

test('curve-parity: candle tween + reveal tracks within tolerance', () => {
  const { rows, failed } = runCurveParity({ quiet: true });
  assert.deepStrictEqual(
    failed.map((r) => r.name),
    [],
    `curves outside tolerance: ${failed.map((r) => `${r.name} maxΔ=${r.maxDelta}`).join(', ')}`,
  );
  for (const name of ['candle-enter', 'reveal-enter', 'sunburst-zoom', 'sunburst-grow', 'ring-hover']) {
    assert.strictEqual(
      rows.find((r) => r.name === name)?.verdict,
      'PASS',
      `${name} must PASS`,
    );
  }
  assert.strictEqual(
    rows.find((r) => r.name === 'line-pulse')?.verdict,
    'exception-1',
    'line-pulse stays exception-1 (two package transitions)',
  );
});
