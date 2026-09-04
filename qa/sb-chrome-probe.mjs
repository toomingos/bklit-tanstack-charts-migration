// Sunburst breadcrumb/hint gate: the pixel diff only sees root focus (single crumb, default hint), so this
// drives hovered/drilled/crumb-back states and compares the rendered DOM on both sides. Exits non-zero on mismatch.
// Usage: node qa/sb-chrome-probe.mjs (bench preview serving; QA_PORT overrides the port).

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
        // Current crumb is non-interactive, ancestors are buttons, on both impls: the split is comparable.
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

  const box = await page.locator("svg").first().boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx + box.width * 0.3, cy);
  await page.waitForTimeout(700); // same HOVER_WAIT_MS as qa/screenshot.mjs
  const hovered = await page.evaluate(readChrome);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);

  await page.evaluate(() => window.__benchDrilldown?.());
  await settle(page);
  const drilled = await page.evaluate(readChrome);

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

// GUARD: equal-but-empty must not read as a pass; the probe has to SEE what it compares.
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
