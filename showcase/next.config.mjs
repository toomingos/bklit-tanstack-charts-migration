import path from "path";

const showcaseRoot = import.meta.dirname;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
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
    // When webpack resolves imports from within repos/bklit-ui/ or repos/tanstack-charts/,
    // we need it to also check showcase/node_modules for deps like motion, @visx/*, etc.
    config.resolve.modules = [
      path.resolve(showcaseRoot, "node_modules"),
      ...config.resolve.modules,
    ];
    return config;
  },
};

export default nextConfig;
