// Server-render check: renders every showcase demo with the migrated charts through react-dom/server and fails on any throw.
// Every demo must produce an <svg class="ts-chart"> except the shell-only demos listed in CLIENT_ONLY
// (they must still render without throwing). Loading modes are rendered too, for throws only.
//
//   cd showcase && pnpm ssr-check
//
// No bundler: a sync module hook (Node >= 22.15) strips TypeScript with the showcase's own `typescript`, resolves the `@/` alias,
// and turns .css imports into empty modules. Nothing from a browser (document, window, rAF) is stubbed, so a stray DOM access on
// the server fails here.
import { createRequire, registerHooks } from "node:module";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SHOWCASE = resolve(dirname(fileURLToPath(import.meta.url)), "../../showcase");
const DEMOS = resolve(SHOWCASE, "components/demos");
const req = createRequire(resolve(SHOWCASE, "package.json"));
const ts = req("typescript");
const React = req("react");
const { renderToString } = req("react-dom/server");

// Render an empty shell on the server by design: heatmap, liveline, pie, radar and ring are client-only families; segment and
// composition hold a `useChart()` consumer child, and the chart waits for the client to settle such children (kit/stable-children.tsx).
const CLIENT_ONLY = new Set(["composition", "heatmap", "liveline", "pie", "radar", "ring", "segment"]);
const MODES = [
  ["default", { loading: "off", sweep: false, pulse: false }],
  ["status", { loading: "status", sweep: false, pulse: false }],
  ["component", { loading: "component", sweep: false, pulse: false }],
];
const EXTENSIONS = [".ts", ".tsx", ".js", "/index.ts", "/index.tsx"];

const isFile = (path) => existsSync(path) && statSync(path).isFile();
const withExtension = (base) => (isFile(base) ? base : EXTENSIONS.map((ext) => base + ext).find(isFile));

registerHooks({
  resolve(specifier, context, next) {
    let base;
    if (specifier.startsWith("@/")) {
      base = resolve(SHOWCASE, specifier.slice(2));
    } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      base = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    } else if (specifier.startsWith("/")) {
      base = specifier;
    }
    const found = base === undefined ? undefined : withExtension(base);
    return found === undefined ? next(specifier, context) : { url: pathToFileURL(found).href, shortCircuit: true };
  },
  load(url, context, next) {
    if (url.endsWith(".css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    if (url.endsWith(".json") && url.startsWith("file:")) {
      return { format: "module", source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`, shortCircuit: true };
    }
    if (/\.tsx?$/u.test(url) && !url.includes("/node_modules/")) {
      const source = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        fileName: fileURLToPath(url),
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return next(url, context);
  },
});

const charts = await import(pathToFileURL(resolve(SHOWCASE, "migrated/charts/index.ts")).href);
const names = readdirSync(DEMOS)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => file.slice(0, -4))
  .sort();

let failures = 0;
let checked = 0;
for (const name of names) {
  const demo = (await import(pathToFileURL(resolve(DEMOS, `${name}.tsx`)).href)).default;
  if (typeof demo !== "function") {
    continue;
  }
  for (const [mode, controls] of MODES) {
    const label = `${name.padEnd(15)} ${mode.padEnd(10)}`;
    try {
      const html = renderToString(React.createElement(demo, { impl: "migrated", charts, n: 50, controls }));
      const hasChart = /<svg[^>]*class="[^"]*\bts-chart\b/u.test(html);
      if (mode === "default" && !CLIENT_ONLY.has(name) && !hasChart) {
        failures += 1;
        console.log(`${label} FAIL no <svg class="ts-chart"> in ${html.length} chars`);
      } else {
        console.log(`${label} ok   ${CLIENT_ONLY.has(name) ? "client-only shell" : hasChart ? "svg.ts-chart" : "loading"}`);
      }
    } catch (error) {
      failures += 1;
      console.log(`${label} FAIL throw: ${error instanceof Error ? error.stack?.split("\n").slice(0, 4).join(" | ") : error}`);
    }
    checked += 1;
  }
}
console.log(`\nssr-check: ${checked} renders, ${failures} failure${failures === 1 ? "" : "s"}`);
process.exit(failures === 0 && checked > 0 ? 0 : 1);
