import path from "node:path";

const showcaseRoot = import.meta.dirname;

// TanStack Charts resolves via its published exports map.
// Diffing clone archived at local_cache/tanstack-charts-a285ce7-v0.14.0.

/**
 * @typedef {object} ShowcaseWebpackResolve
 * @property {Record<string, string>} alias - Module alias map.
 * @property {string[]} modules - Module resolution directories.
 */

/**
 * @typedef {object} ShowcaseWebpackConfig
 * @property {ShowcaseWebpackResolve} resolve - Webpack resolution config.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@showcase/migrated-charts"],
  // The benchmarks page was /charts/overview, then /charts/performance.
  redirects: async () => [
    { source: "/charts/overview", destination: "/charts/benchmarks", permanent: true },
    { source: "/charts/performance", destination: "/charts/benchmarks", permanent: true },
  ],
  turbopack: {
    resolveAlias: {
      "@showcase/bklit-charts": "./packages/bklit-charts/index.ts",
    },
  },
  /**
   * @param {ShowcaseWebpackConfig} config - Existing webpack config.
   * @returns {ShowcaseWebpackConfig} Amended webpack config.
   */
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@showcase/bklit-charts": path.resolve(
        showcaseRoot,
        "./packages/bklit-charts/index.ts"
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
