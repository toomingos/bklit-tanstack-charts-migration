/// <reference types="node" />
import { build, stop } from "esbuild";

// Bundle target below is the gitignored scratch dir qa/unit tooling uses.
const bundleUrl = new URL("../../../qa/unit/.tmp/states-check.cjs", import.meta.url);
// Package resolver entry without a public subpath export.
// Runtime dynamic import keeps the static graph on public APIs.
const resolverUrl = new URL(
  "../node_modules/@tanstack/charts/dist/mark-state.js",
  import.meta.url,
);

/**
 * @param {unknown} mod - Candidate module.
 * @returns {mod is { resolveMarkStateScene: (scene: object, focus: object, pointer: null) => unknown, sceneHasMarkStates: (nodes: object) => boolean }} Whether mod is the mark-state resolver.
 */
const isResolver = (mod) =>
  mod !== null &&
  mod !== undefined &&
  "resolveMarkStateScene" in mod &&
  "sceneHasMarkStates" in mod;

/**
 * @param {unknown} mod - Candidate module.
 * @returns {mod is { runStatesCheckWith: (resolver: object) => string }} Whether mod exposes the check.
 */
const isFixture = (mod) =>
  mod !== null && mod !== undefined && "runStatesCheckWith" in mod;

/**
 * @param {unknown} resolverMod - Candidate resolver module.
 * @param {unknown} fixtureMod - Candidate fixture module.
 */
const printStatesResult = (resolverMod, fixtureMod) => {
  if (!isResolver(resolverMod)) {
    throw new Error("states bundle has no mark-state resolver");
  }
  if (!isFixture(fixtureMod)) {
    throw new Error("states bundle has no runStatesCheckWith export");
  }
  /**
   * @type {{ hasStates: (nodes: object) => boolean, resolve: (scene: object, focus: object) => unknown }}
   */
  const resolver = {
    hasStates: (nodes) => resolverMod.sceneHasMarkStates(nodes),
    resolve: (scene, focus) => resolverMod.resolveMarkStateScene(scene, focus, null),
  };
  process.stdout.write(`${fixtureMod.runStatesCheckWith(resolver)}\n`);
};

const main = async () => {
  try {
    const showcaseDir = new URL("../..", import.meta.url);
    // Self-contained CJS bundle for headless runs under plain node.
    await build({
      alias: { "@": showcaseDir.pathname },
      bundle: true,
      entryPoints: [new URL("states.check.ts", import.meta.url).pathname],
      format: "cjs",
      jsx: "automatic",
      loader: { ".css": "empty" },
      logLevel: "silent",
      minify: true,
      outfile: bundleUrl.pathname,
      platform: "node",
    });
    printStatesResult(await import(resolverUrl.href), await import(bundleUrl.href));
  } catch (error) {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  } finally {
    // Releases the build service port so the process terminates.
    await stop();
  }
};

void main();
