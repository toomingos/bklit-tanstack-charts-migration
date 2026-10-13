// Static checks on an extracted package tarball (the `package/` folder npm pack produces).
// Usage: node check-tarball.mjs <extracted-package-dir>
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const results = [];
const check = (name, problems, level = "FAIL") => results.push({ name, problems, level });

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [path.relative(root, full)];
  });
const files = walk(root);

const isDts = (f) => /\.d\.[cm]?ts$/.test(f);
const isTsSource = (f) => /\.(c|m)?tsx?$/.test(f) && !isDts(f);
const isCode = (f) => /\.(c|m)?[jt]sx?$/.test(f);

check("publishable (not private)", pkg.private ? ['"private": true'] : []);

check(
  "ships compiled JS, not TS source",
  files.filter(isTsSource).length ? [`${files.filter(isTsSource).length} .ts/.tsx source files, e.g. ${files.find(isTsSource)}`] : [],
);

// Every export target must exist and resolve to compiled output.
const targets = [];
const collect = (value, key) => {
  if (typeof value === "string") targets.push({ key, target: value });
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) collect(v, key ?? k);
};
collect(pkg.exports);
check(
  "exports resolve to compiled files",
  targets.flatMap(({ key, target }) => {
    if (target.includes("*")) return [];
    const file = path.join(root, target);
    if (!existsSync(file)) return [`${key} -> ${target} (missing)`];
    return isTsSource(target) ? [`${key} -> ${target} (TS source)`] : [];
  }),
);

// Modules the entry re-exports from are the client boundaries an RSC host sees (Next App Router, Start RSC). One that touches React
// (hooks, context) or builds a carrier component must start with "use client", or a Server Component importing it breaks.
const hasDirective = (file) =>
  /^["']use client["']/.test(readFileSync(file, "utf8").replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, ""));
const reactImport = /from\s*["'](react|react-dom|@tanstack\/react-charts[^"']*|@number-flow\/react|@base-ui\/react[^"']*)["']/;
const clientApi = /\buse[A-Z]\w*\(|\bcreateContext\(|\bdefineCarrier\(/;
const needsClient = (code) => clientApi.test(code) && (reactImport.test(code) || /\bdefineCarrier\(/.test(code));
const boundaryProblems = [];
for (const { key, target } of targets) {
  const entry = path.join(root, target);
  if (!isCode(target) || isDts(target) || !existsSync(entry)) continue;
  const source = readFileSync(entry, "utf8");
  for (const match of source.matchAll(/from\s*["'](\.[^"']+)["']/g)) {
    const file = path.resolve(path.dirname(entry), match[1]);
    if (!existsSync(file) || !statSync(file).isFile() || !isCode(file)) continue;
    if (needsClient(readFileSync(file, "utf8")) && !hasDirective(file)) {
      boundaryProblems.push(`${key}: ${path.relative(root, file)}`);
    }
  }
}
check('entry-exported modules that use React start with "use client"', [...new Set(boundaryProblems)]);

// Every bare import in shipped code must be a declared dependency or peer.
const declared = new Set([
  pkg.name,
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
].flatMap((name) => (name.startsWith("@types/") ? [name, name.slice(7)] : [name])));
const builtins = new Set(builtinModules);
const undeclared = new Map();
const specifier = /(?:^|[^.\w])(?:import|export)\s*(?:[^'"]*?\sfrom\s*)?["']([^"'./][^"']*)["']|import\(\s*["']([^"'./][^"']*)["']\s*\)/g;
for (const file of files.filter(isCode)) {
  for (const match of readFileSync(path.join(root, file), "utf8").matchAll(specifier)) {
    const spec = match[1] ?? match[2];
    if (spec.startsWith("node:") || builtins.has(spec)) continue;
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    if (!declared.has(name) && !undeclared.has(name)) undeclared.set(name, file);
  }
}
check(
  "imports are declared dependencies",
  [...undeclared].map(([name, file]) => `${name} (first seen in ${file})`),
);

// The JS never imports CSS (Node under Vite SSR fails on .css imports from installed packages), so sideEffects can be false.
const cssImports = files
  .filter((f) => isCode(f) && !isDts(f))
  .filter((f) => /(?:^|\n)\s*(?:import|export)\s*(?:[^'"\n]*?\sfrom\s*)?["'][^"']+\.css["']|import\(\s*["'][^"']+\.css["']/.test(readFileSync(path.join(root, f), "utf8")));
check("JS imports no CSS", cssImports.map((f) => `${f} imports a .css file`));
check(
  "sideEffects",
  pkg.sideEffects === false && !cssImports.length
    ? []
    : Array.isArray(pkg.sideEffects) && pkg.sideEffects.some((p) => p.includes("css"))
      ? []
      : [`sideEffects is ${JSON.stringify(pkg.sideEffects)}; expected false (no JS imports CSS) or a list that keeps CSS`],
);
const stylesheets = targets.filter(({ target }) => target.endsWith(".css"));
check("stylesheet export exists", stylesheets.length === 1 ? [] : [`expected one CSS export, found ${stylesheets.length}`]);

const licenseFiles = files.filter((f) => /^(LICENSE|LICENCE|NOTICE)/i.test(f));
check("ships a LICENSE", licenseFiles.length ? [] : ["no LICENSE file"]);
check(
  "carries bklit-ui's MIT notice",
  licenseFiles.some((f) => /uixmat|bklit/i.test(readFileSync(path.join(root, f), "utf8"))) ? [] : ["no LICENSE/NOTICE mentions bklit-ui (MIT, uixmat)"],
);
check("ships a README", files.some((f) => /^readme/i.test(f)) ? [] : ["no README"]);

// TanStack Intent indexes packages with this keyword and skills/**/SKILL.md.
const skills = files.filter((f) => /^skills\/.+\/SKILL\.md$/.test(f));
check("TanStack Intent ready", [
  ...((pkg.keywords ?? []).includes("tanstack-intent") ? [] : ['keywords lacks "tanstack-intent"']),
  ...(skills.length ? [] : ["no skills/**/SKILL.md"]),
  ...skills.flatMap((f) => {
    const text = readFileSync(path.join(root, f), "utf8");
    const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const dir = f.split("/").slice(-2, -1)[0];
    const name = front.match(/^name:\s*['"]?([^'"\n]+)['"]?\s*$/m)?.[1];
    const description = front.match(/^description:\s*>?\s*\n?([\s\S]*?)(?=\n\S|$)/m)?.[1] ?? "";
    return [
      ...(name === dir ? [] : [`${f}: frontmatter name ${JSON.stringify(name)} must equal its directory "${dir}"`]),
      ...(description.trim() && description.length <= 1024 ? [] : [`${f}: description missing or over 1024 characters`]),
      ...(/^metadata:[\s\S]*\n\s+library_version:/m.test(front) ? [] : [`${f}: metadata.library_version missing`]),
      ...(text.split("\n").length <= 500 ? [] : [`${f}: over 500 lines`]),
    ];
  }),
]);

let failed = 0;
let warned = 0;
for (const { name, problems, level } of results) {
  if (!problems.length) {
    console.log(`  PASS  ${name}`);
    continue;
  }
  if (level === "WARN") warned += 1;
  else failed += 1;
  console.log(`  ${level}  ${name}`);
  for (const p of problems.slice(0, 40)) console.log(`          - ${p}`);
  if (problems.length > 40) console.log(`          - ... ${problems.length - 40} more`);
}
console.log(`  ${files.length} files, ${results.length - failed - warned}/${results.length} checks passed, ${warned} warning(s)`);
process.exit(failed ? 1 : 0);
