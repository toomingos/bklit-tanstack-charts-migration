/// <reference types="node" />
import { build, stop } from "esbuild";

// Tag needle from its code point (github/unescaped-html-literal).
const LESS_THAN_CODE = 60;

const needle = `${String.fromCodePoint(LESS_THAN_CODE)}svg`;

// Bundle target below is the gitignored scratch dir qa/unit tooling uses.
const bundleUrl = new URL("../../../qa/unit/.tmp/legacy-hooks.cjs", import.meta.url);

/**
 * @param {unknown} mod - Candidate module.
 * @returns {mod is { renderLegacyHooksHtml: () => string }} Whether mod exposes the renderer.
 */
const isFixture = (mod) =>
  mod !== null && mod !== undefined && "renderLegacyHooksHtml" in mod;

/**
 * Prints the render confirmation when the fixture HTML contains SVG.
 * @param {unknown} rendered - Built fixture module.
 * @returns {boolean} Whether the HTML contains an SVG root.
 */
const checkHtml = (rendered) => {
  if (!isFixture(rendered)) {
    throw new Error("legacy-hooks bundle has no fixture renderer");
  }
  const html = rendered.renderLegacyHooksHtml();
  if (!html.includes(needle)) {
    throw new Error("legacy-hooks fixture HTML has no SVG");
  }
  process.stdout.write(
    `legacy-hooks fixture rendered ${needle} (${html.length} chars)\n`,
  );
  return true;
};

const main = async () => {
  try {
    const showcaseDir = new URL("../..", import.meta.url);
    // Self-contained CJS bundle with React, showcase sources and TanStack
    // Charts bundled in, so the node server build keeps require calls.
    await build({
      alias: { "@": showcaseDir.pathname },
      bundle: true,
      entryPoints: [new URL("legacy-hooks.tsx", import.meta.url).pathname],
      format: "cjs",
      jsx: "automatic",
      loader: { ".css": "empty", ".tsx": "tsx" },
      logLevel: "silent",
      minify: true,
      outfile: bundleUrl.pathname,
      platform: "node",
    });
    checkHtml(await import(bundleUrl.href));
  } catch (error) {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  } finally {
    // Releases the build service port so the process terminates.
    await stop();
  }
};

void main();
