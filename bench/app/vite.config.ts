import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Resolve repo-relative paths without touching anything under repos/.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// TanStack Charts resolves from bench/app/node_modules via the published
// package's own `exports` map (pinned exact: @tanstack/charts@0.15.0 +
// @tanstack/react-charts@0.15.0). Phase 5.0.1 replaced the vendored source
// clone + hand-built subpath aliases; the old clone is archived at
// local_cache/tanstack-charts-a285ce7-v0.14.0 for diffing. Bench/QA gates and
// the showcase now resolve the same published runtime.
// See docs/phase-5/LOG.md (supersedes D146/D238).

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
