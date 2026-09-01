#!/usr/bin/env node
// Reach-in guard (Phase 6, D418 / 6.5 gate).
//
// Greps `showcase/migrated/**/*.{ts,tsx}` for JS/TS that addresses the
// @tanstack/charts renderer DOM — the census patterns from
// research/phase-6/08-reach-in-census.md:
//   querySelector(All)?(  ·  ts-chart__ / ts-sankey__ literals  ·  data-ts-key
//   · elementMap (the pie-hover-chrome route the census flagged as grep-invisible)
// Comments are stripped before matching; `className:` role opt-ins on authored
// scene nodes are excluded (see isRoleOptIn, D467); styles.css is a sanctioned CSS surface
// and is out of scope by construction (only .ts/.tsx are scanned).
//
// The ledger (scripts/reach-in-ledger.json) is a RATCHET, not an allowlist:
// every file with surviving sites is named with its pinned maximum and the
// D-entry that accepted it. The guard fails when
//   (a) any file NOT in the ledger has a hit, or
//   (b) a ledgered file exceeds its pinned maximum.
// A ledgered file that drops below its pin is reported so the pin can be
// lowered (do it in the same commit). Raising a pin or adding a file requires
// a new D-entry in docs/phase-6/LOG.md — there is no --update flag on purpose.
//
// Usage:  node scripts/reach-in-guard.mjs [--report] [--json]
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

// Comment stripper that respects string / template literals so `//` inside a
// string (e.g. a URL) survives and `/* */` inside a string is not eaten.
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
      // keep newlines so line numbers stay stable
      out += src.slice(i, stop).replace(/[^\n]/g, "");
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

// A `className: "ts-chart__bar-y"` on an authored scene node is NOT a DOM
// reach-in: native motion resolves choreography roles by class substring
// (dist/motion.js markMotionRole: includes("ts-chart__bar") etc.), so the
// class is the library's own role-opt-in contract (D467). Only lines that
// also query the DOM keep counting.
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
