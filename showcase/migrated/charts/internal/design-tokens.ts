// Single design-tokens module required by research/phase-3/00-layer-contract.md;
// magic values must never be re-inlined at call sites.

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
// bklit grid.tsx grid shimmer band width (use-grid-shimmer DEFAULT_SHIMMER_LENGTH_PX).
export const DEFAULT_SHIMMER_LENGTH_PX = 140;
// bklit grid.tsx DEFAULT_SHIMMER_SPEED (shimmer speed multiplier).
export const DEFAULT_SHIMMER_SPEED = 1;
// bklit grid.tsx DEFAULT_SHIMMER_STROKE — shimmer band color.
export const DEFAULT_SHIMMER_STROKE =
  "color-mix(in oklch, var(--foreground) 68%, transparent)";
// bklit background.tsx BACKGROUND_ENTER_FADE_MS — pattern enter fade.
export const BACKGROUND_ENTER_FADE_MS = 420;
// bklit line-loading-timing.ts loading pulse cycle (seconds).
export const LINE_LOADING_PULSE_CYCLE_S = 2.2;
// bklit line-loading-timing.ts idle gap before the pulse restarts (ms).
export const LINE_LOADING_LOOP_PAUSE_MS = 280;

// ── Initiative 8 (legend / ChartLegend / ProfitLoss) tokens ──────────────
// bklit legend-item.tsx:23, chart-legend.tsx:222, globals.css:131
export const LEGEND_ITEM_HOVER_TRANSITION_MS = 150;
export const LEGEND_ITEM_HOVER_TRANSITION_EASING = "ease-out";
// bklit globals.css:127 — .legend-container:has([data-hovered]) > *:not([data-hovered]) { opacity: 0.5 }
export const LEGEND_HOVER_DIM_OPACITY = 0.5;
// bklit chart-legend.tsx:224 — isFaded && "opacity-40" (dead code under the CSS rule above; ported byte-for-byte)
export const CHART_LEGEND_FADED_OPACITY_CLASS = "opacity-40";
// bklit legend-progress.tsx:39 — Progress.Indicator transition
export const LEGEND_PROGRESS_TRANSITION_MS = 500;
// bklit profit-loss-line.tsx:22,170-171 — per-segment sign dim (distinct
// from the retired SeriesHoverDim wrapper; the whole-series dim lives in
// hover-chrome.ts/bar-hover-chrome.ts with per-host opacities — D225 ruling 1)
export const PROFIT_LOSS_LEGEND_DIM_OPACITY = 0.25;
export const PROFIT_LOSS_LEGEND_DIM_TRANSITION = "opacity 0.2s ease-in-out";
export const PROFIT_LOSS_LEGEND_DIM_DURATION_MS = 200;
// bklit line-loading-timing.ts loading label exit duration (seconds).
export const LOADING_LABEL_EXIT_S = 0.45;
// bklit line-loading-timing.ts loading label exit drop distance (px).
export const LOADING_LABEL_EXIT_Y_PX = 30;
