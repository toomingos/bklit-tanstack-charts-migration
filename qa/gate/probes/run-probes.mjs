// Behavioural probes against one vite preview of bench/app/dist; writes probes.json + probes.md to the run dir and latest.
//   pnpm gate:probes [-- --only hover-lag,legend-hover-dim,bardepth-toggle,no-rereveal --repeats 3 --run-dir <dir> --no-build]
import { writeFileSync } from "node:fs";
import path from "node:path";
import { QA_PORT, ROOT, RUNS_DIR, acquireQaLock, buildDistOnce, ensureDir, fmtMs, log, mdTable, nowStamp, parseArgs, publishLatest, relPath, startPreview, waitForQuietProcessTable, writeJson } from "../lib.mjs";
import { launchBrowser } from "./lib-probe.mjs";
import { hoverLagProbe } from "./hover-lag.mjs";
import { legendHoverDimProbe } from "./legend-hover-dim.mjs";
import { barDepthToggleProbe } from "./bardepth-toggle.mjs";
import { noReRevealProbe } from "./no-rereveal.mjs";

const TAG = "[gate:probes]";
const ALL = ["hover-lag", "legend-hover-dim", "bardepth-toggle", "no-rereveal"];

export function probesToMd(p) {
  const out = ["# Gate probes", "", `Generated ${p.generatedAt}. Wall-clock ${fmtMs(p.wallClockMs)}. Probes: ${p.ran.join(", ")}.`, ""];
  const h = p.results["hover-lag"];
  if (h) {
    out.push("## hover-lag (ms from first pointermove; medians of repeats)", "", `Virtual-ms tail threshold ${h.virtualTailThresholdMs} ms (animation-design time, NOT the gate's wall-clock capture -- D622). Flags: ${h.flagged.length}.`, "");
    out.push(mdTable(["chart", "n", "bklit dim/tip/last", "migrated dim/tip/last", "bklit dimmed", "migrated dimmed", "flags"], h.pairs.map((x) => [x.chart, x.n, `${x.bklit.dim ?? "—"}/${x.bklit.tip ?? "—"}/${x.bklit.last ?? "—"}`, `${x.migrated.dim ?? "—"}/${x.migrated.tip ?? "—"}/${x.migrated.last ?? "—"}`, x.bklit.finalDim ?? "—", x.migrated.finalDim ?? "—", x.flags.join("; ")])), "");
  }
  const l = p.results["legend-hover-dim"];
  if (l) {
    out.push("## legend-hover-dim (__qaSetLegendHover)", "", `Flags: ${l.flagged.length}.`, "");
    out.push(mdTable(["chart", "n", "item", "bklit dimmed (before→after, ms)", "migrated dimmed (before→after, ms)", "undim ok", "flags"], l.pairs.flatMap((x) => x.bklit.map((bi, k) => { const mi = x.migrated[k] ?? {}; return [x.chart, x.n, bi.item, `${bi.dimmedBefore}→${bi.dimmedAfter} (${bi.dimMs ?? "—"})`, `${mi.dimmedBefore}→${mi.dimmedAfter} (${mi.dimMs ?? "—"})`, `${bi.undimmedTo === bi.dimmedBefore ? "y" : "n"}/${mi.undimmedTo === mi.dimmedBefore ? "y" : "n"}`, k === 0 ? x.flags.join("; ") : ""]; }))), "");
  }
  const b = p.results["bardepth-toggle"];
  if (b) {
    out.push("## bardepth-toggle (__qaSetBarDepthEnabled)", "", `Flags: ${b.flags.length ? b.flags.join("; ") : "none"}.`, "");
    out.push(mdTable(["impl", "hooks", "elements off/on", "settle off/on/off (ms)", "off→on moved/opacity", "off→off-again moved"], b.rows.map((r) => [r.impl, Object.entries(r.hooks).filter(([, v]) => v).map(([k]) => k).join(","), `${r.offCount}/${r.onCount}`, `${r.offSettleMs}/${r.onSettleMs}/${r.offAgainSettleMs}`, `${r.offVsOn.moved}/${r.offVsOn.opacityChanged}`, r.offVsOffAgain.moved])), "");
  }
  const n = p.results["no-rereveal"];
  if (n) {
    out.push("## no-rereveal (samples at +100/+400/+900 ms after a prop toggle)", "", `Flagged rows: ${n.flagged.length}.`, "");
    out.push(mdTable(["chart", "impl", "toggle", "moved 100→400", "moved 400→900", "opacity chg 400→900", "low-opacity @100/@900", "re-reveal?"], n.rows.map((r) => [r.chart, r.impl, r.toggle, r.d100_400.moved, r.d400_900.moved, r.d400_900.opacityChanged, `${r.lowOpacityAt100}/${r.lowOpacityAt900}`, r.reRevealSuspected ? "**suspected**" : "no"])), "");
  }
  return out.join("\n");
}

export async function runProbes(opts = {}) {
  const runDir = ensureDir(opts.runDir ?? path.join(RUNS_DIR, nowStamp()));
  const logDir = ensureDir(path.join(runDir, "logs"));
  const only = opts.only ? String(opts.only).split(",") : ALL;
  const releaseLock = await acquireQaLock(TAG);
  const t0 = Date.now();
  let preview;
  const results = {};
  const errors = {};
  try {
    await waitForQuietProcessTable(TAG, { abort: !!opts.noWait });
    await buildDistOnce(TAG, { skip: !!opts.noBuild, logFile: path.join(logDir, "build.log") });
    preview = await startPreview(TAG, opts.port ?? QA_PORT, { logFile: path.join(logDir, "probes-preview.log"), reuse: !!opts.reuseServer });
    const browser = await launchBrowser();
    try {
      for (const name of only) {
        const t1 = Date.now();
        log(TAG, `probe ${name} ...`);
        try {
          if (name === "hover-lag") results[name] = await hoverLagProbe(browser, preview.url, { repeats: opts.repeats ?? 3 });
          else if (name === "legend-hover-dim") results[name] = await legendHoverDimProbe(browser, preview.url);
          else if (name === "bardepth-toggle") results[name] = await barDepthToggleProbe(browser, preview.url);
          else if (name === "no-rereveal") results[name] = await noReRevealProbe(browser, preview.url);
          else throw new Error(`unknown probe ${name}`);
          results[name].durationMs = Date.now() - t1;
          const f = results[name].flagged ?? results[name].flags ?? [];
          log(TAG, `probe ${name} done in ${fmtMs(Date.now() - t1)} — ${f.length} flag(s)`);
        } catch (e) {
          errors[name] = String(e && e.stack ? e.stack : e);
          log(TAG, `probe ${name} FAILED: ${e.message ?? e}`);
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (preview) await preview.stop();
    releaseLock();
  }
  const probes = { generatedAt: new Date().toISOString(), runDir: relPath(runDir), wallClockMs: Date.now() - t0, ran: only, errors, summary: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, (v.flagged ?? v.flags ?? []).length])), results };
  writeJson(path.join(runDir, "probes.json"), probes);
  writeFileSync(path.join(runDir, "probes.md"), probesToMd(probes));
  publishLatest([path.join(runDir, "probes.json"), path.join(runDir, "probes.md")]);
  log(TAG, `summary ${JSON.stringify(probes.summary)} errors=${Object.keys(errors).length} -> ${relPath(runDir)}/probes.{json,md}`);
  return probes;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, "qa", "gate", "probes", "run-probes.mjs");
if (isMain) {
  const a = parseArgs(process.argv.slice(2), { only: "string", repeats: "number", "run-dir": "string", "no-build": "bool", "no-wait": "bool", "reuse-server": "bool", port: "number" });
  runProbes({ only: a.only, repeats: a.repeats, runDir: a["run-dir"], noBuild: a["no-build"], noWait: a["no-wait"], reuseServer: a["reuse-server"], port: a.port })
    .then((p) => process.exit(Object.keys(p.errors).length ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
