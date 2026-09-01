// Shared container-measurement hooks — one implementation for the
// ResizeObserver lifecycle patterns repeated across the migrated charts.
// Each public hook below is a thin wrapper over `useResizeObservation`,
// configured to reproduce the exact semantics of the per-chart code it
// replaces (epsilon-guarded state updates, bklit ParentSize debounce,
// fixed-size gating, positive-only measurement); none of them "improve" on
// what the charts were already doing, because these timings/guards are
// benchmark-gated behavior. See each wrapper's doc comment for the specific
// behavior it preserves.
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

interface UseResizeObservationOptions {
  /** Gates whether an observer is mounted at all (default true). When
   *  false, the effect returns before touching `ResizeObserver` — no
   *  observer is constructed, not merely one that's ignored. Fixed-size
   *  charts pass `false` and derive their size from props instead. */
  enabled?: boolean;
  /** bklit ParentSize debounceTime parity (audit §4 C4): when > 0, both the
   *  initial measurement and every observer callback are coalesced through
   *  a single `setTimeout`, so only the last measurement inside the window
   *  is committed. 0 (default) commits synchronously. */
  debounceMs?: number;
  /** Whether the FIRST measurement (the `getBoundingClientRect` read taken
   *  before the observer's first callback can fire) is epsilon-guarded like
   *  every subsequent one, or committed directly. Ignored when `debounceMs`
   *  is set, since the debounce path always funnels every commit — initial
   *  included — through the same guarded setter. */
  guardInitial?: boolean;
  /** Only commit a measurement when both dimensions are positive — the
   *  heatmap/funnel pattern, which mounts the chart on the first positive
   *  measure and otherwise leaves the state untouched. */
  requirePositive?: boolean;
}

/**
 * Single ResizeObserver lifecycle shared by every hook in this file.
 * Mounts (or doesn't — see `enabled`) one observer on `containerRef`,
 * commits `{width, height}` from `contentRect`, and tears it down on
 * unmount. `debounceMs`, `guardInitial`, and `requirePositive` parameterize
 * the exact per-hook differences below rather than unifying them away —
 * each public hook fixes these to reproduce its original behavior exactly.
 */
function useResizeObservation(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { enabled = true, debounceMs = 0, guardInitial = false, requirePositive = false }: UseResizeObservationOptions,
): ChartSize {
  const [size, setSize] = React.useState<ChartSize>({ width: 0, height: 0 });
  const timerRef = React.useRef<number | null>(null);
  const pendingRef = React.useRef<ChartSize | null>(null);

  React.useLayoutEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const applyGuarded = (next: ChartSize) => {
      setSize((prev) =>
        Math.abs(prev.width - next.width) > 0.5 || Math.abs(prev.height - next.height) > 0.5
          ? next
          : prev,
      );
    };

    const commit = (next: ChartSize, guarded: boolean) => {
      if (requirePositive && !(next.width > 0 && next.height > 0)) return;
      if (debounceMs > 0) {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        pendingRef.current = next;
        timerRef.current = window.setTimeout(() => {
          const pending = pendingRef.current;
          timerRef.current = null;
          if (pending === null) return;
          applyGuarded(pending);
        }, debounceMs);
        return;
      }
      if (guarded) {
        applyGuarded(next);
      } else {
        setSize(next);
      }
    };

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      commit({ width: rect.width, height: rect.height }, true);
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    commit({ width: rect.width, height: rect.height }, guardInitial);
    return () => {
      ro.disconnect();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, debounceMs, guardInitial, requirePositive, containerRef]);

  return size;
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
  const { width } = useResizeObservation(containerRef, { enabled });
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
  const { width } = useResizeObservation(containerRef, { debounceMs: 10 });
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
  return useResizeObservation(containerRef, { debounceMs: 10 });
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
  return useResizeObservation(containerRef, { enabled });
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
  const { width, height } = useResizeObservation(containerRef, {
    guardInitial: true,
    requirePositive: true,
  });
  return { w: width, h: height };
}
