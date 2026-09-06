#!/usr/bin/env node
// Per-scenario CSS sizes via esbuild (min+gzip of the emitted CSS) -> css-sizes.json.
//
// Mirrors bench/measure-bundle.mjs (same scenario discovery, aliases, externals)
// except CSS is bundled for real instead of stubbed out; scenarios that emit no
// CSS record {raw: 0, gzip: 0}. Report-only input for the bundle gate's CSS column.

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
  `[measure-css] found ${combos.length} (impl, chart) combos across ${files.length} scenario files\n`,
);

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
    const resolvedTarget =
      typeof target === "string" ? target : (target.import ?? target.default);
    const cleanTarget = resolvedTarget.replace(/^\.\//, "");
    entries.push([importPath, resolve(pkgDir, cleanTarget)]);
  }
  entries.sort((a, b) => b[0].length - a[0].length);
  return entries;
}

// TanStack resolved from bench/app/node_modules (0.15.0 dist); not comparable pre-5.0 boundary.
const chartsCoreDir = resolve(APP_DIR, "node_modules/@tanstack/charts");
const reactChartsDir = resolve(APP_DIR, "node_modules/@tanstack/react-charts");

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
  `[measure-css] loaded ${tanstackAliasEntries.length} TanStack subpath-exports\n`,
);

// esbuild onResolve results are final, so resolve extensions manually.
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

/** @type {import("esbuild").Plugin} */
const aliasPlugin = {
  name: "alias",
  setup(build) {
    // Exact-match via exports map (paths already resolved).
    build.onResolve(
      { filter: /^@tanstack\/(charts|react-charts)/ },
      (args) => {
        const resolved = tanstackAliasMap.get(args.path);
        if (resolved) return { path: resolved };
        return undefined;
      },
    );

    build.onResolve({ filter: /^d3-scale$/ }, () => ({
      path: resolve(APP_DIR, "node_modules/d3-scale/src/index.js"),
    }));
    build.onResolve({ filter: /^d3-shape$/ }, () => ({
      path: resolve(APP_DIR, "node_modules/d3-shape/src/index.js"),
    }));
    build.onResolve({ filter: /^d3-array$/ }, () => ({
      path: resolve(APP_DIR, "node_modules/d3-array/src/index.js"),
    }));

    build.onResolve({ filter: /^@bklitui\/ui\/charts$/ }, () => ({
      path: resolve(REPOS_DIR, "bklit-ui/packages/ui/src/charts/index.ts"),
    }));
    build.onResolve({ filter: /^@bklitui\/ui\/charts\// }, (args) => {
      const basePath = args.path.replace(
        "@bklitui/ui/charts/",
        resolve(REPOS_DIR, "bklit-ui/packages/ui/src/charts/") + "/",
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    build.onResolve({ filter: /^@bklitui\/icons/ }, (args) => {
      const basePath = args.path.replace(
        "@bklitui/icons",
        resolve(REPOS_DIR, "bklit-ui/packages/icons/src"),
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    build.onResolve({ filter: /^@\// }, (args) => {
      const basePath = args.path.replace(
        "@/",
        resolve(REPOS_DIR, "bklit-ui/packages/ui/src") + "/",
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    build.onResolve({ filter: /^@number-flow\/react/ }, (args) => {
      const basePath = args.path.replace(
        "@number-flow/react",
        resolve(APP_DIR, "node_modules/@number-flow/react/dist"),
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    build.onResolve({ filter: /^@migrated\/charts$/ }, () => ({
      path: resolve(ROOT, "showcase/migrated/charts/index.ts"),
    }));
    build.onResolve({ filter: /^@migrated\/charts\// }, (args) => {
      const basePath = args.path.replace(
        "@migrated/charts/",
        resolve(ROOT, "showcase/migrated/charts/") + "/",
      );
      const resolved = resolveExt(basePath);
      return resolved ? { path: resolved } : undefined;
    });

    // No CSS stub here (unlike measure-bundle.mjs): CSS is bundled for real so its bytes can be measured.
  },
};

/** @type {Record<string, { raw: number, gzip: number } | null>} */
const results = {};
let failures = 0;

// esbuild needs an outdir for CSS handling even with write:false.
const TMP_DIR = mkdtempSync(resolve(tmpdir(), "bklit-css-"));

for (const { impl, chart } of combos) {
  // Entry must re-export the scenario: bare import tree-shakes to zero (sideEffects:false).
  const entry = `import Scenario from "./${impl}-${chart}.tsx"; export default Scenario;`;

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

    const cssParts = result.outputFiles
      .filter((f) => f.path.endsWith(".css"))
      .map((f) => Buffer.from(f.contents));
    const css = Buffer.concat(cssParts);
    const raw = css.byteLength;
    const gzip = raw ? gzipSync(css).length : 0;

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

mkdirSync(RESULTS_DIR, { recursive: true });
const outPath = resolve(RESULTS_DIR, "css-sizes.json");
writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n");

const ok = Object.values(results).filter((v) => v !== null).length;

console.log(
  `\n[measure-css] wrote ${ok} css bundle${ok !== 1 ? "s" : ""} (${failures} failed) -> ${outPath}`,
);

if (failures > 0) process.exitCode = 1;
