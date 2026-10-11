// bklit y-domain-utils.ts / y-axis-scales.ts: the pure y-domain helpers of bklit's public index (same signatures).
import type { ScaleLinear } from "d3-scale";
import type { ChartPhase } from "../motion/phase";
import type { LineConfig } from "./chart-context";
import { niced } from "./domains";
import { axisId } from "./series";

export type YDomain = [number, number];

/** bklit chart-phase.ts Y_DOMAIN_TWEEN_SKIP_THRESHOLD: a y domain that moves less than this share of its span snaps. */
const Y_DOMAIN_TWEEN_SKIP_THRESHOLD = 0.02;

export const niceYDomain = (domain: YDomain): YDomain => niced(domain);

/** Whether a y domain moves by at least the skip threshold (relative to the larger span). */
export function shouldTweenYDomain(from: Readonly<YDomain>, to: Readonly<YDomain>): boolean {
  const span = Math.max(Math.abs(to[1] - to[0]), Math.abs(from[1] - from[0]), 1);
  return Math.abs(to[0] - from[0]) / span >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD || Math.abs(to[1] - from[1]) / span >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD;
}

export const isLoadingChromePhase = (phase: ChartPhase): boolean => phase === "loading" || phase === "revealingLoading";

export const isYDomainTweenPhase = (phase: ChartPhase): boolean => phase === "gridTweenLoading" || phase === "gridTweenReady";

/** Merge domain maps, normalising axis ids to strings. */
export function mergeYDomainRecords(...records: readonly Readonly<Record<string, YDomain>>[]): Record<string, YDomain> {
  const merged: Record<string, YDomain> = {};
  for (const record of records) {
    for (const [id, domain] of Object.entries(record)) {
      merged[axisId(id)] = domain;
    }
  }
  return merged;
}

/** Niced y domain per axis id; `left` always exists. */
export function computeYDomainsByAxis({ lines, resolveDomain }: { readonly lines: readonly LineConfig[]; readonly resolveDomain: (dataKeys: string[]) => YDomain }): Record<string, YDomain> {
  const keysByAxis = new Map<string, string[]>();
  for (const line of lines) {
    const id = axisId(line.yAxisId);
    keysByAxis.set(id, [...(keysByAxis.get(id) ?? []), line.dataKey]);
  }
  const domains: Record<string, YDomain> = {};
  for (const [id, keys] of keysByAxis) {
    domains[id] = niceYDomain(resolveDomain(keys));
  }
  domains.left ??= niceYDomain([0, 100]);
  return domains;
}

/** The primary (`left`) y scale, else the first one, else `fallback`. */
export function getPrimaryYScale<T extends ScaleLinear<number, number>>(yScales: Readonly<Record<string, T>>, fallback: T): T {
  return yScales.left ?? Object.values(yScales)[0] ?? fallback;
}
