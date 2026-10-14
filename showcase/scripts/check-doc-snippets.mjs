// Type-checks every code snippet in lib/chart-docs/*.ts against the package, as a consumer importing
// "bklit-tanstack-charts" would. Run from showcase/: `node scripts/check-doc-snippets.mjs [route ...]`.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "lib/chart-docs");
const out = join(root, ".doc-snippets");
const only = process.argv.slice(2);

const routes = readdirSync(docsDir)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts")
  .map((f) => f.slice(0, -3))
  .filter((r) => only.length === 0 || only.includes(r));

rmSync(out, { recursive: true, force: true });
mkdirSync(out);

for (const route of routes) {
  const { doc } = await import(pathToFileURL(join(docsDir, `${route}.ts`)).href);
  const snippets = [["code", doc.code], ["usage", doc.usage], ...(doc.examples ?? []).map((e, i) => [`example-${i + 1}`, e.code])];
  for (const [name, code] of snippets) writeFileSync(join(out, `${route}.${name}.tsx`), code);
}

writeFileSync(
  join(out, "tsconfig.json"),
  JSON.stringify({
    extends: "../tsconfig.json",
    compilerOptions: { paths: { "bklit-tanstack-charts": ["../migrated/charts/index.ts"] }, incremental: false, plugins: [] },
    include: ["*.tsx"],
    exclude: [],
  }),
);

try {
  execFileSync("npx", ["tsc", "--noEmit", "-p", out], { cwd: root, stdio: "inherit" });
  console.log(`ok: ${routes.length} pages`);
  rmSync(out, { recursive: true, force: true });
} catch {
  process.exitCode = 1;
}
