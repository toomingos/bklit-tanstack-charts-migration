// Single design-tokens module required by research/phase-3/00-layer-contract.md;
// magic values must never be re-inlined at call sites.

// T-D1 (P3.2): these three values mirror the native TanStack charts-core
// reveal defaults at `showcase/repos/tanstack-charts/packages/charts-core/
// src/motion.ts:207,209` (`defaultDuration = 1_100`,
// `defaultEasing = cubicBezier(0.85, 0, 0.15, 1)`). Verified equal as of
// this comment. Both native constants are MODULE-PRIVATE — the package's
// only export touching them is `motion()` (motion.ts:754), which resolves
// them internally into a driver object with no public read-back path (its
// returned `UniversalChartRenderer` surface is `id`/`capabilities`/
// `prerender`/`mount` only; `resolveTransition`/`resolveEasing`, which close
// over `defaultDuration`/`defaultEasing`, are themselves unexported). There
// is therefore no way to import or programmatically read back the native
// default short of invoking `motion()`'s full mount pipeline against a real
// scene — which these charts' hand-rolled WAAPI reveal engine
// (`./enter-transition.ts`) does not do and, per that file's own D51
// finding, cannot safely be rearchitected onto. These are a HAND-MAINTAINED
// COPY that upstream can silently drift away from without any type error or
// build failure surfacing it — if you touch `motion.ts:207,209` upstream,
// update these three values to match. (P6.2 recheck: line-chart.tsx,
// area-chart.tsx and composed-chart.tsx NO LONGER hold literal copies — they
// resolve their reveal timing through `./enter-transition`, whose
// `TWEEN_FALLBACK` imports REVEAL_DURATION_MS / REVEAL_EASE_CSS from here. This
// module is now the single copy; the sentence that used to list three more is
// gone with them.)
export const REVEAL_DURATION_MS = 1100;
export const REVEAL_EASE_CSS = "cubic-bezier(0.85, 0, 0.15, 1)";
export const REVEAL_EASE_POINTS = [0.85, 0, 0.15, 1] as const;

export const TOOLTIP_SPRING = { stiffness: 300, damping: 30 }; // crosshair/dot/pill
export const TOOLTIP_BOX_SPRING = { stiffness: 100, damping: 20 }; // panel follow
export const HIGHLIGHT_SPRING = { stiffness: 180, damping: 28 }; // highlight band

export const BOX_OFFSET = 16;

export const ENTRANCE_SPRING = { stiffness: 300, damping: 25 };
export const DISCRETE_INTERACTION_THRESHOLD = 60;
export const BOX_FALLBACK_WIDTH = 180;
export const BOX_FALLBACK_HEIGHT = 80;
export const TICKER_HALF_WIDTH = 50;
export const FADE_BUFFER = 20;
export const TICKER_ITEM_HEIGHT = 24;

// ── Initiative 3 (grid / background / loading) tokens ────────────────────
// bklit background.tsx BACKGROUND_ENTER_FADE_MS — pattern enter fade.
export const BACKGROUND_ENTER_FADE_MS = 420;
// bklit chart-phase.ts DEFAULT_Y_DOMAIN_TWEEN_MS — the AX5 axis-label
// position tween (500ms, cubic-bezier(0.85,0,0.15,1): `left` on x labels
// when un-brushed, `top` on y labels). Its AXIS_POSITION_TWEEN_MS token died
// in C4 with the HTML axis overlays: native SVG tick labels can't tween
// x/y via CSS (not CSS properties on <text>), so the tween returns through
// `tickLabels.motion` at C5's renderer/motion switch (D431).
// bklit series-markers.tsx:103 `const enterDuration = 0.5` — the per-point
// opacity/blur fade of a series marker, staggered across the clip reveal.
// (P6.2: was an inline `duration: 500` in line-chart.tsx and area-chart.tsx.)
export const SERIES_MARKER_ENTER_MS = 500;
// bklit line-loading-timing.ts loading pulse cycle (seconds).
export const LINE_LOADING_PULSE_CYCLE_S = 2.2;
// bklit line-loading-timing.ts idle gap before the pulse restarts (ms).
export const LINE_LOADING_LOOP_PAUSE_MS = 280;

// ── T-D15 (P3.1): shared categorical palette ─────────────────────────────
// Legacy bklit cycles a 5-entry palette (--chart-1..5) by index across pie,
// sunburst, sankey, and scatter. TanStack's native `defaultChartTheme.palette`
// (charts-core scene.ts:58-71) is a DIFFERENT, 6-entry palette
// (--ts-chart-1..6) — cycling a 6-long native palette against these parts'
// 5-category legacy behavior agrees only through index 4 and desyncs from
// index 5 on, never recovering. See research/phase-4/wave-tasks/P3-01.md
// (LEAD CORRECTION) for the derivation. Each adopting part passes this
// explicit 5-entry array through its own `theme.palette` spec override
// (resolved at scene.ts:301-306 / facet.ts:814 / runtime.ts:22) instead of
// relying on the native default.
export const CHART_CATEGORY_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

// sankey-chart.tsx's node/link default palette: same 5 tokens as
// CHART_CATEGORY_PALETTE but carrying literal hex fallbacks. Preserved
// exactly — dropping a fallback would be a silent behavior change wherever
// the CSS custom property is undefined.
export const CHART_CATEGORY_PALETTE_WITH_FALLBACK = [
  "var(--chart-1, #7c3aed)",
  "var(--chart-2, #0ea5e9)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #10b981)",
  "var(--chart-5, #ec4899)",
] as const;
