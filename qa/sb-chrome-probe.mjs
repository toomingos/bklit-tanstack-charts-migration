// P5.5 Strand 3 gate (part 2) — sunburst breadcrumb + render-prop hint.
//
// WHY A DOM PROBE ON TOP OF THE PIXEL DIFF
// ----------------------------------------
// `qa/screenshot.mjs --chart sunchrome --n 27` already compares the two impls
// pixel-for-pixel, and it passes — but at the capture point the chart is at
// its ROOT focus, where the trail is a single crumb and the hint is showing
// its default text. Two of the three things Strand 3 actually built are
// invisible in that state:
//
//   - the multi-crumb trail, and with it the LINK vs CURRENT split that is
//     the only place `isCurrent` is observable;
//   - navigation BY the breadcrumb (migrated routes it through
//     `onFocusChange`, having no context `zoomTo` — lead ruling D323).
//
// A gate that cannot see the thing it is gating is not evidence (the lesson
// K4's pixel gate taught the hard way: it passed with four metrics identical
// to the control, because it was measuring nothing). So this probe drives the
// three states the screenshot cannot reach and compares the RENDERED result
// on both sides: hovered, drilled, and navigated-back-by-crumb.
//
// Usage (bench preview must be serving; QA_PORT overrides the port):
//   node qa/sb-chrome-probe.mjs
// Exits non-zero on any mismatch.

import { chromium } from "playwright";

const PORT = process.env.QA_PORT ?? 5198;
const base = `http://localhost:${PORT}`;
const n = 27;

const readChrome = () => {
  const nav = document.querySelector('nav[aria-label="Drill-down path"]');
  const hint = document.querySelector('[aria-live="polite"]');
  const items = nav
    ? Array.from(nav.querySelectorAll("li")).map((li) => ({
        label: li.textContent,
        // bklit renders the current crumb as a non-interactive node and every
        // ancestor as a button; the two scenarios write that markup out
        // identically, so the split is comparable across impls.
        isCurrent: !li.querySelector("button"),
      }))
    : null;
  return {
    navPresent: !!nav,
    items,
    hintText: hint?.textContent ?? null,
    // The render-prop branch emits a <strong>; the default branch never does.
    hintUsedHoverBranch: !!hint?.querySelector("strong"),
  };
};

const settle = async (page) => {
  await page.evaluate(() => window.__benchSettled);
  await page.waitForTimeout(200);
};

const probe = async (browser, impl) => {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/?impl=${impl}&chart=sunchrome&n=${n}`, {
    waitUntil: "commit",
  });
  await page.waitForFunction(() => window.__benchPaintDone === true, {
    timeout: 30000,
  });
  await settle(page);

  const root = await page.evaluate(readChrome);

  // --- hovered: same point on both sides, derived from the SVG's own box ---
  const box = await page.locator("svg").first().boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx + box.width * 0.3, cy);
  await page.waitForTimeout(700); // HOVER_WAIT_MS, same as qa/screenshot.mjs
  const hovered = await page.evaluate(readChrome);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);

  // --- drilled: the scenario's replicated segment click ---
  await page.evaluate(() => window.__benchDrilldown?.());
  await settle(page);
  const drilled = await page.evaluate(readChrome);

  // --- navigated back by clicking the first (ancestor) crumb ---
  await page.evaluate(() => {
    document
      .querySelector('nav[aria-label="Drill-down path"] button')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(1000); // zoom morph (750ms) + margin
  const navigated = await page.evaluate(readChrome);

  await ctx.close();
  return { root, hovered, drilled, navigated };
};

const browser = await chromium.launch();
const results = {};
for (const impl of ["bklit", "migrated"]) {
  results[impl] = await probe(browser, impl);
}
await browser.close();

let failed = false;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed = true;
};

console.log(`\n[qa] sunburst chrome probe: bklit vs migrated — sunchrome n=${n}`);
for (const state of ["root", "hovered", "drilled", "navigated"]) {
  const a = JSON.stringify(results.bklit[state]);
  const b = JSON.stringify(results.migrated[state]);
  check(state.padEnd(10), a === b, a === b ? a : `\n    bklit    ${a}\n    migrated ${b}`);
}

// Presence assertions — the probe must be able to SEE what it is comparing,
// or an equal-but-empty pair would read as a pass.
const { root, hovered, drilled } = results.migrated;
check("saw a trail", (root.items?.length ?? 0) >= 1);
check("saw the hover branch", hovered.hintUsedHoverBranch);
check("saw a multi-crumb trail", (drilled.items?.length ?? 0) >= 2);
check(
  "saw the link/current split",
  drilled.items?.some((i) => !i.isCurrent) === true &&
    drilled.items?.some((i) => i.isCurrent) === true,
);

console.log(`[qa] overall: ${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
