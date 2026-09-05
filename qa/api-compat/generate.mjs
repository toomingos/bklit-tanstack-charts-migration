// V4.2: parses the legacy barrel's `export` statements (values and types,
// including `export { a as b }` and `export type`) and writes the generated
// type-equality fixture `qa/api-compat/all.ts` plus `qa/api-compat/report.md`.
// Deterministic: no timestamps; barrel order preserved. Run: `pnpm api-compat:gen`.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const legacyBarrel = join(root, "repos/bklit-ui/packages/ui/src/charts/index.ts");
const migratedBarrel = join(root, "showcase/migrated/charts/index.ts");
const outFile = join(here, "all.ts");
const reportFile = join(here, "report.md");

// §2 family per legacy module (barrel `from` minus `./`); `tooltip` chrome is
// unlisted in §2 so it falls into "Other".
const FAMILY = {
  animation: "Animation and motion",
  "chart-reveal-clip": "Animation and motion",
  "indicator-fade": "Animation and motion",
  "chart-phase": "Animation and motion",
  area: "Area, line, live-line",
  "area-chart": "Area, line, live-line",
  "area-chart-loading": "Area, line, live-line",
  line: "Area, line, live-line",
  "line-chart": "Area, line, live-line",
  "line-chart-loading": "Area, line, live-line",
  "line-loading-pulse": "Area, line, live-line",
  "line-series-terminal-marker": "Area, line, live-line",
  "live-line": "Area, line, live-line",
  "live-line-chart": "Area, line, live-line",
  "live-x-axis": "Area, line, live-line",
  "live-y-axis": "Area, line, live-line",
  "profit-loss-line": "Area, line, live-line",
  "profit-loss-segments": "Area, line, live-line",
  bar: "Bar",
  "bar-chart": "Bar",
  "bar-chart-loading": "Bar",
  "bar-depth": "Bar",
  "bar-squares": "Bar",
  "bar-squares-layout": "Bar",
  "bar-x-axis": "Bar",
  "bar-y-axis": "Bar",
  candlestick: "Candlestick",
  "candlestick-chart": "Candlestick",
  "chart-brush": "Brush",
  "chart-brush-layout": "Brush",
  "chart-brush-selection-overlay": "Brush",
  "chart-brush-track-overlay": "Brush",
  "chart-context": "Context, providers, hooks",
  "chart-config-context": "Context, providers, hooks",
  "chart-child-passthrough": "Context, providers, hooks",
  "chart-scale": "Context, providers, hooks",
  "pie-context": "Context, providers, hooks",
  "radar-context": "Context, providers, hooks",
  "ring-context": "Context, providers, hooks",
  "sunburst-context": "Context, providers, hooks",
  "static-chart-preview-context": "Context, providers, hooks",
  "use-chart-interaction": "Context, providers, hooks",
  "use-animated-y-domains": "Context, providers, hooks",
  legend: "Legend",
  "chart-legend": "Legend",
  "chart-legend-hover": "Legend",
  "profit-loss-legend": "Legend",
  "profit-loss-legend-hover": "Legend",
  "chart-loading-label": "Loading and skeleton",
  "generate-chart-skeleton-data": "Loading and skeleton",
  "loading-sweep": "Loading and skeleton",
  "chart-center-typography": "Typography and CSS",
  "chart-stat-flow": "Typography and CSS",
  background: "Typography and CSS",
  grid: "Typography and CSS",
  "pattern-area": "Gradients and patterns",
  "pattern-preset": "Gradients and patterns",
  "visx-pattern": "Gradients and patterns",
  "@visx/gradient": "Gradients and patterns",
  "pie-chart": "Polar",
  "pie-center": "Polar",
  "pie-center-shell": "Polar",
  "pie-slice": "Polar",
  gauge: "Polar",
  "gauge-label-layout": "Polar",
  ring: "Polar",
  "ring-center": "Polar",
  "ring-chart": "Polar",
  "ring-context": "Polar",
  "radar-area": "Polar",
  "radar-axis": "Polar",
  "radar-chart": "Polar",
  "radar-context": "Polar",
  "radar-grid": "Polar",
  "radar-labels": "Polar",
  sunburst: "Polar",
  "sunburst-breadcrumb": "Polar",
  "sunburst-center": "Polar",
  "sunburst-chart": "Polar",
  "sunburst-context": "Polar",
  "sunburst-data": "Polar",
  "sunburst-hint": "Polar",
  "sunburst-labels": "Polar",
  "sunburst-segment": "Polar",
  choropleth: "Geo, network, heatmap",
  sankey: "Geo, network, heatmap",
  heatmap: "Geo, network, heatmap",
  "composed-chart": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "funnel-chart": "Composed, scatter, funnel, markers, projection, reference area, segments",
  markers: "Composed, scatter, funnel, markers, projection, reference area, segments",
  "projection-config": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "projection-line": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "projection-line-end-marker": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "projection-utils": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "reference-area": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "reference-area-geometry": "Composed, scatter, funnel, markers, projection, reference area, segments",
  segment: "Composed, scatter, funnel, markers, projection, reference area, segments",
  "series-bar": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "series-markers": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "series-point-marker": "Composed, scatter, funnel, markers, projection, reference area, segments",
  scatter: "Composed, scatter, funnel, markers, projection, reference area, segments",
  "scatter-chart": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "x-axis": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "y-axis": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "y-axis-scales": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "y-axis-ticks": "Composed, scatter, funnel, markers, projection, reference area, segments",
  "y-domain-utils": "Utilities",
};
const familyOf = (mod) => FAMILY[mod.replace(/^\.\//, "")] ?? "Other";

// Parse named re-exports; each entry keeps barrel order. Kind is `type` for
// `export type {…}` blocks and inline `type` specifiers, else `value`.
function parseBarrel(src) {
  const out = [];
  const re = /export\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const blockType = Boolean(m[1] && m[1].trim());
    for (const part of m[2].split(",")) {
      const s = part.trim();
      if (!s) continue;
      const spec = s.match(/^(type\s+)?([\w$]+)(\s+as\s+([\w$]+))?$/);
      if (!spec) throw new Error(`generate.mjs: cannot parse export specifier ${JSON.stringify(s)}`);
      out.push({ name: spec[4] ?? spec[2], kind: blockType || Boolean(spec[1]) ? "type" : "value", module: m[3] });
    }
  }
  return out;
}

const legacy = parseBarrel(readFileSync(legacyBarrel, "utf8"));
const migrated = existsSync(migratedBarrel) ? parseBarrel(readFileSync(migratedBarrel, "utf8")) : [];
const migratedNames = new Set(migrated.map((e) => `${e.kind}:${e.name}`));
const migratedModuleOf = new Map(migrated.map((e) => [`${e.kind}:${e.name}`, e.module]));

const values = legacy.filter((e) => e.kind === "value");
const types = legacy.filter((e) => e.kind === "type");

const lines = [
  "// GENERATED by qa/api-compat/generate.mjs — do not edit. Regenerate with `pnpm api-compat:gen`.",
  "// V4.2 type-equality fixture: one Eq<> per legacy barrel export (10-parity-contract §1).",
  "// Zero red lines = export parity; a missing or wrongly typed export fails `pnpm api-compat`.",
  'import * as Legacy from "@bklitui/ui/charts";',
  'import * as Migrated from "@migrated/charts";',
  "",
  "type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;",
  "declare function assert<T extends true>(): void;",
  "",
  `// values (${values.length})`,
];
const lineOf = new Map(); // all.ts line number -> export entry
for (const e of values) {
  lineOf.set(lines.length + 1, e);
  lines.push(`assert<Eq<typeof Legacy.${e.name}, typeof Migrated.${e.name}>>();`);
}
lines.push("", `// types (${types.length})`);
for (const e of types) {
  lineOf.set(lines.length + 1, e);
  lines.push(`assert<Eq<Legacy.${e.name}, Migrated.${e.name}>>();`);
}
lines.push("");
writeFileSync(outFile, `${lines.join("\n")}`);

// tsc pass over the new fixture; map all.ts errors back to exports by line.
let tscErrors = [];
try {
  execFileSync(join(root, "bench/app/node_modules/.bin/tsc"), ["--noEmit", "-p", join(here, "tsconfig.json")], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  const text = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
  for (const line of text.split("\n")) {
    const m = line.match(/all\.ts\((\d+),\d+\)\s*:\s*error\s+(TS\d+):\s*(.*)$/);
    if (m) tscErrors.push({ line: Number(m[1]), code: m[2], message: m[3].trim(), file: "all.ts" });
    else if (/error\s+TS\d+/.test(line)) tscErrors.push({ line: 0, code: "", message: line.trim(), file: "other" });
  }
}
const redLines = tscErrors.filter((e) => e.file === "all.ts");
const harnessNoise = tscErrors.filter((e) => e.file !== "all.ts");
const errorNames = new Map(); // name -> {kind, codes}
for (const err of redLines) {
  const e = lineOf.get(err.line);
  if (!e) continue;
  const prev = errorNames.get(e.name) ?? { kind: e.kind, codes: new Set() };
  prev.codes.add(err.code);
  errorNames.set(e.name, prev);
}

// (a) legacy exports that are absent from our barrel or fail Eq, by §2 family.
const byFamily = new Map();
for (const e of legacy) {
  const missing = !migratedNames.has(`${e.kind}:${e.name}`);
  const mismatched = errorNames.has(e.name) && !missing;
  if (!missing && !mismatched) continue;
  const fam = familyOf(e.module);
  if (!byFamily.has(fam)) byFamily.set(fam, []);
  byFamily.get(fam).push({ ...e, status: missing ? "missing" : `mismatch (${[...errorNames.get(e.name).codes].join(", ")})` });
}
// (b) migrated-only exports with source module: V1.6's un-export inventory.
const legacyNames = new Set(legacy.map((e) => `${e.kind}:${e.name}`));
const extra = migrated.filter((e) => !legacyNames.has(`${e.kind}:${e.name}`));

const report = [
  "# api-compat report (GENERATED by qa/api-compat/generate.mjs — do not edit)",
  "",
  `Legacy barrel: ${values.length} value exports, ${types.length} type exports.`,
  `Migrated barrel: ${migrated.filter((e) => e.kind === "value").length} value exports, ${migrated.filter((e) => e.kind === "type").length} type exports.`,
  tscErrors.length === 0
    ? "tsc (`pnpm api-compat`): 0 errors in all.ts — export parity."
    : `tsc (pnpm api-compat): ${redLines.length} red lines in all.ts across ${errorNames.size} exports — the measured V1.6 backlog.` +
      (harnessNoise.length > 0 ? ` (${harnessNoise.length} further error lines sit in showcase/repo sources, not in the fixture.)` : ""),
  "",
  "## (a) missing / mismatched legacy exports by 10 §2 family",
  "",
];
if (byFamily.size === 0) report.push("None — every legacy export typechecks equal.");
else
  for (const [fam, items] of [...byFamily.entries()].sort((a, b) => b[1].length - a[1].length)) {
    report.push(`### ${fam} (${items.length})`, "");
    for (const item of items) report.push(`- \`${item.name}\` (${item.kind}, \`${item.module}\`) — ${item.status}`);
    report.push("");
  }
report.push("## (b) migrated-only exports (V1.6 un-export inventory)", "");
if (extra.length === 0) report.push("None.");
else for (const e of extra) report.push(`- \`${e.name}\` (${e.kind}) — from \`${migratedModuleOf.get(`${e.kind}:${e.name}`)}\``);
report.push("");
writeFileSync(reportFile, `${report.join("\n")}`);

console.log(`generate.mjs: ${values.length} values, ${types.length} types -> all.ts; ${redLines.length} red lines in all.ts across ${errorNames.size} exports; report.md updated.`);
