#!/usr/bin/env node
// bench/measure-bundle.mjs — per-scenario bundle-size measurement via esbuild.
// Bundles each (impl, chart) combo's scenario import tree (minified, gzipped,
// with react/react-dom externalized as shared runtime deps) and writes the
// results to bench/results/bundle-sizes.json. Run once per migration phase;
// bench/run.mjs and bench/report.mjs consume the output for M2c.
//
// Usage:
//   node bench/measure-bundle.mjs

import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, mkdtempSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APP_DIR = resolve(__dirname, "app");
const SCENARIOS_DIR = resolve(APP_DIR, "src", "scenarios");
const RESULTS_DIR = resolve(__dirname, "results");
const REPOS_DIR = resolve(ROOT, "repos");

// ---------------------------------------------------------------------------
// Gather (impl, chart) combos from the scenarios directory
// ---------------------------------------------------------------------------
const files = readdirSync(SCENARIOS_DIR);

/** @type {{ impl: string, chart: string }[]} */
const combos = [];
for (const f of files) {
  const match = f.match(/^(bklit|tanstack|migrated)-(.+)\.tsx$/);
  if (match) {
    combos.push({ impl: match[1], chart: match[2] });
  }
}

console.log(
  `[measure-bundle] found ${combos.length} (impl, chart) combos across ${files.length} scenario files\n`,
);

// ---------------------------------------------------------------------------
// Build TanStack subpath-export alias maps (exact match, longest-first)
// ---------------------------------------------------------------------------
function loadExports(pkgJsonPath, packageName, pkgDir) {
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
  /** @type {Record<string, string>} */
  const exportsMap = pkg.exports ?? {};
  /** @type {[string, string][]} */
  const entries = [];
  for (const [subpath, target] of Object.entries(exportsMap)) {
    if (typeof target !== "string") continue;
    const importPath =
      subpath === "." ? packageName : `${packageName}/${subpath.slice(2)}`;
    const cleanTarget = target.replace(/^\.\//, "");
    entries.push([importPath, resolve(pkgDir, cleanTarget)]);
  }
  // Longest key first so specific subpaths take precedence
  entries.sort((a, b) => b[0].length - a[0].length);
  return entries;
}

// Vendored TanStack v0.7.2 fixture under showcase/ (same source the showcase
// + bench/app/vite.config.ts resolve, see docs/LOG.md D146). M2c must measure
// the same TanStack source the gates + QA run against — the top-level repos/
// clone is an older pre-v0.7.2 snapshot and must NOT be used here.
const chartsCoreDir = resolve(ROOT, "showcase/repos/tanstack-charts/packages/charts-core");
const reactChartsDir = resolve(ROOT, "showcase/repos/tanstack-charts/packages/react-charts");

const tanstackAliasEntries = [
  ...loadExports(
    resolve(chartsCoreDir, "package.json"),
    "@tanstack/charts",
    chartsCoreDir,
  ),
  ...loadExports(
    resolve(reactChartsDir, "package.json"),
    "@tanstack/react-charts",
    reactChartsDir,
  ),
];

/** @type {Map<string, string>} */
const tanstackAliasMap = new Map(tanstackAliasEntries);

console.log(
  `[measure-bundle] loaded ${tanstackAliasEntries.length} TanStack subpath-exports\n`,
);

// ---------------------------------------------------------------------------
// Extension resolution helper — esbuild treats a `path` returned from
// `onResolve` as final, so we must resolve extensions ourselves.
// ---------------------------------------------------------------------------
const EXTS = ["", ".tsx", ".ts", ".jsx", ".js", ".mjs", "/index.tsx", "/index.ts", "/index.jsx", "/index.js", "/index.mjs"];

function resolveExt(basePath) {
  for (const ext of EXTS) {
    const candidate = basePath + ext;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not found or not a file
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Esbuild alias plugin — mirrors bench/app/vite.config.ts resolution
// ---------------------------------------------------------------------------

/** @type {import("esbuild").Plugin} */
const aliasPlugin = {
  name: "alias",
  setup(build) {
    // TanStack packages: exact-match via the precomputed exports map
    // (paths already include extensions, so no further resolution needed).
    build.onResolve(
      { filter: /^@tanstack\/(charts|react-charts)/ },
      (args) => {
        const resolved = tanstackAliasMap.get(args.path);
        if (resolved) return { path: resolved };
        return undefined;
      },
    );

    // d3-scale / d3-shape — used by migrated chart sources; resolved from
    // bench/app's node_modules exactly as vite.config.ts does.
    build.onResolve({ filter: /^d3-scale$/ }, () => ({
      path: resolve(APP_DIR, "node_modules/d3-scale/src/index.js"),
    }));
    build.onResolve({ filter: /^d3-shape$/ }, () => ({
      path: resolve(APP_DIR, "node_modules/d3-shape/src/index.js"),
    }));
    build.onResolve({ filter: /^d3-array$/ }, () => ({
      path: resolve(APP_DIR, "node_modules/d3-array/src/index.js"),
    }));

    // bklit-ui chart barrel (exact match, resolved file)
    build.onResolve({ filter: /^@bklitui\/ui\/charts$/ }, () => ({
      path: resolve(REPOS_DIR, "bklit-ui/packages/ui/src/charts/index.ts"),
    }));
    // bklit-ui chart subpath (e.g. decimate-time-series) — prefix replace
    // then resolve extension
    build.onResolve({ filter: /^@bklitui\/ui\/charts\// }, (args) => {
      const basePath = args.path.replace(
        "@bklitui/ui/charts/",
        resolve(REPOS_DIR, "bklit-ui/packages/ui/src/charts/") + "/",
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    // bklit-ui icons (used internally by bklit chart sources)
    build.onResolve({ filter: /^@bklitui\/icons/ }, (args) => {
      const basePath = args.path.replace(
        "@bklitui/icons",
        resolve(REPOS_DIR, "bklit-ui/packages/icons/src"),
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    // bklit-ui tsconfig `@` path alias (used internally, e.g. `@/lib/utils`)
    build.onResolve({ filter: /^@\// }, (args) => {
      const basePath = args.path.replace(
        "@/",
        resolve(REPOS_DIR, "bklit-ui/packages/ui/src") + "/",
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    // @number-flow/react — used internally by migrated ring/gauge charts
    build.onResolve({ filter: /^@number-flow\/react/ }, (args) => {
      const basePath = args.path.replace(
        "@number-flow/react",
        resolve(APP_DIR, "node_modules/@number-flow/react/dist"),
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    // Migrated charts barrel (exact match -> index.ts)
    build.onResolve({ filter: /^@migrated\/charts$/ }, () => ({
      path: resolve(ROOT, "showcase/migrated/charts/index.ts"),
    }));
    // Migrated charts subpath (e.g. @migrated/charts/line-chart)
    build.onResolve({ filter: /^@migrated\/charts\// }, (args) => {
      const basePath = args.path.replace(
        "@migrated/charts/",
        resolve(ROOT, "showcase/migrated/charts/") + "/",
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    // CSS imports — return empty content so they don't fail the build;
    // CSS doesn't contribute to JS bundle size.
    build.onLoad({ filter: /\.css$/ }, () => ({
      contents: "",
      loader: "css",
    }));
  },
};

// ---------------------------------------------------------------------------
// Build & measure each combo
// ---------------------------------------------------------------------------

/** @type {Record<string, { raw: number, gzip: number } | null>} */
const results = {};
let failures = 0;

// Temp output dir — esbuild needs a resolved output path when CSS imports
// are present (even with `write: false`).
const TMP_DIR = mkdtempSync(resolve(tmpdir(), "bklit-bundle-"));

for (const { impl, chart } of combos) {
  // Minimal entry: imports the scenario file (tree-shaking ensures only the
  // component's transitive dependency graph is measured, not the bench
  // harness plumbing it sits in).
  const entry = `import "./${impl}-${chart}.tsx";`;

  try {
    const result = await build({
      stdin: {
        contents: entry,
        resolveDir: SCENARIOS_DIR,
        loader: "tsx",
      },
      bundle: true,
      minify: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      metafile: true,
      write: false,
      outdir: TMP_DIR,
      external: ["react", "react-dom"],
      absWorkingDir: APP_DIR,
      plugins: [aliasPlugin],
      logLevel: "silent",
    });

    const contents = result.outputFiles[0].contents;
    const raw = contents.byteLength;
    const gzip = gzipSync(Buffer.from(contents)).length;

    results[`${impl}/${chart}`] = { raw, gzip };
    console.log(
      `  ${impl}/${chart}: raw=${(raw / 1024).toFixed(1)} kB  gzip=${(gzip / 1024).toFixed(1)} kB`,
    );
  } catch (err) {
    console.error(`  ${impl}/${chart}: FAILED — ${err.message}`);
    results[`${impl}/${chart}`] = null;
    failures++;
  }
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
mkdirSync(RESULTS_DIR, { recursive: true });
const outPath = resolve(RESULTS_DIR, "bundle-sizes.json");
writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n");

const ok = Object.values(results).filter((v) => v !== null).length;

console.log(
  `\n[measure-bundle] wrote ${ok} bundle${ok !== 1 ? "s" : ""} (${failures} failed) -> ${outPath}`,
);

if (failures > 0) process.exitCode = 1;
