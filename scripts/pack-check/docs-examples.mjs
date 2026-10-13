// Pulls every ```tsx fence out of the README, docs and skills, so the pack-check can typecheck them against the packed tarball.
// Each fence is one standalone module (its own imports and data). A fence that must not be checked is written ```tsx skip.
//
//   node docs-examples.mjs <out-dir> <package-name> <markdown file or folder>...         extract + write tsconfig.docs.json
//   node docs-examples.mjs --local                                                      extract from showcase/migrated and typecheck against its source
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrated = path.resolve(here, "../../showcase/migrated");

const markdownFiles = (target) => {
  if (statSync(target).isFile()) return target.endsWith(".md") ? [target] : [];
  return readdirSync(target).flatMap((entry) => markdownFiles(path.join(target, entry)));
};

const extract = (outDir, pkgName, sources, root) => {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const file of sources.flatMap(markdownFiles)) {
    const text = readFileSync(file, "utf8");
    const stem = path.relative(root, file).replace(/\.md$/, "").replace(/[^\w]+/g, "-");
    let index = 0;
    for (const match of text.matchAll(/^```tsx([^\n]*)\n([\s\S]*?)^```/gm)) {
      if (/\bskip\b/.test(match[1])) continue;
      index += 1;
      const line = text.slice(0, match.index).split("\n").length;
      const name = `${stem}-${index}.tsx`;
      const body = match[2].replaceAll("bklit-tanstack-charts", pkgName);
      writeFileSync(path.join(outDir, name), `// ${path.relative(root, file)}:${line}\n${body}`);
      written.push(name);
    }
  }
  return written;
};

const tsconfig = (files, extra = {}) => ({
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2023", "DOM"],
    module: "ESNext",
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    ...extra,
  },
  files,
});

const [first, ...rest] = process.argv.slice(2);
if (first === "--local") {
  const out = mkdtempSync(path.join(os.tmpdir(), "docs-examples-"));
  const files = extract(out, "bklit-tanstack-charts", [path.join(migrated, "README.md"), path.join(migrated, "docs"), path.join(migrated, "skills")].filter((p) => { try { statSync(p); return true; } catch { return false; } }), migrated);
  writeFileSync(
    path.join(out, "tsconfig.json"),
    JSON.stringify(
      tsconfig(files, { skipLibCheck: true, types: ["react", "react-dom"], typeRoots: [path.join(migrated, "node_modules/@types"), path.join(migrated, "../node_modules/@types")], baseUrl: ".", paths: { "bklit-tanstack-charts": [path.join(migrated, "charts/index.ts")], "bklit-tanstack-charts/styles.css": [path.join(migrated, "charts/styles.css")], "*": [path.join(migrated, "node_modules/*"), path.join(migrated, "node_modules/@types/*"), path.join(migrated, "../node_modules/@types/*"), path.join(migrated, "../node_modules/*")] } }),
      null,
      2,
    ),
  );
  console.log(`${files.length} examples in ${out}`);
  try {
    execFileSync(path.join(migrated, "node_modules/.bin/tsc"), ["-p", path.join(out, "tsconfig.json")], { stdio: "inherit" });
    console.log("docs examples typecheck: OK");
  } catch {
    process.exitCode = 1;
  }
} else {
  const outDir = first;
  const [pkgName, ...sources] = rest;
  const files = extract(outDir, pkgName, sources, path.dirname(sources[0]));
  writeFileSync(path.join(outDir, "tsconfig.docs.json"), JSON.stringify(tsconfig(files), null, 2));
  console.log(`    ${files.length} examples extracted`);
  if (!files.length) process.exitCode = 1;
}
