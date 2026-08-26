/**
 * bklit time-series y-domain parity — exact port of
 * time-series-chart-shell.tsx `resolveTimeSeriesYDomain` + `niceYDomain`
 * (d3 `.nice()` applied by the configured scale). Shared by the three migrated
 * time-series charts (Line/Area/Composed), which all scan RAW rows across
 * their series' dataKeys and feed the result to a niced scaleLinear.
 *
 * Scatter's y-domain is intentionally NOT here — it has its own
 * scatter-specific rules (max floored at 0, negatives silently ignored, no
 * padding — docs/LOG.md D14).
 */
import * as React from "react";
import { scaleLinear } from "d3-scale";

import type { ChartDatum } from "./types";
import { type ChartPhase, Y_DOMAIN_TWEEN_SKIP_THRESHOLD } from "./chart-phase";
import {
  DEFAULT_Y_AXIS_ID,
  groupSeriesByYAxisId,
  normalizeYAxisId,
  type YAxisSeries,
} from "./y-axis-id";

/** bklit `y-domain-utils.ts:6`. Named so the per-axis record types read. */
export type YDomain = [number, number];

/**
 * bklit `resolveTimeSeriesYDomain`: all-values>=0 -> [0, max*1.1]; mixed-sign
 * -> [min,max] padded 5% each side; empty -> [0,100]. Pure — same inputs
 * always produce the same tuple. Only `dataKey` is read from each series.
 *
 * P6.1 / AX4 — `yScaleDomainMax` is RESTORED as the third param, matching
 * bklit `time-series-chart-shell.tsx:102-109` including the `> 0` guard, which
 * is what makes a `0` max fall through to the scan instead of collapsing the
 * domain to `[0, 0]`.
 *
 * The parity row reads as if the BEHAVIOUR were missing; it was not. Migrated
 * had hoisted the short-circuit into its single producer — `composed-chart.tsx`
 * inlined `if (stackedMax != null && stackedMax > 0) return [0, stackedMax *
 * 1.1]` ahead of its call. What was actually lost with the param is the GATE
 * around it: legacy only honours the override when the chart is single-axis
 * (`usesDefaultAxisOnly`, see `y-axis-id.ts`), and an inlined branch at the
 * call site has no way to express that. Deciding whether to pass it therefore
 * stays with the CALLER (`resolveYDomainsByAxis` below), exactly as legacy's
 * `resolveYDomain` closure does at `:214-226` — this function applies the
 * override unconditionally when given one, and never inspects axis ids.
 */
export function resolveTimeSeriesYDomain(
  data: readonly ChartDatum[],
  series: readonly { dataKey: string }[],
  yScaleDomainMax?: number,
): YDomain {
  if (yScaleDomainMax != null && yScaleDomainMax > 0) {
    return [0, yScaleDomainMax * 1.1];
  }
  let min = Infinity;
  let max = -Infinity;
  for (const row of data) {
    for (const s of series) {
      const v = row[s.dataKey];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  if (!Number.isFinite(min)) return [0, 100];
  if (min >= 0) return [0, max <= 0 ? 100 : max * 1.1];
  const padding = (max - min) * 0.05 || 1;
  return [min - padding, max + padding];
}

/**
 * Niced y-domain + change detection (bklit chart-phase.ts: new data paints
 * IMMEDIATELY; only a y-DOMAIN change tweens — DEFAULT_Y_DOMAIN_TWEEN_MS).
 * Returns the `.nice()`d domain and whether it moved since the last render.
 *
 * Semantics are identical across Line/Area/Composed: a per-render VALUE
 * compare against the previous niced domain (references may churn; values
 * are what matters). The ref update is idempotent on unrelated re-renders
 * because `niced` is memoized on `yDomain`. (Line's pre-refactor variant
 * wrapped the compare in a useMemo; observably the same — the ref is only
 * ever read to compute `changed`, which is deterministic per niced domain.)
 */
export function useNicedYDomainChanged(yDomain: [number, number]): {
  niced: [number, number];
  changed: boolean;
} {
  const niced = React.useMemo<[number, number]>(
    () => scaleLinear().domain(yDomain).nice().domain() as [number, number],
    [yDomain],
  );
  const prevRef = React.useRef(niced);
  const changed = prevRef.current[0] !== niced[0] || prevRef.current[1] !== niced[1];
  prevRef.current = niced;
  return { niced, changed };
}

/** Creates the same niced linear y-scale used by the time-series charts. */
export function createNicedYScale(yDomain: [number, number]) {
  return scaleLinear().domain(yDomain).nice();
}

/** The scale instance shape every migrated cartesian chart hands to TanStack. */
export type NicedYScale = ReturnType<typeof createNicedYScale>;

/**
 * P6.1 / T-F1 — the multi-axis successor to a single `resolveTimeSeriesYDomain`
 * call. bklit `computeYDomainsByAxis` (`y-domain-utils.ts:77-98`).
 *
 * Each chart keeps its OWN domain math and passes it in as `resolveDomain`;
 * this layer only decides which series belong to which axis and calls that math
 * once per group. That is bklit's own shape (`buildYScalesForLines` takes a
 * `resolveDomain` callback for exactly this reason) and it is what lets
 * scatter's D14 rule — max floored at 0, negatives ignored, no padding —
 * compose with per-axis grouping instead of being replaced by it.
 *
 * TWO deliberate divergences from legacy, both so this is a no-op for every
 * chart that does not use `yAxisId`:
 *
 * 1. **No `.nice()` here.** Legacy nices inside `computeYDomainsByAxis`;
 *    migrated nices downstream, in `createNicedYScale` / `useNicedYDomainChanged`
 *    / `createNicedYScalesByAxis`. `.nice()` is idempotent so either placement
 *    is safe, but moving it would change WHICH value the y-domain-tween change
 *    detector compares, and that detector drives a visible animation.
 * 2. **The `left` backfill is opt-in** (`ensureDefaultAxis`), not unconditional.
 *    Legacy always writes `domains.left = nice([0,100])` when absent, so a chart
 *    whose only series sits on `"right"` still gets a `left` entry. Useful for
 *    legacy's axis-rendering pass; actively wrong for a caller that reads
 *    `Object.keys()` to decide how many axes to draw. Callers that mirror
 *    legacy's rendering pass it `true`.
 *
 * For a chart where every series is on the default axis — i.e. every chart in
 * the codebase today — this returns `{ left: <exactly what the single call
 * returned before> }` and nothing downstream moves.
 */
export function resolveYDomainsByAxis<T extends YAxisSeries>({
  series,
  resolveDomain,
  ensureDefaultAxis = false,
}: {
  series: readonly T[];
  /** Called once per axis group with just that group's series. */
  resolveDomain: (axisSeries: T[], axisId: string) => YDomain;
  ensureDefaultAxis?: boolean;
}): Record<string, YDomain> {
  const domains: Record<string, YDomain> = {};
  for (const [axisId, axisSeries] of groupSeriesByYAxisId(series)) {
    domains[axisId] = resolveDomain(axisSeries, axisId);
  }
  if (ensureDefaultAxis && !domains[DEFAULT_Y_AXIS_ID]) {
    domains[DEFAULT_Y_AXIS_ID] = [0, 100];
  }
  return domains;
}

/**
 * P6.1 / T-F1 — bklit `buildYScalesFromDomains` (`y-axis-scales.ts:79-110`),
 * adapted to migrated's architecture: **no `.range()` is set**. TanStack applies
 * the margin-inclusive range itself (C2, and see the `yScale` memo comments in
 * every cartesian chart), so a ranged scale here would be silently overwritten
 * on the single-axis path and silently AUTHORITATIVE on any path that reads a
 * scale directly — two different behaviours from one builder.
 */
export function createNicedYScalesByAxis(
  domainsByAxis: Record<string, YDomain>,
): Record<string, NicedYScale> {
  const scales: Record<string, NicedYScale> = {};
  for (const [axisId, domain] of Object.entries(domainsByAxis)) {
    scales[axisId] = createNicedYScale(domain);
  }
  return scales;
}

/**
 * bklit `getPrimaryYScale` (`y-axis-scales.ts:32-40`): the default axis if it
 * exists, otherwise the first declared one, otherwise the caller's fallback.
 * The middle branch is the one that matters — a chart with a single series on
 * `yAxisId="right"` must still have a primary scale for the crosshair, tooltip
 * and reference-area layers to read.
 */
export function getPrimaryYScale(
  yScales: Record<string, NicedYScale>,
  fallback: NicedYScale,
): NicedYScale {
  const primary = yScales[DEFAULT_Y_AXIS_ID];
  if (primary) return primary;
  const first = Object.values(yScales)[0];
  return first ?? fallback;
}

/**
 * P6.1 / T-F1 — the piece with no legacy counterpart, and the reason this layer
 * could not simply be a port.
 *
 * bklit threads a `Record<string, YScale>` through `ChartProvider` and every
 * mark reaches for the scale its own `yAxisId` names. Migrated has no such
 * context, and more decisively **TanStack's chart spec carries exactly ONE `y`
 * scale** (`{ y: { scale, grid, axis } }`) — a second scale is not expressible
 * there at all, which is precisely what DOC-8's "TanStack has no axis-id
 * concept — confirmed" means in practice. Marks receive their y through that
 * one scale via a plain value accessor (`lineY(data, { y: d => d[key] })`).
 *
 * So a secondary axis is expressed the only way one channel allows: by
 * REPROJECTING the value out of its own axis domain and into the primary axis
 * domain before the shared scale sees it. Both scales would map onto the same
 * pixel range, so the result is pixel-identical to bklit's second scale —
 * `(v - a0)/(a1 - a0)` is the same normalized position either way.
 *
 * The primary axis returns a genuine IDENTITY function, not an arithmetic
 * round-trip that happens to be a no-op. Every chart in the codebase today is
 * single-axis, so every accessor keeps handing TanStack the exact same float it
 * handed it before this task — the safety property that lets a change to the
 * shared y-domain layer not perturb line, area, bar, scatter, candlestick and
 * composed alike (see this charter's "repo-wide risk, not local risk").
 *
 * Degenerate source domain (zero span, or non-finite endpoints) pins to the
 * primary domain's floor, matching d3's own behaviour for a zero-width domain.
 */
export function createAxisValueProjector(
  domainsByAxis: Record<string, YDomain>,
  primaryDomain: YDomain,
): (axisId?: string | number) => (value: number) => number {
  const identity = (value: number) => value;
  return (axisId?: string | number) => {
    const id = normalizeYAxisId(axisId);
    if (id === DEFAULT_Y_AXIS_ID) return identity;
    const source = domainsByAxis[id];
    if (!source || source === primaryDomain) return identity;
    const [a0, a1] = source;
    const [p0, p1] = primaryDomain;
    if (a0 === p0 && a1 === p1) return identity;
    const span = a1 - a0;
    if (!Number.isFinite(span) || span === 0) return () => p0;
    const scale = (p1 - p0) / span;
    return (value: number) => p0 + (value - a0) * scale;
  };
}

/**
 * Per-axis lookup with legacy's fallback chain
 * (`buildYScalesFromDomains:97-101`): the requested axis, else the default
 * axis, else `[0, 100]`. Used by consumers that hold a `yAxisId` and need the
 * domain it resolves to — reference areas being the motivating case (RA2).
 */
export function domainForAxis(
  domainsByAxis: Record<string, YDomain>,
  axisId: string,
): YDomain {
  return domainsByAxis[axisId] ?? domainsByAxis[DEFAULT_Y_AXIS_ID] ?? [0, 100];
}

/* ────────────────────────────────────────────────────────────────────────
   P6.2 / T-E1b — the per-axis scale layer's public hook surface.

   bklit exports `useYScale` (`chart-context.tsx:388`, barrel `index.ts:127`)
   and `useAnimatedYDomains` (`use-animated-y-domains.ts:124`, barrel
   `index.ts:605`). Both are legacy PUBLIC API, so component-API parity needs
   them here — but neither can be a straight port: bklit's `useYScale` reads
   `yScales` off `ChartProvider`, and migrated has no such context (the reason
   P6.1's whole scale layer is explicit-argument functions rather than hooks).
   These wrappers therefore take as ARGUMENTS exactly what bklit reads from
   context, and delegate to the P6.1 functions above so there is one
   implementation of the fallback chain and the nicing, not two.
   ──────────────────────────────────────────────────────────────────────── */

/**
 * bklit `useYScale(yAxisId?)` — the niced y-scale a `yAxisId` resolves to.
 *
 * Divergence from legacy, forced and deliberate: `domainsByAxis` + `innerHeight`
 * are parameters instead of context reads. Behaviour is otherwise bklit's:
 * `normalizeYAxisId` maps `undefined`/`""` to `"left"`, and `domainForAxis`
 * applies the same requested-axis → default-axis → `[0, 100]` chain legacy's
 * `yScales[id] ?? yScale` + `buildYScalesFromDomains:97-101` produce together.
 *
 * The returned scale is `.nice()`d, matching every in-repo consumer of this
 * layer (marks are projected into the NICED primary domain — see
 * `createAxisValueProjector`), and is memoized on its inputs so callers can put
 * it straight into a dependency array.
 */
export function useYScale(
  domainsByAxis: Record<string, YDomain>,
  innerHeight: number,
  yAxisId?: string | number,
): NicedYScale {
  const domain = domainForAxis(domainsByAxis, normalizeYAxisId(yAxisId));
  const d0 = domain[0];
  const d1 = domain[1];
  return React.useMemo(
    () => createNicedYScale([d0, d1]).range([innerHeight, 0]),
    [d0, d1, innerHeight],
  );
}

/** bklit `y-domain-utils.ts:112` — value-compare of two per-axis records. */
export function domainsEqual(
  left: Record<string, YDomain>,
  right: Record<string, YDomain>,
): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  for (const axisId of leftKeys) {
    const from = left[axisId];
    const to = right[axisId];
    if (!(from && to) || from[0] !== to[0] || from[1] !== to[1]) return false;
  }
  return true;
}

/**
 * bklit `y-domain-utils.ts:19` — is this domain move big enough to be worth
 * animating? Normalized against the larger span (floored at 1) so the test is
 * scale-free.
 */
export function shouldTweenYDomain(from: YDomain, to: YDomain): boolean {
  const span = Math.max(Math.abs(to[1] - to[0]), Math.abs(from[1] - from[0]), 1);
  const deltaMin = Math.abs(to[0] - from[0]) / span;
  const deltaMax = Math.abs(to[1] - from[1]) / span;
  return (
    deltaMin >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD ||
    deltaMax >= Y_DOMAIN_TWEEN_SKIP_THRESHOLD
  );
}

/** bklit `y-domain-utils.ts:46` — the two phases whose whole purpose is the tween. */
export function isYDomainTweenPhase(phase: ChartPhase): boolean {
  return phase === "gridTweenLoading" || phase === "gridTweenReady";
}

/**
 * bklit `y-domain-utils.ts:57` — which record the grid should be heading for in
 * a given phase. `default` returns the target, matching legacy's switch.
 */
export function resolveAnimatedYDestinationDomains(
  chartPhase: ChartPhase,
  skeletonByAxis: Record<string, YDomain>,
  targetByAxis: Record<string, YDomain>,
): Record<string, YDomain> {
  switch (chartPhase) {
    case "loading":
    case "exiting":
    case "gridTweenLoading":
      return skeletonByAxis;
    default:
      return targetByAxis;
  }
}
