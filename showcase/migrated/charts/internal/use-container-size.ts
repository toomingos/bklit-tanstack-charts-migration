// Shared container-measurement hooks — one implementation for the
// ResizeObserver lifecycle patterns repeated across the migrated charts.
// Each hook reproduces the exact semantics of the per-chart code it
// replaces (epsilon-guarded state updates, bklit ParentSize debounce,
// fixed-size gating, positive-only measurement); none of them "improve" on
// what the charts were already doing, because these timings/guards are
// benchmark-gated behavior.
//
// The hooks take the component's own `containerRef` (a direct `useRef`
// created at the call site) rather than creating one internally — keeps
// every existing callback/effect that reads `containerRef` stable for
// `react-hooks/exhaustive-deps`, since the rule only treats direct
// `useRef` results as stable.
import * as React from "react";

export interface ChartSize {
  width: number;
  height: number;
}

// ── Width-only (bklit ParentSize parity) ───────────────────────────────

/**
 * Observes the container's width via one ResizeObserver (bklit measures
 * via ParentSize before rendering; the migrated charts do the same — chart
 * mounts on first measure). Updates are epsilon-guarded (0.5px) so reflows
 * that don't change the layout don't re-render. `enabled` gates
 * observation for fixed-size charts (gauge linear); when disabled the
 * width stays at its initial 0.
 */
export function useContainerWidth(
  containerRef: React.RefObject<HTMLDivElement | null>,
  enabled = true,
): number {
  const [width, setWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [enabled, containerRef]);

  return width;
}

/**
 * Same as `useContainerWidth` but debounced 10ms (bklit ParentSize
 * debounceTime parity; audit §4 C4) — prevents resize-drag thrash from
 * recreating the TanStack definition (line/composed charts).
 */
export function useDebouncedContainerWidth(
  containerRef: React.RefObject<HTMLDivElement | null>,
): number {
  const [width, setWidth] = React.useState(0);
  const widthTimerRef = React.useRef<number | null>(null);
  const pendingWidthRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const commitWidth = (w: number) => {
      if (widthTimerRef.current !== null) {
        clearTimeout(widthTimerRef.current);
        widthTimerRef.current = null;
      }
      pendingWidthRef.current = w;
      widthTimerRef.current = window.setTimeout(() => {
        const pending = pendingWidthRef.current;
        widthTimerRef.current = null;
        if (pending === null) return;
        setWidth((prev) => (Math.abs(prev - pending) > 0.5 ? pending : prev));
      }, 10);
    };
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      commitWidth(w);
    });
    ro.observe(el);
    commitWidth(el.getBoundingClientRect().width);
    return () => {
      ro.disconnect();
      if (widthTimerRef.current !== null) {
        clearTimeout(widthTimerRef.current);
        widthTimerRef.current = null;
      }
    };
  }, [containerRef]);

  return width;
}

/**
 * Same as `useDebouncedContainerWidth` but commits width AND height in one
 * debounced state update. The height is the container's real box height —
 * bklit sizes its chart from the measured container in BOTH modes (CSS
 * aspect-ratio default and explicit `style={{height}}` override, e.g. the
 * ChartBrushLayout strip); deriving height from width/aspectRatio alone
 * breaks the explicit-height mode (strip renders width/2 tall inside a
 * 72px box). Same 10ms debounce + 0.5px epsilon as the width-only hook.
 */
export function useDebouncedContainerSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
): ChartSize {
  const [size, setSize] = React.useState<ChartSize>({ width: 0, height: 0 });
  const timerRef = React.useRef<number | null>(null);
  const pendingRef = React.useRef<ChartSize | null>(null);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const commit = (next: ChartSize) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = next;
      timerRef.current = window.setTimeout(() => {
        const pending = pendingRef.current;
        timerRef.current = null;
        if (pending === null) return;
        setSize((prev) =>
          Math.abs(prev.width - pending.width) > 0.5 || Math.abs(prev.height - pending.height) > 0.5
            ? pending
            : prev,
        );
      }, 10);
    };
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      commit({ width: rect.width, height: rect.height });
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    commit({ width: rect.width, height: rect.height });
    return () => {
      ro.disconnect();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [containerRef]);

  return size;
}

// ── Width+height (fixed-or-fluid square charts) ────────────────────────

/**
 * Measures the container's width and height with one ResizeObserver —
 * the polar/square charts (pie/ring/radar/gauge arc, live-line) derive
 * their size from both dimensions. `enabled` gates observation: fixed-size
 * charts pass `false` and derive size from props instead. The initial rect
 * is committed without the epsilon guard, exactly as the per-chart code
 * did.
 */
export function useMeasuredRect(
  containerRef: React.RefObject<HTMLDivElement | null>,
  enabled = true,
): ChartSize {
  const [measured, setMeasured] = React.useState<ChartSize>({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setMeasured((prev) =>
        Math.abs(prev.width - rect.width) > 0.5 || Math.abs(prev.height - rect.height) > 0.5
          ? { width: rect.width, height: rect.height }
          : prev,
      );
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setMeasured({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, [enabled, containerRef]);

  return measured;
}

// ── Positive-size only (heatmap/funnel) ────────────────────────────────

/**
 * Measures the container via `getBoundingClientRect` (initial read + every
 * observer callback) and commits the size only when both dimensions are
 * positive — the heatmap/funnel pattern, which mounts the chart on the
 * first positive measure.
 */
export function usePositiveChartSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
): { w: number; h: number } {
  const [size, setSize] = React.useState({ w: 0, h: 0 });

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize((prev) =>
          Math.abs(prev.w - rect.width) > 0.5 || Math.abs(prev.h - rect.height) > 0.5
            ? { w: rect.width, h: rect.height }
            : prev,
        );
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return size;
}