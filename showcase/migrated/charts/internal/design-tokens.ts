// Magic values live here; never re-inline them at call sites.

// Hand-maintained mirror of native motion.ts:207,209 reveal defaults (module-private upstream; update on pin bump).
const REVEAL_DURATION_MS = 1100;
const REVEAL_EASE_CSS = "cubic-bezier(0.85, 0, 0.15, 1)";
// First/second bezier control-x of the reveal easing (match the CSS string above).
const REVEAL_EASE_X1 = 0.85;
const REVEAL_EASE_X2 = 0.15;
const REVEAL_EASE_POINTS = [REVEAL_EASE_X1, 0, REVEAL_EASE_X2, 1] as const;

// Crosshair, dot, and pill tooltip spring.
const TOOLTIP_SPRING = { damping: 30, stiffness: 300 };
// Floating panel follow spring.
const TOOLTIP_BOX_SPRING = { damping: 20, stiffness: 100 };
// Hover highlight band spring.
const HIGHLIGHT_SPRING = { damping: 28, stiffness: 180 };

const BOX_OFFSET = 16;

// Above this primitive count a chart renders through the package's static SVG renderer:
// The motion renderer's update reconcile is O(elements x points) (upstream I3).
const NATIVE_MOTION_MAX_POINTS = 200;

const ENTRANCE_SPRING = { damping: 25, stiffness: 300 };
const DISCRETE_INTERACTION_THRESHOLD = 60;
const BOX_FALLBACK_WIDTH = 180;
const BOX_FALLBACK_HEIGHT = 80;
const TICKER_HALF_WIDTH = 50;
const FADE_BUFFER = 20;
const TICKER_ITEM_HEIGHT = 24;

// ── Grid / background / loading tokens ────────────────────
const BACKGROUND_ENTER_FADE_MS = 420;
// Axis-label position tween (500ms); returns via `tickLabels.motion` (native <text> can't CSS-tween x/y).
const SERIES_MARKER_ENTER_MS = 500;
// Bklit line-loading-timing.ts loading pulse cycle (seconds).
const LINE_LOADING_PULSE_CYCLE_S = 2.2;
// Bklit line-loading-timing.ts idle gap before the pulse restarts (ms).
const LINE_LOADING_LOOP_PAUSE_MS = 280;

// ── Shared categorical palette ─────────────────────────────
// Explicit 5-entry legacy palette: the native 6-entry default desyncs from index 5.
const CHART_CATEGORY_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

// Same 5 tokens with literal fallbacks; dropping one changes behavior where vars are undefined.
const CHART_CATEGORY_PALETTE_WITH_FALLBACK = [
  "var(--chart-1, #7c3aed)",
  "var(--chart-2, #0ea5e9)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #10b981)",
  "var(--chart-5, #ec4899)",
] as const;

export {
  BACKGROUND_ENTER_FADE_MS,
  BOX_FALLBACK_HEIGHT,
  BOX_FALLBACK_WIDTH,
  BOX_OFFSET,
  CHART_CATEGORY_PALETTE,
  CHART_CATEGORY_PALETTE_WITH_FALLBACK,
  DISCRETE_INTERACTION_THRESHOLD,
  ENTRANCE_SPRING,
  FADE_BUFFER,
  HIGHLIGHT_SPRING,
  LINE_LOADING_LOOP_PAUSE_MS,
  LINE_LOADING_PULSE_CYCLE_S,
  NATIVE_MOTION_MAX_POINTS,
  REVEAL_DURATION_MS,
  REVEAL_EASE_CSS,
  REVEAL_EASE_POINTS,
  SERIES_MARKER_ENTER_MS,
  TICKER_HALF_WIDTH,
  TICKER_ITEM_HEIGHT,
  TOOLTIP_BOX_SPRING,
  TOOLTIP_SPRING,
};
