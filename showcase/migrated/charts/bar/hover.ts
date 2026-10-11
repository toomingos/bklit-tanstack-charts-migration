// Bar hover/legend dim as static scoped CSS keyed on host attrs `data-hover` (category index) and `data-legend` (series
// index), written by bar-chart.tsx; same pattern as kit/polar/polar-dim.ts. Past MAX_INDEX categories there is no emphasis.
import { NOT_MOTION, typedAttr } from "../kit/css-hooks";

export interface HoverTarget {
  /** Selector for every leaf node of the mark (relative to the chart root). */
  readonly select: string;
  /** Selector matching the nodes of category `index` (kept at rest opacity), or null to dim the whole mark. */
  readonly keep: ((index: number) => string) | null;
  /** Opacity of the dimmed nodes while any category is focused. */
  readonly dim: number;
  /** True for marks bklit snaps (no opacity fade): the column track. */
  readonly snap?: boolean;
  /** CSS easing of the dim fade (default ease-in-out, bklit's bar/tick CSS transition); squares use motion's opacity tween, ease-out. */
  readonly easing?: string;
  /** Series index the nodes belong to: a legend hover dims every target of another series. */
  readonly seriesIndex?: number;
  /** Only used by the legend dim (the category hover has its own target for the same nodes). */
  readonly legendOnly?: boolean;
}

export const cssAttr = (value: string): string => value.replaceAll(/["\\\n]/gu, String.raw`\$&`);
/** Class on every node of category `index` for marks we author (squares, track, depth): selectable without the key encoding. */
export const barIndexClass = (index: number): string => `bkm-bi${index}`;

const HOVER_TRANSITION_MS = 150;
export const MAX_INDEX = 64;

/** One rule per category index (0..min(count, MAX_INDEX)): nodes matched by `select` that are not the focused category's (`keep(i)`) take
 * `declarations` while `[data-hover="i"]` is on the host. */
function indexDimRules(scope: string, count: number, select: string, keep: (index: number) => string, declarations: string): string[] {
  const rules: string[] = [];
  for (let i = 0; i < Math.min(count, MAX_INDEX); i += 1) {
    rules.push(`${scope}[data-hover="${i}"] ${select}:not(${keep(i)}){${declarations}}`);
  }
  return rules;
}

/** Host var: the focused category's centre x (svg px) for the vertical bar tick fade. */
export const FOCUS_X_VAR = "--bkm-bfx";

export interface TickFade {
  readonly prefix: string;
  /** Vertical bars: half-width of the hidden zone around the focused band centre; undefined for the horizontal label highlight. */
  readonly ramp?: number;
  readonly ms: number;
  /** Position of each category's tick label among the drawn labels (-1: not drawn). */
  readonly positions: readonly number[];
}

// gap #36: axis tick labels are renderer-owned and only reachable through their data-ts-key.
function tickRules(scope: string, tick: TickFade, count: number): string[] {
  const rules = [`${scope} text[data-ts-key^="${tick.prefix}"]${NOT_MOTION}{transition:opacity ${tick.ms}ms ease-in-out,fill ${tick.ms}ms ease-in-out}`];
  if (tick.ramp !== undefined) {
    // bklit bar-x-axis.tsx: a tick within tickerHalfWidth of the focused band centre hides, fading in over the next 20px (`FOCUS_X_VAR` = centre).
    // Typed attr() is Chromium-only (133+): under `@supports` (the unguarded var() is invalid at computed time), other browsers keep the tick visible.
    rules.push(typedAttr(`${scope}[data-hover] text[data-ts-key^="${tick.prefix}"]{opacity:clamp(0,calc((abs(attr(x type(<number>)) - var(${FOCUS_X_VAR},-9999)) - ${tick.ramp}) / 20),1)!important}`));
    return rules;
  }
  // bklit bar-y-axis.tsx: the hovered category label goes from 0.7 opacity / label colour to full opacity / foreground; its position is looked up per category.
  for (const [index, pos] of tick.positions.slice(0, Math.min(count, MAX_INDEX)).entries()) {
    if (pos >= 0) {
      rules.push(`${scope}[data-hover="${index}"] text[data-ts-key^="${tick.prefix}"]:nth-child(${pos + 1}){opacity:1!important;fill:var(--foreground)!important}`);
    }
  }
  return rules;
}

/** The bar emphasis stylesheet: one rule per category the data has; depends on targets, category count and ticks, never on focus (host attrs `data-hover`, `data-legend`).
 * The focused category's tick label fades out (the date pill replaces it). */
export function barDimCss(scope: string, targets: readonly HoverTarget[], tick: TickFade | null, count: number): string {
  const rules: string[] = [];
  for (const target of targets) {
    if (target.legendOnly !== true) {
      const transition = target.snap === true ? "none" : `opacity ${HOVER_TRANSITION_MS}ms ${target.easing ?? "ease-in-out"}`;
      rules.push(`${scope} ${target.select}${NOT_MOTION}{transition:${transition}}`);
      if (target.keep === null) {
        rules.push(`${scope}[data-hover] ${target.select}{opacity:${target.dim}!important}`);
      } else {
        rules.push(...indexDimRules(scope, count, target.select, target.keep, `opacity:${target.dim}!important`));
      }
    }
    if (target.seriesIndex !== undefined && target.snap !== true) {
      // A focused category owns the emphasis: a keyboard-focused legend row must not stack its stale dim on it (bklit's legend is mouse-only).
      rules.push(`${scope}[data-legend]:not([data-hover]):not([data-legend="${target.seriesIndex}"]) ${target.select}{opacity:${target.dim}!important}`);
    }
  }
  if (tick) {
    rules.push(...tickRules(scope, tick, count));
  }
  return rules.join("");
}
