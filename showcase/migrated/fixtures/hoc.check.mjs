/// <reference types="node" />
import { build, stop } from "esbuild";

// Legacy throw contract (repos/bklit-ui chart-context.tsx via useChartStable).
const LEGACY_THROW_NEEDLE = "must be used within a ChartProvider";

// Bundle target below is the gitignored scratch dir qa/unit tooling uses.
const bundleUrl = new URL("../../../qa/unit/.tmp/hoc.cjs", import.meta.url);

/**
 * Guards the built bundle shape without asserting.
 * @param {unknown} mod - Candidate module.
 * @returns {mod is { checkHoc: () => { areaPathPresent: boolean, deduped: number, divAreas: number, divGridNull: boolean, divLines: number, htmlLength: number, scanned: number, standaloneMessage: string, unionMerged: number } }} Whether mod exposes the fixture.
 */
const isFixture = (mod) =>
  mod !== null && mod !== undefined && "checkHoc" in mod;

/**
 * Runs every V1.3 assertion against the built fixture module.
 * @param {unknown} rendered - Built fixture module.
 */
const checkFixture = (rendered) => {
  if (!isFixture(rendered)) {
    throw new Error("hoc bundle has no fixture renderer");
  }
  const summary = rendered.checkHoc();
  if (summary.areaPathPresent) {
    process.stdout.write(
      `hoc fixture: area path present (${summary.htmlLength} chars)\n`,
    );
  } else {
    throw new Error("hoc fixture HTML has no area path");
  }
  if (summary.scanned !== 2) {
    throw new Error(`hoc scan found ${summary.scanned} areas, want 2`);
  }
  process.stdout.write(`hoc scan: memo plus displayName HOC resolve (${summary.scanned} areas)\n`);
  if (summary.unionMerged !== 2 || summary.deduped !== 1) {
    throw new Error(
      `hoc registry union gives merged=${summary.unionMerged} deduped=${summary.deduped}, want 2/1`,
    );
  }
  process.stdout.write(
    `hoc registry union: merged=${summary.unionMerged} deduped=${summary.deduped}\n`,
  );
  if (summary.standaloneMessage.includes(LEGACY_THROW_NEEDLE)) {
    process.stdout.write(`standalone Grid threw legacy message: ${summary.standaloneMessage}\n`);
  } else {
    throw new Error(`standalone Grid threw ${summary.standaloneMessage}`);
  }
  const ignored =
    summary.divAreas === 0 &&
    summary.divLines === 0 &&
    summary.divGridNull;
  if (ignored) {
    process.stdout.write("unknown div ignored: areas=0 lines=0 gridNull=true\n");
  } else {
    throw new Error(
      `unknown div not ignored: areas=${summary.divAreas} lines=${summary.divLines} gridNull=${summary.divGridNull}`,
    );
  }
};

const main = async () => {
  try {
    const showcaseDir = new URL("../..", import.meta.url);
    // Self-contained CJS bundle with React, showcase sources and TanStack
    // Charts bundled in, so the node server build keeps require calls.
    await build({
      alias: { "@": showcaseDir.pathname },
      bundle: true,
      entryPoints: [new URL("hoc.tsx", import.meta.url).pathname],
      format: "cjs",
      jsx: "automatic",
      loader: { ".css": "empty", ".tsx": "tsx" },
      logLevel: "silent",
      minify: true,
      outfile: bundleUrl.pathname,
      platform: "node",
    });
    checkFixture(await import(bundleUrl.href));
  } catch (error) {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  } finally {
    // Releases the build service port so the process terminates.
    await stop();
  }
};

void main();
