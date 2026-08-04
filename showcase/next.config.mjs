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
        "../packages/bklit-charts/index.ts"
      ),
      "@showcase/migrated-charts": path.resolve(
        import.meta.dirname,
        "../packages/migrated-charts/index.ts"
      ),
    };
    config.resolve.modules = [
      ...config.resolve.modules,
      path.resolve(import.meta.dirname, "../repos/bklit-ui/node_modules"),
      path.resolve(import.meta.dirname, "../repos/bklit-ui/packages/ui/node_modules"),
      path.resolve(import.meta.dirname, "../repos/tanstack-charts/node_modules"),
    ];
    return config;
  },
};

export default nextConfig;
