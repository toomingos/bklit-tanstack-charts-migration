import path from "path";

const showcaseRoot = import.meta.dirname;

// TanStack Charts resolves from node_modules via the published package's own
// `exports` map (pinned exact: @tanstack/charts@0.16.0 + @tanstack/react-charts@0.16.0).
// Phase 5.0.1 replaced the vendored source clone + hand-built subpath aliases;
// the old clone is archived at local_cache/tanstack-charts-a285ce7-v0.14.0 for diffing.
// See docs/phase-5/LOG.md (supersedes D238).

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      "@showcase/bklit-charts": "./packages/bklit-charts/index.ts",
      "@showcase/migrated-charts": "./migrated/charts/index.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@showcase/bklit-charts": path.resolve(
        showcaseRoot,
        "./packages/bklit-charts/index.ts"
      ),
      "@showcase/migrated-charts": path.resolve(
        showcaseRoot,
        "./migrated/charts/index.ts"
      ),
    };
    // When webpack resolves imports from within repos/bklit-ui/, we need it to
    // also check showcase/node_modules for deps like motion, @visx/*, etc.
    config.resolve.modules = [
      path.resolve(showcaseRoot, "node_modules"),
      ...config.resolve.modules,
    ];
    return config;
  },
};

export default nextConfig;
