"use client";

import * as React from "react";

export function resolveDashTailBounds(
  dashFromIndex: number | undefined,
  dataLength: number
): boolean {
  return (
    dashFromIndex != null &&
    dashFromIndex >= 0 &&
    dashFromIndex < dataLength - 1
  );
}

export function resolveDashStartX(
  data: Record<string, unknown>[],
  dashFromIndex: number,
  xScale: (value: Date | number) => number | undefined,
  xAccessor: (datum: Record<string, unknown>) => Date | number
): number {
  const dashFromPoint = data[dashFromIndex];
  if (!dashFromPoint) {
    return 0;
  }
  return xScale(xAccessor(dashFromPoint)) ?? 0;
}

export interface DashTailSeries {
  dataKey: string;
  stroke: string;
  strokeWidth: number;
  dashFromIndex?: number;
  dashArray?: string;
}

export interface DashTailOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
  width: number;
  height: number;
  margin: { top: number; left: number; right: number; bottom: number };
  renderData: Record<string, unknown>[];
  xDataKey: string;
  series: DashTailSeries[];
  innerWidth: number;
  innerHeight: number;
}

interface Measured {
  pathD: string;
  pathLength: number;
  dashStartX: number;
  dashStartLength: number;
  stroke: string;
  strokeWidth: number;
  dashArray: string;
}

function findSeriesPath(container: HTMLElement | null, dataKey: string): SVGPathElement | null {
  if (!container) return null;
  const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
  if (!marksGroup) return null;
  const escaped = dataKey.replace(/"/g, '\\"');
  const group = marksGroup.querySelector<SVGGElement>(`.ts-chart__line[data-ts-key^="${escaped}:"]`);
  return group?.querySelector<SVGPathElement>("path") ?? null;
}

export function DashTailOverlay(props: DashTailOverlayProps): React.ReactNode {
  const { containerRef, width, height, margin, renderData, xDataKey, series, innerWidth, innerHeight } = props;
  const baseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [measured, setMeasured] = React.useState<Map<string, Measured>>(new Map());

  const activeSeries = React.useMemo(
    () => series.filter((s) => resolveDashTailBounds(s.dashFromIndex, renderData.length)),
    [series, renderData.length]
  );

  React.useLayoutEffect(() => {
    if (activeSeries.length === 0) {
      // No setState here: render already returns null when activeSeries is
      // empty, so a stale `measured` map is invisible, and any setState in
      // this every-render effect (deps get fresh identity from the host's
      // inline `series` prop) livelocks React under the loading pulse's
      // render cadence (React #185 — pending lanes defeat the eager
      // same-state bailout).
      return;
    }
    if (innerWidth <= 0 || innerHeight <= 0) return;
    let cancelled = false;
    let raf = 0;
    // Cap the mount-timing retry: a missing path after this many frames is a
    // wiring defect, not a race — keep polling would re-render every frame.
    let attempts = 0;
    const MAX_ATTEMPTS = 120;

    const doMeasure = () => {
      const container = containerRef.current;
      if (!container) {
        raf = requestAnimationFrame(doMeasure);
        return;
      }
      const marksGroup = container.querySelector<SVGGElement>(".ts-chart__marks");
      if (!marksGroup) {
        raf = requestAnimationFrame(doMeasure);
        return;
      }
      let minTime = Infinity;
      let maxTime = -Infinity;
      for (const d of renderData) {
        const v = (d as Record<string, unknown>)[xDataKey];
        if (v instanceof Date) {
          const t = v.getTime();
          if (t < minTime) minTime = t;
          if (t > maxTime) maxTime = t;
        } else if (typeof v === "number" && Number.isFinite(v)) {
          if (v < minTime) minTime = v;
          if (v > maxTime) maxTime = v;
        }
      }
      // The source path's `d` is drawn by the host chart in the SAME
      // coordinate space as the root chart <svg> itself — the host bakes
      // margin.left/margin.top directly into its scale ranges (chart.x =
      // margin.left) rather than nesting marks under a translated <g>
      // (confirmed live: `.ts-chart__marks` carries no transform, and the
      // seriesA path's `d` starts at "M40,..." for margin.left=40). So
      // dashStartX must land in that SAME absolute space — offset by
      // margin.left — not in local 0..innerWidth inner coordinates.
      const hasTimeDomain = Number.isFinite(minTime) && Number.isFinite(maxTime);
      const xScale = (value: Date | number): number | undefined => {
        if (!hasTimeDomain) return margin.left;
        const range = maxTime - minTime;
        if (range <= 0) return margin.left;
        const t = value instanceof Date ? value.getTime() : typeof value === "number" ? value : 0;
        return margin.left + ((t - minTime) / range) * innerWidth;
      };
      const xAccessor = (datum: Record<string, unknown>): Date | number => datum[xDataKey] as Date | number;

      const next = new Map<string, Measured>();
      let anyMissing = false;
      for (const s of activeSeries) {
        const idx = s.dashFromIndex!;
        const pathEl = findSeriesPath(container, s.dataKey);
        if (!pathEl) {
          anyMissing = true;
          continue;
        }
        const d = pathEl.getAttribute("d");
        const len = d ? pathEl.getTotalLength() : 0;
        if (!d || len <= 0) {
          anyMissing = true;
          continue;
        }
        const dashStartX = resolveDashStartX(renderData, idx, xScale, xAccessor);
        const dashStartLength = (idx / Math.max(1, renderData.length - 1)) * len;
        if (dashStartLength >= len) continue;
        next.set(s.dataKey, {
          pathD: d,
          pathLength: len,
          dashStartX,
          dashStartLength,
          stroke: s.stroke,
          strokeWidth: s.strokeWidth,
          dashArray: s.dashArray ?? "6,4",
        });
      }
      if (!cancelled) {
        // Skip the state write when nothing changed — the retry path would
        // otherwise commit a fresh Map (new identity) every frame.
        setMeasured((prev) => {
          if (prev.size === next.size) {
            let same = true;
            for (const [k, m] of next) {
              const p = prev.get(k);
              if (
                !p ||
                p.pathD !== m.pathD ||
                p.pathLength !== m.pathLength ||
                p.dashStartX !== m.dashStartX ||
                p.stroke !== m.stroke ||
                p.strokeWidth !== m.strokeWidth ||
                p.dashArray !== m.dashArray
              ) {
                same = false;
                break;
              }
            }
            if (same) return prev;
          }
          return next;
        });
      }
      if (anyMissing && !cancelled && attempts < MAX_ATTEMPTS) {
        attempts += 1;
        raf = requestAnimationFrame(doMeasure);
      }
    };

    doMeasure();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [activeSeries, renderData, xDataKey, innerWidth, innerHeight, containerRef, margin.left]);

  if (activeSeries.length === 0 || measured.size === 0) return null;

  // No wrapping translate here: the overlay <svg> is sized/positioned to
  // exactly cover the same box as the host chart's own root <svg> (both are
  // absolutely-positioned at inset:0 within the same container), and the
  // redrawn `pathD` already carries the host's margin baked into its own
  // coordinates. Re-adding translate(margin.left, margin.top) on top of
  // that double-counts the margin and pushes the redrawn line
  // right/down of the original (the defect this overlay exists to avoid).
  return React.createElement(
    "svg",
    { width, height, style: { position: "absolute", inset: 0, pointerEvents: "none" } as React.CSSProperties, "aria-hidden": "true" },
    Array.from(measured.entries()).map(([key, m]) => {
      const clipId = `${baseId}-dash-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      const pad = m.strokeWidth * 2;
      // dashStartX is already absolute (margin.left-inclusive, see xScale
      // above), so the tail extends to margin.left + innerWidth, not to
      // innerWidth alone.
      const tailWidth = Math.max(0, margin.left + innerWidth - m.dashStartX + pad);
      return React.createElement(
        "g",
        { key, "data-bkm-dash-tail": key },
        React.createElement("defs", null, React.createElement("clipPath", { id: clipId }, React.createElement("rect", { x: m.dashStartX - m.strokeWidth, y: margin.top - m.strokeWidth, width: tailWidth, height: innerHeight + pad }))),
        React.createElement("path", { d: m.pathD, fill: "none", stroke: m.stroke, strokeWidth: m.strokeWidth, strokeLinecap: "round", strokeDasharray: `${m.dashStartLength} ${Math.max(1, m.pathLength - m.dashStartLength)}` }),
        React.createElement("path", { d: m.pathD, fill: "none", stroke: m.stroke, strokeWidth: m.strokeWidth, strokeLinecap: "round", strokeDasharray: m.dashArray, clipPath: `url(#${clipId})` })
      );
    })
  );
}
