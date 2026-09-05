// V4.6 loader: bundles the migrated barrel (TS/TSX) to CJS once via esbuild
// and returns its namespace. Flags mirror qa/unit/lib/render.mjs (react pinned
// to the showcase copy, css emptied); the bundle is cached in qa/unit/.tmp/
// and rebuilt only when showcase/migrated is newer, so the 23 legacy files
// share one build. Test files destructure what they need; names the barrel
// lacks are simply undefined (those cases are test.todo, never exported).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadFresh, repoRoot, showcaseDir, unitDir } from './render.mjs';

const out = join(unitDir, '.tmp', 'legacy-barrel.cjs');

function esbuildBin() {
  const candidates = [
    join(showcaseDir, 'node_modules/.bin/esbuild'),
    join(repoRoot, 'node_modules/.bin/esbuild'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`esbuild binary not found (tried ${candidates.join(', ')})`);
  return found;
}

function newestMtime(dir) {
  let newest = 0;
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) for (const e of readdirSync(p)) walk(join(p, e));
    else if (st.mtimeMs > newest) newest = st.mtimeMs;
  };
  walk(dir);
  return newest;
}

let cache;
export async function legacyBarrel() {
  if (!cache) {
    mkdirSync(join(unitDir, '.tmp'), { recursive: true });
    if (!existsSync(out) || statSync(out).mtimeMs < newestMtime(join(showcaseDir, 'migrated'))) {
      // Unique temp name + atomic rename: node --test runs files in parallel
      // processes, so two processes may build at once; readers only see `out`.
      const tmp = `${out}.${process.pid}.cjs`;
      execFileSync(
        esbuildBin(),
        [
          join(showcaseDir, 'migrated', 'charts', 'index.ts'),
          '--bundle',
          '--platform=node',
          '--format=cjs',
          `--alias:react=${realpathSync(join(showcaseDir, 'node_modules', 'react'))}`,
          `--alias:react-dom=${realpathSync(join(showcaseDir, 'node_modules', 'react-dom'))}`,
          `--outfile=${tmp}`,
          '--jsx=automatic',
          '--loader:.css=empty',
          '--log-level=error',
        ],
        { stdio: 'pipe' },
      );
      renameSync(tmp, out);
    }
    cache = await loadFresh(out);
  }
  return cache;
}
