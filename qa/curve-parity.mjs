// V4.3 transient parity in Node (no browser): legacy `motion` spring/bezier
// generators vs the package tween/spring at 64 points per curve.
// Legacy side uses the real installed generators (`motion-dom` spring,
// `motion` cubicBezier/easing — both already in showcase/node_modules, no new
// dependency). Package side uses the real `createChartSpring` from the pinned
// dist plus a verbatim copy of its unexported easing resolver (cited below),
// and the migrated duration/bounce->stiffness/damping port for the candle.
// Tolerance 0.02 on normalised progress: no D-entry in docs/phase-7/LOG.md or
// archive/phase-6/docs/LOG.md gives a curve tolerance (grepped 2026-09-05).
// Usage: node qa/curve-parity.mjs (exit non-zero on any FAIL).
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChartSpring } from '../showcase/node_modules/@tanstack/charts/dist/spring.js';
import { findSpringStiffnessDamping } from '../showcase/migrated/charts/internal/candle-spring.ts';
import { resolveMotionEasing } from '../showcase/migrated/charts/internal/reveal-easing.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
// `motion` is a pnpm symlink; resolve through the real path so its
// `motion-dom` dependency resolves. Both packages are already installed.
const motionReq = createRequire(
  join(realpathSync(join(repoRoot, 'showcase', 'node_modules', 'motion')), 'package.json'),
);
const { spring: legacySpring } = motionReq('motion-dom');
const { cubicBezier: legacyCubicBezier, easingDefinitionToFunction: legacyEasingFn } =
  motionReq('motion');

// Package easing, verbatim from showcase/node_modules/@tanstack/charts/dist/motion.js
// (resolveEasing ~:2778 + cubicBezier :2795; unexported, so copied, not reimplemented).
const pkgDefaultEasing = pkgCubicBezier(0.85, 0, 0.15, 1);
function pkgResolveEasing(easing) {
  if (typeof easing === 'function') return easing;
  switch (easing) {
    case 'linear': return (p) => p;
    case 'ease-in': return (p) => p * p;
    case 'ease-in-out': return (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
    case 'ease': return pkgCubicBezier(0.25, 0.1, 0.25, 1);
    case 'ease-out': return (p) => 1 - (1 - p) * (1 - p);
    default: return pkgDefaultEasing;
  }
}
function pkgCubicBezier(x1, y1, x2, y2) {
  const sample = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  return (progress) => {
    let low = 0;
    let high = 1;
    let time = progress;
    for (let i = 0; i < 12; i += 1) {
      time = (low + high) / 2;
      if (sample(time, x1, x2) < progress) low = time;
      else high = time;
    }
    return sample(time, y1, y2);
  };
}

const N = 64;
const TOL = 0.02;
// Progress is clamped, easing output is not (overshoot keyframes survive).
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const tweenAt = (ease, durationMs) => (tMs) => ease(clamp01(durationMs <= 0 ? 1 : tMs / durationMs));
const legacySpringAt = (opts) => {
  const gen = legacySpring({ keyframes: [0, 1], ...opts });
  return (tMs) => gen.next(tMs).value;
};
const pkgSpringAt = (opts) => {
  const s = createChartSpring(opts);
  return (tMs) => s.sample(tMs, { from: 0, to: 1, velocity: 0 }).value;
};

const rows = [
  {
    name: 'reveal-enter',
    legacyParams: 'tween 1100ms cubic-bezier(0.85,0,0.15,1) [animation.ts:9]',
    pkgParams: 'tween 1100ms cubicBezier(0.85,0,0.15,1) [dist/motion.js:25]',
    windowMs: 1100,
    legacyAt: tweenAt(legacyCubicBezier(0.85, 0, 0.15, 1), 1100),
    pkgAt: tweenAt(pkgCubicBezier(0.85, 0, 0.15, 1), 1100),
  },
  {
    name: 'candle-enter',
    legacyParams: 'spring duration 0.8s bounce 0.15 [candlestick.tsx:395]',
    pkgParams: 'spring stiffness/damping via findSpring [candle-spring.ts]',
    windowMs: 2000,
    legacyAt: legacySpringAt({ duration: 800, bounce: 0.15 }),
    pkgAt: pkgSpringAt(findSpringStiffnessDamping({ durationMs: 800, bounce: 0.15 })),
  },
  {
    name: 'sunburst-zoom',
    legacyParams: 'tween 750ms [0.22,1,0.36,1] [sunburst-chart.tsx:244]',
    pkgParams: 'tween 750ms fn via resolveMotionEasing [reveal-easing.ts]',
    windowMs: 750,
    legacyAt: tweenAt(legacyCubicBezier(0.22, 1, 0.36, 1), 750),
    pkgAt: tweenAt(resolveMotionEasing('cubic-bezier(0.22,1,0.36,1)'), 750),
  },
  {
    name: 'sunburst-grow',
    legacyParams: 'tween 420ms [0.22,1,0.36,1] [sunburst-chart.tsx:312]',
    pkgParams: 'tween 420ms fn via resolveMotionEasing [reveal-easing.ts]',
    windowMs: 420,
    legacyAt: tweenAt(legacyCubicBezier(0.22, 1, 0.36, 1), 420),
    pkgAt: tweenAt(resolveMotionEasing('cubic-bezier(0.22,1,0.36,1)'), 420),
  },
  {
    name: 'ring-hover',
    legacyParams: 'spring {400,25} [pie-slice.tsx:163]',
    pkgParams: 'spring HOVER_SPRING {400,25} [pie-hover-chrome.ts:12]',
    windowMs: 2000,
    legacyAt: legacySpringAt({ stiffness: 400, damping: 25 }),
    pkgAt: pkgSpringAt({ stiffness: 400, damping: 25 }),
  },
  {
    name: 'hover-dim',
    legacyParams: 'tween 400ms easeInOut [series-hover-dim.tsx:51]',
    pkgParams: 'tween 400ms ease-in-out',
    windowMs: 400,
    legacyAt: tweenAt(legacyEasingFn('easeInOut'), 400),
    pkgAt: tweenAt(pkgResolveEasing('ease-in-out'), 400),
  },
  {
    name: 'candle-dim',
    legacyParams: 'css 150ms ease-in-out [candlestick.tsx:217]',
    pkgParams: 'tween 150ms ease-in-out [candlestick-chart-marks.ts:72]',
    windowMs: 150,
    legacyAt: tweenAt(legacyEasingFn('easeInOut'), 150),
    pkgAt: tweenAt(pkgResolveEasing('ease-in-out'), 150),
  },
  {
    name: 'tooltip-spring',
    legacyParams: 'spring {300,30} [chart-config-context.tsx:20]',
    pkgParams: 'spring {300,30}',
    windowMs: 2000,
    legacyAt: legacySpringAt({ stiffness: 300, damping: 30 }),
    pkgAt: pkgSpringAt({ stiffness: 300, damping: 30 }),
  },
  {
    name: 'gauge-notch',
    legacyParams: 'spring {300,20} [gauge.tsx:31]',
    pkgParams: 'spring {300,20}',
    windowMs: 2000,
    legacyAt: legacySpringAt({ stiffness: 300, damping: 20 }),
    pkgAt: pkgSpringAt({ stiffness: 300, damping: 20 }),
  },
  {
    // Parity-contract §5 exception 1: pulses use two package transitions
    // instead of one keyframe list, so a single curve cannot match. The
    // residual below is legacy grow+shrink position vs one monotonic tween.
    name: 'line-pulse',
    legacyParams: 'loop 2.2s pulse grow+shrink [line-loading-timing.ts:1]',
    pkgParams: 'two package transitions (exception-1)',
    windowMs: 2200,
    exception: 'exception-1',
    legacyAt: (tMs) => {
      const p = legacyCubicBezier(0.85, 0, 0.15, 1)(clamp01(tMs / 2200));
      return p <= 0.5 ? p / 0.5 : (1 - p) / 0.5;
    },
    pkgAt: tweenAt(pkgDefaultEasing, 2200),
  },
];

export function runCurveParity({ quiet = false } = {}) {
  const results = rows.map((r) => {
    let maxDelta = 0;
    let sumSq = 0;
    for (let i = 0; i < N; i += 1) {
      const t = (i / (N - 1)) * r.windowMs;
      const d = Math.abs(r.legacyAt(t) - r.pkgAt(t));
      maxDelta = Math.max(maxDelta, d);
      sumSq += d * d;
    }
    const rms = Math.sqrt(sumSq / N);
    const verdict = r.exception ?? (maxDelta <= TOL ? 'PASS' : 'FAIL');
    return { ...r, maxDelta, rms, tolerance: TOL, verdict, legacyAt: undefined, pkgAt: undefined };
  });
  if (!quiet) {
    const pad = (s, n) => String(s).padEnd(n).slice(0, n);
    console.log(
      `${pad('curve', 14)} ${pad('legacy params', 46)} ${pad('package params', 46)} ${pad('max|Δ|', 9)} ${pad('rms Δ', 9)} ${pad('tol', 6)} verdict`,
    );
    for (const r of results) {
      console.log(
        `${pad(r.name, 14)} ${pad(r.legacyParams, 46)} ${pad(r.pkgParams, 46)} ${pad(r.maxDelta.toFixed(5), 9)} ${pad(r.rms.toFixed(5), 9)} ${pad(r.tolerance, 6)} ${r.verdict}`,
      );
    }
  }
  return { rows: results, failed: results.filter((r) => r.verdict === 'FAIL') };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const { failed } = runCurveParity();
  process.exit(failed.length ? 1 : 0);
}
