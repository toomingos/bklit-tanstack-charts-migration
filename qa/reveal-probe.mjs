// Deterministic sankey reveal probe.
// Loads bench/app scenarios for bklit + migrated sankey (n=33) with an
// init-script recorder installed BEFORE any page script runs, so the entire
// entrance animation is captured from frame 0.
//
// Records per animation frame, for every link path:
//   - computed stroke-dasharray / stroke-dashoffset
//   - getTotalLength()
//   - computed stroke-width
// plus every Element.prototype.animate() call (keyframes + options),
// plus the svg viewBox / client size each frame.
//
// Usage: node reveal-probe.mjs            (server must be on :5198)

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:5198";
const OUT = "/private/tmp/claude-501/-Users-tomasdomingos-bklit-tanstack-charts-migration/deaec1e1-ea95-4fad-9508-0df9bebffdfb/scratchpad/probe-out/";
const VIEWPORT = { width: 1200, height: 800 };
const SAMPLE_MS = 2600;

mkdirSync(OUT, { recursive: true });

const recorder = () => {
  window.__rec = { anims: [], frames: [], t0: 0, mountT: null };
  const origAnimate = Element.prototype.animate;
  Element.prototype.animate = function (kf, opt) {
    try {
      window.__rec.anims.push({
        t: Math.round(performance.now() - window.__rec.t0),
        tag: this.tagName,
        cls: this.getAttribute && this.getAttribute("class"),
        key: this.getAttribute && this.getAttribute("data-ts-key"),
        kf: JSON.parse(JSON.stringify(kf)),
        opt: JSON.parse(JSON.stringify(opt || {})),
      });
    } catch (_) {}
    return origAnimate.call(this, kf, opt);
  };

  const linkPaths = () => {
    const svg = document.querySelector("svg");
    if (!svg) return { svg: null, paths: [] };
    const paths = [...svg.querySelectorAll("path")].filter((p) => {
      const cs = getComputedStyle(p);
      return cs.fill === "none" && parseFloat(cs.strokeWidth) > 0;
    });
    return { svg, paths };
  };

  window.__rec.t0 = performance.now();
  const tick = () => {
    const t = Math.round(performance.now() - window.__rec.t0);
    const { svg, paths } = linkPaths();
    if (svg && paths.length) {
      if (window.__rec.mountT === null) window.__rec.mountT = t;
      const r = svg.getBoundingClientRect();
      const rows = paths.map((p) => {
        const cs = getComputedStyle(p);
        let L = 0;
        try {
          L = p.getTotalLength();
        } catch (_) {}
        const da = cs.strokeDasharray;
        const off = parseFloat(cs.strokeDashoffset || "0") || 0;
        // first dash segment length (px) if any
        const first = da && da !== "none" ? parseFloat(da) : NaN;
        return {
          L: +L.toFixed(1),
          da: da === "none" ? null : +(+first).toFixed(1),
          off: +off.toFixed(1),
          sw: +parseFloat(cs.strokeWidth).toFixed(2),
        };
      });
      window.__rec.frames.push({
        t,
        vb: svg.getAttribute("viewBox"),
        cw: +r.width.toFixed(1),
        ch: +r.height.toFixed(1),
        n: rows.length,
        rows,
      });
    }
    if (t < 2600) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function probe(impl) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await ctx.addInitScript(recorder);
  const page = await ctx.newPage();
  const url = `${BASE}/?impl=${impl}&chart=sankey&n=33&scenario=mount`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(SAMPLE_MS + 400);
  const rec = await page.evaluate(() => window.__rec);
  await browser.close();
  return rec;
}

function summarize(impl, rec) {
  const f = rec.frames;
  const lines = [];
  lines.push(`### ${impl}`);
  lines.push(`first frame with links: t=${rec.mountT}ms, frames=${f.length}, animate() calls=${rec.anims.length}`);
  if (!f.length) return lines.join("\n");
  const last = f[f.length - 1];
  lines.push(`viewBox=${last.vb} clientSize=${last.cw}x${last.ch} links=${last.n}`);
  lines.push(`settled stroke-widths: min=${Math.min(...last.rows.map((r) => r.sw))} max=${Math.max(...last.rows.map((r) => r.sw))} sum=${last.rows.reduce((a, b) => a + b.sw, 0).toFixed(1)}`);
  // progress of a few links over time: visible fraction = 1 - off/L
  const pick = [0, 8, 16, 32].filter((i) => i < last.n);
  lines.push("");
  lines.push("t(ms) | " + pick.map((i) => `link${i}: L / dash / off / vis%`).join(" | "));
  const step = Math.max(1, Math.floor(f.length / 22));
  for (let i = 0; i < f.length; i += step) {
    const fr = f[i];
    const cells = pick.map((k) => {
      const r = fr.rows[k];
      if (!r) return "-";
      const vis = r.da == null ? 100 : Math.max(0, Math.min(100, Math.round((1 - r.off / (r.L || 1)) * 100)));
      return `${r.L} / ${r.da ?? "none"} / ${r.off} / ${vis}%`;
    });
    lines.push(`${String(fr.t).padStart(5)} | ` + cells.join(" | "));
  }
  // dash-vs-length mismatch check
  const bad = [];
  for (const fr of f) {
    for (let i = 0; i < fr.rows.length; i++) {
      const r = fr.rows[i];
      if (r.da != null && r.L > 1 && Math.abs(r.da - r.L) / r.L > 0.02) {
        bad.push({ t: fr.t, i, da: r.da, L: r.L });
      }
    }
  }
  lines.push("");
  lines.push(`dasharray != pathLength occurrences: ${bad.length}` + (bad.length ? ` e.g. ${JSON.stringify(bad.slice(0, 6))}` : ""));
  // animate() call summary
  const byShape = {};
  for (const a of rec.anims) {
    const props = Array.isArray(a.kf) ? [...new Set(a.kf.flatMap((k) => Object.keys(k)))].sort().join("+") : Object.keys(a.kf).join("+");
    const k = `${a.tag}[${a.cls || a.key || ""}] {${props}} dur=${a.opt.duration} ease=${a.opt.easing}`;
    byShape[k] = (byShape[k] || 0) + 1;
  }
  lines.push("");
  lines.push("animate() call shapes:");
  for (const [k, v] of Object.entries(byShape)) lines.push(`  ${v}x  ${k}`);
  const delays = rec.anims.map((a) => a.opt.delay).filter((d) => typeof d === "number");
  if (delays.length) lines.push(`  delays: min=${Math.min(...delays).toFixed(1)} max=${Math.max(...delays).toFixed(1)}`);
  return lines.join("\n");
}

const out = [];
for (const impl of ["bklit", "migrated"]) {
  const rec = await probe(impl);
  writeFileSync(`${OUT}${impl}.json`, JSON.stringify(rec));
  out.push(summarize(impl, rec));
}
const report = out.join("\n\n");
writeFileSync(`${OUT}report.txt`, report);
console.log(report);
