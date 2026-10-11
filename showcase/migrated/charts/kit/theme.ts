// bklit design tokens for the native TanStack cartesian kit: everything routes through the --chart-* CSS variables,
// so light/dark and per-app theming keep working and nothing hard-codes a color.
import type { CSSProperties } from "react";
import type { ChartTheme } from "@tanstack/charts";
import { bklitTooltipPlacement } from "./tooltip/bklit-tooltip-portal";
import { REST_PX } from "./motion/spring-curve";
import { TOOLTIP_BOX_SPRING } from "./motion/springs";
import { isFiniteNumber, isString, leadingFloat } from "./guards";
import { CHART_PALETTE } from "./palette";

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGIN: ChartMargin = { top: 40, right: 40, bottom: 40, left: 40 };
export const DEFAULT_ANIMATION_MS = 1100;
const DEFAULT_ASPECT_RATIO = 2;
export const DEFAULT_LINE_STROKE = "var(--chart-line-primary)";
export const DEFAULT_GRID_STROKE = "var(--chart-grid)";

/** Native theme tokens (foreground, grid, background) mapped to bklit's CSS variables. */
export const bklitTheme: Partial<ChartTheme> = {
  foreground: "var(--chart-foreground)",
  muted: "var(--chart-label)",
  grid: "var(--chart-grid)",
  background: "transparent",
  palette: CHART_PALETTE,
};

/** Container style: maps the native `--ts-chart-*` hooks (tooltip panel, focus fill, crosshair halo) onto bklit tokens,
 * so the built-in tooltip surface renders like bklit's TooltipBox. */
export const bklitSurfaceStyle: CSSProperties & Record<string, string> = {
  "--ts-chart-tooltip-background": "var(--chart-tooltip-background)",
  "--ts-chart-tooltip-color": "var(--chart-tooltip-foreground)",
  "--ts-chart-tooltip-border": "0",
  "--ts-chart-tooltip-border-radius": "var(--radius-lg, 0.5rem)",
  "--ts-chart-tooltip-padding": "0",
  "--ts-chart-tooltip-max-width": "none",
  "--ts-chart-tooltip-shadow":
    "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  "--ts-chart-tooltip-font": "400 0.875rem/1.25rem var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
  "--ts-chart-focus-fill": "var(--chart-background)",
  "--ts-chart-crosshair-label-halo": "transparent",
};

/** Parses bklit's `"2 / 1"` / `"16/9"` / numeric aspect ratio into a number. */
export function parseAspectRatio(value: string | number | undefined): number {
  if (isFiniteNumber(value) && value > 0) {
    return value;
  }
  if (isString(value)) {
    const [w, h] = value.split("/").map((part) => leadingFloat(part.trim()));
    if (isFiniteNumber(w) && isFiniteNumber(h) && w !== 0 && h > 0) {
      return w / h;
    }
    const single = leadingFloat(value);
    if (Number.isFinite(single) && single > 0) {
      return single;
    }
  }
  return DEFAULT_ASPECT_RATIO;
}

/** Native tooltip presence + movement transition (`tooltip.motion` takes a bare transition, NOT a `{ transition }` definition).
 * bklit TooltipBox follows the pointer with tooltipBoxSpring 100/20. */
export const TOOLTIP_MOTION = { type: "spring", ...TOOLTIP_BOX_SPRING, restSpeed: REST_PX.speed, restDelta: REST_PX.delta } as const;

export const TOOLTIP_OFFSET = 16;

export const MS_PER_SECOND = 1000;

/** bklit TooltipBox placement: panel top aligned with the plot top, `offset` px right of the focused x, flipping left when `x + width + offset` passes the chart width
 * (position-only portal, container-relative). */
export const BKLIT_TOOLTIP_PLACEMENT = {
  // Declarative anchor: the renderer then skips repainting the tooltip while the pointer moves within one focused point.
  anchor: { x: "value", y: "plot-top" },
  offset: TOOLTIP_OFFSET,
  portal: bklitTooltipPlacement({ pinTop: true }),
} as const;

/** bklit's x tick labels (HTML spans, text-xs/16px) sit 12px under the plot bottom; the native label box starts ~2.4px above the axis line at padding 0,
 * so 14.4px lands the box top on bklit's. The date pill follows it. */
export const X_TICK_PADDING = 14.4;
