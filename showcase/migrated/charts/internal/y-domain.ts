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

/**
 * bklit `resolveTimeSeriesYDomain`: all-values>=0 -> [0, max*1.1]; mixed-sign
 * -> [min,max] padded 5% each side; empty -> [0,100]. Pure — same inputs
 * always produce the same tuple. Only `dataKey` is read from each series.
 */
export function resolveTimeSeriesYDomain(
  data: readonly ChartDatum[],
  series: readonly { dataKey: string }[],
): [number, number] {
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
