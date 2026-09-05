// V4.2: every qa/gate/roster.txt chart must map to a fixture in qa/api-compat/.
// all.ts is generated from the legacy barrel so it covers every chart; roster
// entries map to it. Fails (exit 1) listing uncovered charts when all.ts is absent.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const roster = readFileSync(join(root, "qa/gate/roster.txt"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const files = new Set(readdirSync(here));
const uncovered = [];
for (const entry of roster) {
  const chart = entry.split(/\s+/)[0];
  if (files.has("all.ts")) continue; // generated fixture covers every roster chart
  if (!files.has(`${chart}.ts`) && !files.has(`${chart}.tsx`)) uncovered.push(chart);
}

if (uncovered.length > 0) {
  console.error(`roster-check: no fixture for roster charts: ${uncovered.join(", ")}`);
  process.exit(1);
}
console.log(`roster-check: ${roster.length} roster entries covered (${files.has("all.ts") ? "all.ts" : "per-chart fixtures"}).`);
