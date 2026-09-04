import { useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

// One shared ResizeObserver lifecycle; per-hook debounce/guard/positivity reproduce legacy timing exactly.
interface ChartSize {
  readonly width: number;
  readonly height: number;
}

interface UseResizeObservationOptions {
  readonly enabled?: boolean;
  readonly debounceMs?: number;
  readonly guardInitial?: boolean;
  readonly requirePositive?: boolean;
}

// Sub-pixel resize deltas below this are noise from the observer; keep the last size.
const RESIZE_GUARD_EPSILON_PX = 0.5;

type ResizeSetter = Dispatch<SetStateAction<ChartSize>>;

const applyGuardedSize = (setSize: ResizeSetter, next: ChartSize): void => {
  setSize((prev) => Math.abs(prev.width - next.width) > RESIZE_GUARD_EPSILON_PX || Math.abs(prev.height - next.height) > RESIZE_GUARD_EPSILON_PX
      ? next
      : prev,
  );
}

const clearPendingTimer = (timerRef: { current: ReturnType<typeof globalThis.setTimeout> | undefined }): void => {
  if (timerRef.current !== undefined) {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }
}

interface ScheduleDebouncedCommitParams {
  readonly next: ChartSize;
  readonly debounceMs: number;
  readonly setSize: ResizeSetter;
  readonly timerRef: { current: ReturnType<typeof globalThis.setTimeout> | undefined };
  readonly pendingRef: { current: ChartSize | undefined };
}

const scheduleDebouncedCommit = ({ next, debounceMs, setSize, timerRef, pendingRef }: ScheduleDebouncedCommitParams): void => {
  clearPendingTimer(timerRef);
  pendingRef.current = next;
  timerRef.current = globalThis.setTimeout(() => {
    const pending = pendingRef.current;
    timerRef.current = undefined;
    if (pending === undefined) {return;}
    applyGuardedSize(setSize, pending);
  }, debounceMs);
}

interface CommitResizeParams {
  readonly next: ChartSize;
  readonly guarded: boolean;
  readonly requirePositive: boolean;
  readonly debounceMs: number;
  readonly setSize: ResizeSetter;
  readonly timerRef: { current: ReturnType<typeof globalThis.setTimeout> | undefined };
  readonly pendingRef: { current: ChartSize | undefined };
}

const commitResizeUpdate = ({ next, guarded, requirePositive, debounceMs, setSize, timerRef, pendingRef }: CommitResizeParams): void => {
  if (requirePositive && !(next.width > 0 && next.height > 0)) {return;}
  if (debounceMs > 0) {
    scheduleDebouncedCommit({ debounceMs, next, pendingRef, setSize, timerRef });
    return;
  }
  if (guarded) {
    applyGuardedSize(setSize, next);
  } else {
    setSize(next);
  }
}

const handleResizeEntries = (entries: readonly ResizeObserverEntry[], commit: (next: ChartSize, guarded: boolean) => void): void => {
  const rect = entries.at(0)?.contentRect;
  if (rect === undefined) {return;}
  commit({ height: rect.height, width: rect.width }, true);
}

const readElementSize = (el: HTMLDivElement): ChartSize => {
  const rect = el.getBoundingClientRect();
  return { height: rect.height, width: rect.width };
}

const useResizeObservation = (containerRef: RefObject<HTMLDivElement | null>, { enabled = true, debounceMs = 0, guardInitial = false, requirePositive = false }: Readonly<UseResizeObservationOptions>): ChartSize => {
  const [size, setSize] = useState<ChartSize>({ height: 0, width: 0 });
  const timerRef = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined);
  const pendingRef = useRef<ChartSize | undefined>(undefined);

  useLayoutEffect(() => {
    if (!enabled) {return undefined;}
    const el = containerRef.current;
    if (!el) {return undefined;}
    const commit = (next: ChartSize, guarded: boolean): void => {
      commitResizeUpdate({ debounceMs, guarded, next, pendingRef, requirePositive, setSize, timerRef });
    };
    const ro = new ResizeObserver((entries) => {
      handleResizeEntries(entries, commit);
    });
    ro.observe(el);
    commit(readElementSize(el), guardInitial);
    return (): void => {
      ro.disconnect();
      clearPendingTimer(timerRef);
    };
  }, [enabled, debounceMs, guardInitial, requirePositive, containerRef]);

  return size;
}

const useContainerWidth = (containerRef: RefObject<HTMLDivElement | null>, enabled = true): number => {
  const { width } = useResizeObservation(containerRef, { enabled });
  return width;
}

const useDebouncedContainerWidth = (containerRef: RefObject<HTMLDivElement | null>): number => {
  const { width } = useResizeObservation(containerRef, { debounceMs: 10 });
  return width;
}

const useDebouncedContainerSize = (containerRef: RefObject<HTMLDivElement | null>): ChartSize => useResizeObservation(containerRef, { debounceMs: 10 });


const useMeasuredRect = (containerRef: RefObject<HTMLDivElement | null>, enabled = true): ChartSize => useResizeObservation(containerRef, { enabled });


const usePositiveChartSize = (containerRef: RefObject<HTMLDivElement | null>): ChartSize => {
  const { width, height } = useResizeObservation(containerRef, {
    guardInitial: true,
    requirePositive: true,
  });
  return { height, width };
}

export { useContainerWidth, useDebouncedContainerWidth, useDebouncedContainerSize, useMeasuredRect, usePositiveChartSize };
export type { ChartSize };
