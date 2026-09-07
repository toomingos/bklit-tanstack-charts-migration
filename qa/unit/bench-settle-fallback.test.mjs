// A15 (D629/D630): every settle arm installs a 2500ms safety net, and until now
// nothing recorded when the net -- rather than the chart -- resolved
// `__benchSettled`. migrated/scatter/1000 read 2505.3 for three runs and was
// adopted into qa/gate/bench-baseline.json as "a live regression" because of it.
//
// These tests drive the REAL bench/app/src/bench/settle.ts (bundled by esbuild,
// no reimplementation) against a fake `window`, and assert the one property the
// gate now depends on: `__benchSettleFallback` is true exactly when the timer
// resolved, and false when the chart did.
import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const unitDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(unitDir, '..', '..');
const src = join(repoRoot, 'bench/app/src/bench/settle.ts');
const out = join(unitDir, '.tmp', 'settle.cjs');

// Minimal fake window: a manual timer queue so "the net fired" and "the chart
// signalled" are orderings we choose, not races we wait out.
function makeWindow() {
  const timers = new Map();
  let seq = 0;
  const w = {
    setTimeout: (fn, ms) => { timers.set(++seq, { fn, ms }); return seq; },
    clearTimeout: (id) => { timers.delete(id); },
    // rAF resolves synchronously: armBklitTimerSettle nests two of them.
    requestAnimationFrame: (fn) => { fn(); return 0; },
  };
  // Fire every timer whose delay is <= ms, in scheduled order.
  w.__advance = (ms) => {
    for (const [id, t] of [...timers.entries()]) {
      if (t.ms <= ms) { timers.delete(id); t.fn(); }
    }
  };
  w.__pending = () => timers.size;
  return w;
}

let settle;
before(() => {
  mkdirSync(join(unitDir, '.tmp'), { recursive: true });
  const esbuild = [
    join(repoRoot, 'showcase/node_modules/.bin/esbuild'),
    join(repoRoot, 'node_modules/.bin/esbuild'),
    join(repoRoot, 'bench/app/node_modules/.bin/esbuild'),
  ].find((p) => existsSync(p));
  assert.ok(esbuild, 'esbuild binary not found');
  execFileSync(esbuild, [src, '--bundle', '--format=cjs', '--platform=neutral', `--outfile=${out}`], { stdio: 'pipe' });
  // Evaluate the CJS bundle with `window` bound to our fake, per test.
  const code = readFileSync(out, 'utf8');
  settle = (w) => {
    const module = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'window', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', code)(
      module, module.exports, w, w.requestAnimationFrame, w.setTimeout, w.clearTimeout,
    );
    return module.exports;
  };
});

describe('A15 — settle fallback provenance', () => {
  it('armBklitSettle: a real non-ready -> ready pair is a measurement', async () => {
    const w = makeWindow();
    const { armBklitSettle } = settle(w);
    const { onPhaseChange } = armBklitSettle();
    onPhaseChange('revealing');
    onPhaseChange('ready');
    await w.__benchSettled;
    assert.equal(w.__benchSettleFallback, false);
    assert.equal(w.__pending(), 0, 'the net must be cancelled, not left armed');
  });

  it('armBklitSettle: no phase pair means the net resolves, and says so', async () => {
    const w = makeWindow();
    const { armBklitSettle } = settle(w);
    armBklitSettle();
    w.__advance(2500);
    await w.__benchSettled;
    assert.equal(w.__benchSettleFallback, true);
  });

  it('armBklitSettle: `ready` with no preceding non-ready is the scatter bug — still the net', async () => {
    // This is exactly what migrated ScatterChart did before 97e2967, and the
    // reason 2505.3 was mistaken for a 1.98x regression.
    const w = makeWindow();
    const { armBklitSettle } = settle(w);
    const { onPhaseChange } = armBklitSettle();
    onPhaseChange('ready');
    w.__advance(2500);
    await w.__benchSettled;
    assert.equal(w.__benchSettleFallback, true);
  });

  it('armTanstackSettle: onRender is a measurement', async () => {
    const w = makeWindow();
    const { armTanstackSettle } = settle(w);
    const { onRender } = armTanstackSettle();
    onRender();
    await w.__benchSettled;
    assert.equal(w.__benchSettleFallback, false);
  });

  it('armBklitTimerSettle: the cited internal timer is a measurement, not the net', async () => {
    const w = makeWindow();
    const { armBklitTimerSettle } = settle(w);
    armBklitTimerSettle(1100);
    w.__advance(1100); // fires the 1100 arm only; the 2500 net stays pending
    await w.__benchSettled;
    assert.equal(w.__benchSettleFallback, false);
  });

  it('armManualSettle: honours a caller-supplied net and marks it', async () => {
    const w = makeWindow();
    const { armManualSettle } = settle(w);
    armManualSettle(9000);
    w.__advance(2500);
    // armFallback sets the flag false at arm time, so this asserts the shared
    // 2500ms constant did not leak past the caller-supplied 9000ms net.
    assert.equal(w.__benchSettleFallback, false);
    w.__advance(9000);
    await w.__benchSettled;
    assert.equal(w.__benchSettleFallback, true);
  });

  it('armManualSettle: an explicit resolve beats the net', async () => {
    const w = makeWindow();
    const { armManualSettle } = settle(w);
    const { resolve } = armManualSettle(2500);
    resolve();
    await w.__benchSettled;
    assert.equal(w.__benchSettleFallback, false);
    assert.equal(w.__pending(), 0);
  });

  it('a late chart signal cannot rewrite a fallback resolution', async () => {
    const w = makeWindow();
    const { armBklitSettle } = settle(w);
    const { onPhaseChange } = armBklitSettle();
    w.__advance(2500);
    onPhaseChange('revealing');
    onPhaseChange('ready');
    await w.__benchSettled;
    assert.equal(w.__benchSettleFallback, true, 'provenance is decided by whoever resolved first');
  });
});
