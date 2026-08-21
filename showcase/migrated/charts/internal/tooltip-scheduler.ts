function defaultDedupeKey<T>(tooltip: T): string {
  if (typeof tooltip === "object" && tooltip !== null && "index" in tooltip && typeof (tooltip as { index: unknown }).index === "number") {
    const { index, x } = tooltip as { index: number; x?: number };
    if (typeof x === "number") return `${index}:${Math.round(x)}`;
    return String(index);
  }
  return JSON.stringify(tooltip);
}

export interface TooltipSchedulerOptions<T> {
  commit(t: T | null): void;
}

export interface TooltipScheduler<T> {
  schedule(tooltip: T, dedupeKey?: string): void;
  clear(): void;
  resetDedupe(): void;
  dispose(): void;
}

export function createTooltipScheduler<T>(options: TooltipSchedulerOptions<T>): TooltipScheduler<T> {
  let lastKey: string | null = null;
  let pending: T | null = null;
  let pendingKey: string | null = null;
  let rafId: number | null = null;

  const commitTooltip = (tooltip: T, key: string) => {
    if (key === lastKey) return;
    lastKey = key;
    options.commit(tooltip);
  };

  return {
    schedule(tooltip: T, dedupeKey?: string) {
      const key = dedupeKey ?? defaultDedupeKey(tooltip);
      pending = tooltip;
      pendingKey = key;
      if (key === lastKey) return;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const next = pending;
        const nextKey = pendingKey;
        if (next !== null && nextKey !== null) commitTooltip(next, nextKey);
      });
    },
    clear() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pending = null;
      pendingKey = null;
      lastKey = null;
      options.commit(null);
    },
    resetDedupe() {
      lastKey = null;
    },
    dispose() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
