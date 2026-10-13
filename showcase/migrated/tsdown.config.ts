// Unbundled ESM build: one output file per source file, so a consumer's bundler tree-shakes per chart.
export default {
  entry: ["charts/**/*.{ts,tsx}"],
  unbundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outDir: "dist",
  dts: true,
  clean: true,
  sourcemap: false,
  // "use client" survives in the output (checked by scripts/pack-check); rolldown warns about it once per file.
  inputOptions: {
    onLog(level: string, log: { code?: string }, defaultHandler: (level: string, log: unknown) => void) {
      if (log.code !== "MODULE_LEVEL_DIRECTIVE") {
        defaultHandler(level, log);
      }
    },
  },
};
