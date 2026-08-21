import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Resolve repo-relative paths without touching anything under repos/.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Build exact subpath aliases (e.g. `@tanstack/charts/svg/renderer` ->
// `.../src/svg-surface.ts`) straight from each workspace package's own
// (dev, source-pointing) `exports` map, rather than guessing a naive
// `subpath -> subpath.ts` regex rewrite -- several of these packages' real
// export keys don't literally match their source file names (e.g.
// `./svg/renderer` -> `./src/svg-surface.ts`, not `./src/svg/renderer.ts`).
function aliasesFromExports(
  pkgJsonPath: string,
  packageName: string,
  pkgDir: string,
): Array<{ find: string; replacement: string }> {
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
  const exportsMap = pkg.exports as Record<string, string>;
  const aliases = Object.entries(exportsMap).map(([subpath, target]) => {
    const find = subpath === "." ? packageName : `${packageName}/${subpath.slice(2)}`;
    const cleanTarget = target.replace(/^\.\//, "");
    return { find, replacement: r(`${pkgDir}/${cleanTarget}`) };
  });
  // Vite/rollup-plugin-alias matches a string `find` on exact equality OR on
  // a `find + "/"` prefix -- so the bare package-root alias (from the "."
  // export, listed first in most exports maps) would otherwise greedily
  // match every subpath import before its own, more specific, alias entry
  // is even considered. Sorting longest-`find`-first guarantees the most
  // specific alias always wins.
  aliases.sort((a, b) => b.find.length - a.find.length);
  return aliases;
}

// Vendored TanStack v0.7.2 fixture under showcase/ (same source the showcase
// builds against, see docs/LOG.md D146). The top-level repos/ clone is an
// older pre-v0.7.2 snapshot and must NOT be used here — bench/QA gates and
// showcase must resolve the same TanStack source.
const chartsCoreDir = "../../showcase/repos/tanstack-charts/packages/charts-core";
const reactChartsDir = "../../showcase/repos/tanstack-charts/packages/react-charts";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // bklit-ui package + its internal `@/*` -> `src/*` tsconfig path alias
      // (used inside the chart sources themselves, e.g. `@/lib/utils`).
      // Specific-file alias MUST precede the barrel alias below (prefix match).
      // The migrated package imports bklit's decimation module directly as a
      // single source of truth (docs/LOG.md D10) without dragging the barrel.
      {
        find: "@bklitui/ui/charts/decimate-time-series",
        replacement: r(
          "../../repos/bklit-ui/packages/ui/src/charts/decimate-time-series.ts",
        ),
      },
      {
        find: "@bklitui/ui/charts",
        replacement: r("../../repos/bklit-ui/packages/ui/src/charts/index.ts"),
      },
      // Migrated components under test (Phase 1+).
      // Canonical source lives in showcase/migrated (moved there for Vercel
      // Root Directory compat); the root-level `migrated/` mirror was removed.
      {
        find: "@migrated/charts",
        replacement: r("../../showcase/migrated/charts/index.ts"),
      },
      // migrated/ lives outside this app root, so its bare imports don't
      // walk up into our node_modules — pin them explicitly.
      // `@number-flow/react` is pinned for the same reason (ring/gauge center
      // stat overlays import it from migrated/) — to the package's ESM entry,
      // since a bare directory target would skip package.json resolution.
      // Its own internal deps (`number-flow`, `react`) resolve normally from
      // its real node_modules location. Documented in docs/LOG.md (ring
      // migration entry).
      {
        find: "@number-flow/react",
        replacement: r("./node_modules/@number-flow/react/dist/index.mjs"),
      },
      { find: "d3-scale", replacement: r("./node_modules/d3-scale/src/index.js") },
      { find: "d3-shape", replacement: r("./node_modules/d3-shape/src/index.js") },
      { find: "d3-array", replacement: r("./node_modules/d3-array/src/index.js") },
      { find: "d3-geo", replacement: r("./node_modules/d3-geo/src/index.js") },
      { find: "d3-sankey", replacement: r("./node_modules/d3-sankey/src/index.js") },
      { find: "geojson", replacement: r("./node_modules/@types/geojson/index.d.ts") },
      { find: "@visx/zoom/lib/types", replacement: r("./node_modules/@visx/zoom/esm/types.js") },
      { find: "@visx/zoom/lib/util/matrix", replacement: r("./node_modules/@visx/zoom/esm/util/matrix.js") },
      { find: "@visx/zoom", replacement: r("./node_modules/@visx/zoom/esm/index.js") },
      {
        find: "@bklitui/icons",
        replacement: r("../../repos/bklit-ui/packages/icons/src/index.ts"),
      },
      {
        find: "@",
        replacement: r("../../repos/bklit-ui/packages/ui/src"),
      },
      // TanStack Charts — vendored v0.7.2 fixture (showcase/repos, D146);
      // same source showcase renders, aligned with its next.config aliases.
      // Every subpath export (svg/renderer, polar, geo, etc.) is generated
      // straight from each package's own `exports` map (see
      // `aliasesFromExports` above) so it resolves exactly like the real
      // published package would, including subpaths whose export key
      // doesn't literally match its source filename.
      ...aliasesFromExports(
        r(`${chartsCoreDir}/package.json`),
        "@tanstack/charts",
        chartsCoreDir,
      ),
      ...aliasesFromExports(
        r(`${reactChartsDir}/package.json`),
        "@tanstack/react-charts",
        reactChartsDir,
      ),
    ],
  },
  server: {
    fs: {
      // Allow reading the read-only repos/ sources and the shared bench/data.ts
      // one level up from this app root.
      allow: [r("../../")],
    },
  },
  build: {
    // Keep per-scenario chunking predictable for future M2c bundle-cost work
    // (stubbed for now, see bench/run.mjs TODO).
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
