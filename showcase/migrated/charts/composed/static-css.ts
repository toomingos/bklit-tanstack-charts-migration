import { hoverStaticCss } from "../kit/cartesian/definition";
import type { buildCartesianDefinition } from "../kit/cartesian/definition";
import { OWN_PILL_NAMES, pillTickStaticCss } from "../kit/cartesian/date-pill";
import type { resolveSeries } from "../kit/cartesian/series";
import { cssAttr } from "../bar/hover";
import type { SeriesBarSpec } from "./bars";
import { readyGateCss } from "../kit/cartesian/gate-css";
import { typedAttr } from "../kit/css-hooks";
import { NOT_MOTION, keyStarts } from "../kit/renderer-dom";

interface StaticCssInput {
  readonly uid: string;
  readonly built: Pick<ReturnType<typeof buildCartesianDefinition>, "hover" | "pillTicks">;
  readonly bars: readonly SeriesBarSpec[];
  readonly order: readonly string[];
  readonly series: ReturnType<typeof resolveSeries>;
}

// Hover / legend emphasis is fixed text keyed on host attributes, so it changes only with the definition; the kit's per-kind
// series indices are re-keyed to bklit's joint JSX-order legend index.
export function composedStaticCss({ uid, built, bars, order, series }: Readonly<StaticCssInput>): string {
  const scope = `[data-bkm-kit="${uid}"]`;
  const legendOf = (kitIndex: number | undefined): number | undefined => {
    const key = series.find((s) => s.index === kitIndex)?.dataKey;
    const at = key === undefined ? -1 : order.indexOf(key);
    return at < 0 ? undefined : at;
  };
  const hover = { ...built.hover, dim: built.hover.dim.map((rule) => (rule.series === undefined ? rule : { ...rule, series: legendOf(rule.series) })) };
  const pill = built.pillTicks.active ? pillTickStaticCss(scope, built.pillTicks.times, built.pillTicks.reachPx, OWN_PILL_NAMES) : null;
  // bklit fades every bar outside the focused x to its fadedOpacity (120ms) and every bar of another legend row to its fadedOpacity (series-bar.tsx: one opacity tween, 0.12s).
  const barRules = bars.map((b) => {
    const select = `${scope} ${keyStarts(`bar:${cssAttr(b.dataKey)}:string:`)}:not(g)`;
    const legend = order.indexOf(b.dataKey);
    // One rule, not one per focus index: a bar is outside the focused x when the host's `--bkm-hx` (focused time, svg px) falls
    // outside its own rect. 0 on the focused bar, 1 elsewhere; the fade-out waits 20ms like bklit's, the fade back does not.
    const out = "clamp(0,calc((abs(attr(x type(<number>)) + attr(width type(<number>)) / 2 - var(--bkm-hx,-9999)) - attr(width type(<number>)) / 2) * 1000),1)";
    return [
      `${select}${NOT_MOTION}{transition:opacity .12s ease-out}`,
      // Typed attr() is Chromium-only (133+): under `@supports` (unguarded, the var() keeps it past parsing and it is invalid at
      // computed time, an `opacity:1!important` that also beat the legend fade below); other browsers hover without the bar dim.
      typedAttr(`${scope}[data-bkm-bi] ${keyStarts(`bar:${cssAttr(b.dataKey)}:string:`)}:not(g){opacity:calc(1 - ${out} * ${1 - b.fadedOpacity})!important;transition-delay:calc(${out} * .02s)}`),
      `${scope}[data-bkm-legend]:not([data-bkm-legend="${legend}"]) ${keyStarts(`bar:${cssAttr(b.dataKey)}:string:`)}:not(g){opacity:${b.fadedOpacity}}`,
    ].join("");
  });
  return [readyGateCss(scope, true), pill, hoverStaticCss(scope, hover), ...barRules].filter(Boolean).join("");
}
