#!/usr/bin/env node
// Reach-in guard: greps showcase/migrated/**/*.ts(x) for renderer-DOM reach-ins (querySelector, ts-chart__/ts-sankey__, data-ts-key, elementMap).
// Comments are stripped before matching; className role opt-ins and styles.css are out of scope by construction.
// GUARD: the ledger is a RATCHET (pinned max + ruling per file); unlisted hits or over-pin fail, under-pin lowers the pin.
// Raising a pin or adding a file needs a D-entry; no --update flag by design. Usage: node scripts/reach-in-guard.mjs [--report] [--json]
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOT = path.join(ROOT, "showcase", "migrated");
const LEDGER_PATH = path.join(ROOT, "scripts", "reach-in-ledger.json");
const PATTERN = /querySelector(?:All)?\s*\(|data-ts-key|ts-chart__|ts-sankey__|\belementMap\b/g;

const args = new Set(process.argv.slice(2));
const REPORT = args.has("--report");
const JSON_OUT = args.has("--json");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === ".next") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

// Stripping respects string/template literals so // or /* */ inside strings (e.g. URLs) survive.
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ""); // keep newlines so line numbers stay stable
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += c;
      i++;
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] ?? ""); i += 2; continue; }
        if (q === "`" && src[i] === "$" && src[i + 1] === "{") {
          // template expression: copy through the matching brace (nesting-aware)
          let depth = 0;
          do {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            out += src[i++];
          } while (i < n && depth > 0);
          continue;
        }
        out += src[i++];
      }
      out += src[i] ?? "";
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// className ts-chart__* without a querySelector is the native-motion role-opt-in contract, not a reach-in.
function isRoleOptIn(line) {
  return /className\s*[:=(]/.test(line) && !/querySelector/.test(line);
}

const hits = new Map(); // rel file -> [{line, text}]
for (const file of walk(SCAN_ROOT)) {
  const rel = path.relative(ROOT, file);
  const lines = stripComments(readFileSync(file, "utf8")).split("\n");
  const raw = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, idx) => {
    PATTERN.lastIndex = 0;
    if (PATTERN.test(line) && !isRoleOptIn(line)) {
      if (!hits.has(rel)) hits.set(rel, []);
      hits.get(rel).push({ line: idx + 1, text: raw[idx].trim() });
    }
  });
}

let ledger = {};
try {
  ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8")).files ?? {};
} catch (e) {
  console.error(`[reach-in-guard] cannot read ledger at ${LEDGER_PATH}: ${e.message}`);
  process.exit(2);
}

const failures = [];
const notes = [];
let total = 0;
for (const [file, sites] of [...hits].sort()) {
  total += sites.length;
  const entry = ledger[file];
  if (!entry) failures.push(`${file}: ${sites.length} site(s) — file is not in the ledger`);
  else if (sites.length > entry.max) failures.push(`${file}: ${sites.length} site(s) > pinned max ${entry.max} (${entry.ruling})`);
  else if (sites.length < entry.max) notes.push(`${file}: ${sites.length} site(s) < pinned max ${entry.max} — lower the pin`);
}
for (const file of Object.keys(ledger)) {
  if (!hits.has(file)) notes.push(`${file}: 0 sites — remove from ledger`);
}

if (JSON_OUT) {
  const counts = Object.fromEntries([...hits].sort().map(([f, s]) => [f, s.length]));
  console.log(JSON.stringify({ total, files: hits.size, counts, failures, notes }, null, 2));
} else {
  if (REPORT) {
    for (const [file, sites] of [...hits].sort()) {
      console.log(`\n${file} (${sites.length})`);
      for (const s of sites) console.log(`  :${s.line}  ${s.text.slice(0, 140)}`);
    }
    console.log("");
  }
  console.log(`[reach-in-guard] ${total} site(s) in ${hits.size} file(s); ledger pins ${Object.keys(ledger).length} file(s)`);
  for (const n of notes) console.log(`[reach-in-guard] note: ${n}`);
  for (const f of failures) console.error(`[reach-in-guard] FAIL: ${f}`);
  console.log(failures.length ? "[reach-in-guard] FAILED" : "[reach-in-guard] OK — no sites outside the ledger, no pin exceeded");
}
process.exit(failures.length ? 1 : 0);
