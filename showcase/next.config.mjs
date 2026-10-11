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
    // One async chunk for the code every migrated chart shares (TanStack, d3, kit): Next's default `shared` group splits it per module set into 11-16 requests per card.
    const split = config.optimization?.splitChunks;
    if (split && typeof split === "object") {
      split.cacheGroups = {
        ...split.cacheGroups,
        chartsLibs: {
          test: /[\\/]node_modules[\\/](@tanstack|d3-[^\\/]+|@number-flow)[\\/]/,
          name: "charts-libs",
          chunks: "async",
          priority: 50,
          enforce: true,
        },
        chartsCartesian: {
          test: /[\\/]migrated[\\/]charts[\\/]kit[\\/]cartesian[\\/]/,
          name: "charts-cartesian",
          chunks: "async",
          priority: 49,
          enforce: true,
        },
        chartsPolar: {
          test: /[\\/]migrated[\\/]charts[\\/]kit[\\/]polar[\\/]/,
          name: "charts-polar",
          chunks: "async",
          priority: 49,
          enforce: true,
        },
        chartsKit: {
          test: /[\\/]migrated[\\/]charts[\\/]kit[\\/]/,
          name: "charts-kit",
          chunks: "async",
          priority: 48,
          enforce: true,
        },
      };
    }
    return config;
  },
};

export default nextConfig;
