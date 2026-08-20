import { isChartInteractionPhase } from "./chart-phase";
import type { ChartPhase } from "./chart-phase";

export interface ReanchorOptions {
  chartPhase: ChartPhase;
  isLoaded: boolean;
  lastX: number | null;
  renderData: unknown[];
  xScale: { invert(x: number): Date; (v: Date): number | undefined | null } | null;
  xDataKey: string;
  resolvePoints: (x: number, index: number, datum: unknown) => unknown[] | null;
  onReanchor: (points: unknown[]) => void;
  onClear: () => void;
}

function bisectDateLeft(data: unknown[], xDataKey: string, targetMs: number): number {
  let lo = 0, hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const v = (data[mid] as Record<string, unknown>)[xDataKey];
    const ms = v instanceof Date ? v.getTime() : NaN;
    if (ms < targetMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function reanchorHoverChrome(opts: ReanchorOptions): void {
  if (!isChartInteractionPhase(opts.chartPhase) || !opts.isLoaded) return;
  if (opts.lastX === null || !opts.xScale || opts.renderData.length === 0) return;
  const x0 = opts.xScale.invert(opts.lastX);
  const ms = x0.getTime();
  const idx = bisectDateLeft(opts.renderData, opts.xDataKey, ms);
  const d0 = opts.renderData[idx - 1] as Record<string, unknown> | undefined;
  const d1 = opts.renderData[idx] as Record<string, unknown> | undefined;
  if (!d0) { opts.onClear(); return; }
  let d: Record<string, unknown> = d0;
  let fi = idx - 1;
  if (d1) {
    const t0 = (d0[opts.xDataKey] as Date).getTime();
    const t1 = (d1[opts.xDataKey] as Date).getTime();
    if (ms - t0 > t1 - ms) { d = d1; fi = idx; }
  }
  const pxRaw = opts.xScale(d[opts.xDataKey] as Date);
  if (pxRaw == null || !Number.isFinite(pxRaw)) { opts.onClear(); return; }
  const points = opts.resolvePoints(pxRaw as number, fi, d);
  if (points && points.length > 0) opts.onReanchor(points);
  else opts.onClear();
}
