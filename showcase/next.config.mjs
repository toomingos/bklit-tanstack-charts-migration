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
        "../migrated/charts/index.ts"
      ),
    };
    return config;
  },
};

export default nextConfig;
