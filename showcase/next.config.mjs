import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@showcase/bklit-charts": path.resolve(
        import.meta.dirname,
        "./packages/bklit-charts/index.ts"
      ),
      "@showcase/migrated-charts": path.resolve(
        import.meta.dirname,
        "./packages/migrated-charts/index.ts"
      ),
    };
    // When webpack resolves imports from within repos/bklit-ui/ or repos/tanstack-charts/,
    // we need it to also check showcase/node_modules for deps like motion, @visx/*, etc.
    config.resolve.modules = [
      path.resolve(import.meta.dirname, "node_modules"),
      ...config.resolve.modules,
    ];
    return config;
  },
};

export default nextConfig;
