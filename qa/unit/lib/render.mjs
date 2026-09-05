// Shared helpers for qa/unit (node:test only; no new dependencies).
// - esbuild bundles a .tsx entry (showcase sources) into qa/unit/.tmp/ for SSR probes.
// - @tanstack/charts + d3-scale are imported directly for headless scene tests.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scaleLinear } from 'd3-scale';

const here = dirname(fileURLToPath(import.meta.url)); // qa/unit/lib
export const unitDir = dirname(here); // qa/unit
const qaDir = dirname(unitDir); // qa
export const repoRoot = dirname(qaDir); // repo root
export const showcaseDir = join(repoRoot, 'showcase');

// Headless scene API (pinned package lives in showcase/node_modules).
export {
  createChartRuntime,
  createChartScene,
  defineChart,
  renderChartSvg,
} from '../../../showcase/node_modules/@tanstack/charts/dist/index.js';

// Initial width every SSR probe renders at (matches the scene size).
export const INITIAL_WIDTH = 640;

// Minimal linear scale for representative scene specs (app-owned D3 scale,
// the same ownership model migrated charts use).
export const linearScale = (id, domain) => ({
  id,
  resolve: (ctx) => {
    const s = scaleLinear().domain(domain).range([ctx.range[0], ctx.range[1]]);
    return { id: ctx.id, type: 'linear', domain: s.domain(), map: (v) => s(v), ticks: [] };
  },
});

// Every gradient/pattern/clip id declared in serialized svg …
export function svgResourceIds(svg) {
  return [...svg.matchAll(/<(linearGradient|radialGradient|pattern|clipPath)[^>]*\sid="([^"]+)"/g)].map(
    (m) => m[2],
  );
}

// … must be referenced by a fill/stroke paint (no orphaned defs).
export function svgUnreferencedIds(svg) {
  const refs = new Set([...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]));
  return svgResourceIds(svg).filter((id) => !refs.has(id));
}

export const countMatches = (html, re) => [...html.matchAll(re)].length;

// esbuild ships with the repo root devDependencies; the task names the
// showcase bin path, which does not exist (esbuild is a root devDep), so
// fall back to the root bin. No new dependency either way.
function esbuildBin() {
  const candidates = [
    join(showcaseDir, 'node_modules/.bin/esbuild'),
    join(repoRoot, 'node_modules/.bin/esbuild'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`esbuild binary not found (tried ${candidates.join(', ')})`);
  return found;
}

const bundleSources = () => [
  join(unitDir, 'entries'),
  join(showcaseDir, 'migrated'),
  join(showcaseDir, 'lib'),
  join(showcaseDir, 'packages'),
];

function newestMtime(paths) {
  let newest = 0;
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) for (const e of readdirSync(p)) walk(join(p, e));
    else if (st.mtimeMs > newest) newest = st.mtimeMs;
  };
  for (const p of paths) if (existsSync(p)) walk(p);
  return newest;
}

// Bundle a .tsx entry to qa/unit/.tmp/<name>.cjs (self-contained: react,
// showcase sources and @tanstack/* all bundled in; cjs so bundled CJS deps
// like react-dom/server keep working `require`). Rebuilds only when a
// source is newer than the bundle, so repeat runs stay ~1s.
export function bundleEntry(entryName) {
  const entry = join(unitDir, 'entries', entryName);
  const out = join(unitDir, '.tmp', entryName.replace(/\.tsx$/, '.cjs'));
  mkdirSync(dirname(out), { recursive: true });
  if (!existsSync(out) || statSync(out).mtimeMs < newestMtime([entry, ...bundleSources()])) {
    // Entries live under qa/unit (root node_modules react) while chart sources
    // live under showcase (showcase react): same version, two instances, which
    // breaks hooks. Pin both to the single showcase copy.
    const alias = ['react', 'react-dom'].map(
      (pkg) => `--alias:${pkg}=${realpathSync(join(showcaseDir, 'node_modules', pkg))}`,
    );
    execFileSync(
      esbuildBin(),
      [
        entry,
        '--bundle',
        '--platform=node',
        '--format=cjs',
        ...alias,
        `--outfile=${out}`,
        '--jsx=automatic',
        '--loader:.css=empty',
        '--log-level=error',
      ],
      { stdio: 'pipe' },
    );
  }
  return out;
}

// Import a bundle bypassing the ESM cache when it was just rebuilt.
export function loadFresh(absPath) {
  return import(`${pathToFileURL(absPath).href}?t=${statSync(absPath).mtimeMs}`);
}
