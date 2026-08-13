import fs from "node:fs";
import path from "path";

const showcaseRoot = import.meta.dirname;

function aliasesFromExports(pkgJsonPath, packageName, pkgDir) {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  const out = [];
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    const find = subpath === "." ? packageName : `${packageName}/${subpath.slice(2)}`;
    const clean = target.replace(/^\.\//, "");
    out.push([find, `${pkgDir}/${clean}`]);
  }
  out.sort((a, b) => b[0].length - a[0].length);
  return out;
}

const tanstackAliases = [
  ...aliasesFromExports(
    path.join(showcaseRoot, "repos/tanstack-charts/packages/charts-core/package.json"),
    "@tanstack/charts",
    "repos/tanstack-charts/packages/charts-core"
  ),
  ...aliasesFromExports(
    path.join(showcaseRoot, "repos/tanstack-charts/packages/react-charts/package.json"),
    "@tanstack/react-charts",
    "repos/tanstack-charts/packages/react-charts"
  ),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  turbopack: {
    resolveAlias: {
      "@showcase/bklit-charts": "./packages/bklit-charts/index.ts",
      "@showcase/migrated-charts": "./migrated/charts/index.ts",
      ...Object.fromEntries(tanstackAliases),
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
      ...Object.fromEntries(
        tanstackAliases.map(([find, rel]) => [find, path.resolve(showcaseRoot, rel)])
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
