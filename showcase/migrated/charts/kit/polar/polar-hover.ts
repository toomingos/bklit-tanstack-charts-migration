// Shared plumbing for PieChart and RingChart: the hover source, native focus bridge, annulus focus strategy and child classifier.
// The native focus engine is the single hover source (pointer and keyboard); a controlled `hoveredIndex` overrides the store.
import { Children, isValidElement, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import type { ChartFocusStrategy, ChartPoint } from "@tanstack/charts";
import { TAU } from "./tau";
import { readHoverIndex, writeHoverIndex } from "../host-write";

/** Pub/sub hover index consumed by the center stats and the public hover hooks. */
interface HoverSource {
  readonly getHovered: () => number | null;
  readonly setHovered: (index: number | null) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

type HoverReader = Readonly<Pick<HoverSource, "getHovered" | "subscribe">>;

const createHoverSource = (): HoverSource => {
  let current: number | null = null;
  const listeners = new Set<() => void>();
  return {
    getHovered: () => current,
    setHovered: (next) => {
      if (next === current) { return; }
      current = next;
      for (const listener of listeners) { listener(); }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
};

const useHoverIndex = (source: HoverReader): number | null =>
  useSyncExternalStore(source.subscribe, source.getHovered, source.getHovered);

/** Hover index committed on React's default lane (a scheduler task after the pointer event, as bklit's setState), so a consumer's heavy commit stays out of the pointer task. */
const useScheduledHoverIndex = (source: HoverReader): number | null => {
  const [index, setIndex] = useState(source.getHovered);
  useEffect(() => {
    const sync = (): void => { setIndex(source.getHovered()); };
    sync();
    return source.subscribe(sync);
  }, [source]);
  return index;
};

/** Mirrors the hover index onto `host` as `data-hover` imperatively (no render); static CSS keys off it. `onChange` runs right after the write
 * (same task, before paint) so a spring driver can retarget from live state. */
// oxlint-disable-next-line max-params -- the positional signature is shared by the pie and ring charts
const useHostHoverAttr = (source: HoverReader, hostRef: RefObject<HTMLElement | null>, enabled: boolean, remountKey: unknown, maxIndex: number, onChange?: (host: HTMLElement, previous: number | null, next: number | null) => void): void => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    let last: number | null = null;
    const apply = (): void => {
      const host = hostRef.current;
      if (!host) { return; }
      const raw = enabled ? source.getHovered() : null;
      const index = raw === null || raw >= maxIndex ? null : raw;
      if (index === last) { return; }
      const previous = readHoverIndex(host);
      last = index;
      writeHoverIndex(host, index);
      onChangeRef.current?.(host, previous, index);
    };
    apply();
    return source.subscribe(apply);
  }, [source, hostRef, enabled, remountKey, maxIndex]);
};

interface PolarHoverOptions<TDatum> {
  readonly indexOf: (datum: TDatum) => number;
  readonly hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
}

interface PolarHover<TDatum> {
  readonly source: HoverSource;
  readonly controlled: boolean;
  readonly handleFocusChange: (point: ChartPoint<TDatum, number, number> | null) => void;
}

const usePolarHover = <TDatum>(options: Readonly<PolarHoverOptions<TDatum>>): PolarHover<TDatum> => {
  const { hoveredIndex, onHoverChange, indexOf } = options;
  const [source] = useState<HoverSource>(() => createHoverSource());
  const controlled = hoveredIndex !== undefined;

  useEffect(() => {
    if (hoveredIndex !== undefined) { source.setHovered(hoveredIndex); }
  }, [hoveredIndex, source]);

  const handleFocusChange = useCallback((point: ChartPoint<TDatum, number, number> | null): void => {
    const next = point === null ? null : indexOf(point.datum);
    if (!controlled) { source.setHovered(next); }
    onHoverChange?.(next);
  }, [controlled, indexOf, onHoverChange, source]);

  return { controlled, handleFocusChange, source };
};

// Annulus focus: the nearest-point resolution drops focus for thin rings or pop-outs, so the static sectors are hit-tested instead.
interface AnnulusTarget {
  readonly index: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly startAngle: number;
  readonly endAngle: number;
}

interface AnnularFocusOptions<TDatum> {
  readonly center: number;
  readonly targets: readonly AnnulusTarget[];
  readonly indexOf: (datum: TDatum) => number;
  /** Points that take part in focus (excludes underlay marks). */
  readonly focusable: (point: ChartPoint<TDatum, number, number>) => boolean;
  /** Points keyboard navigation steps through (one per index). */
  readonly navigable: (point: ChartPoint<TDatum, number, number>) => boolean;
  /** Hover-scale of a target while `hovered` is the focused index (the painted ring scales about the centre, so its hit area does too). */
  readonly scaleOf?: (index: number, hovered: number | null) => number;
  readonly hovered?: () => number | null;
}

const EDGE_EPSILON = 1e-9;

const insideSector = (target: Readonly<AnnulusTarget>, radius: number, angle: number): boolean => {
  if (radius < target.innerRadius || radius > target.outerRadius) { return false; }
  // The apex belongs to every sector (each painted path runs through it); the angle there is undefined.
  if (radius < EDGE_EPSILON) { return true; }
  const sweep = target.endAngle - target.startAngle;
  if (sweep >= TAU) { return true; }
  const wrapped = (((angle - target.startAngle) % TAU) + TAU) % TAU;
  // A pointer on a shared edge counts as inside both neighbours (SVG fill hit-testing is edge-inclusive); float noise must not decide.
  const offset = wrapped > TAU - EDGE_EPSILON ? 0 : wrapped;
  return offset <= sweep + EDGE_EPSILON;
};

const createAnnularFocus = <TDatum>(options: Readonly<AnnularFocusOptions<TDatum>>): ChartFocusStrategy<TDatum, number, number> => {
  const { center, targets, indexOf, focusable, navigable, scaleOf, hovered } = options;
  type Point = ChartPoint<TDatum, number, number>;
  // The engine passes the same `points` array until the scene changes: bucket once per array, so a move does not filter every point.
  let bucketed: readonly Point[] | null = null;
  let buckets = new Map<number, Point[]>();
  const ofIndex = (points: readonly Point[], index: number): Point[] => {
    if (bucketed !== points) {
      buckets = new Map();
      for (const point of points) {
        if (!focusable(point)) { continue; }
        const key = indexOf(point.datum);
        const bucket = buckets.get(key);
        if (bucket) { bucket.push(point); } else { buckets.set(key, [point]); }
      }
      bucketed = points;
    }
    return buckets.get(index)?.slice() ?? [];
  };
  // Later targets paint on top; test them first.
  const reversed = targets.toReversed();
  return {
    group: (points, { point }) => ofIndex(points, indexOf(point.datum)),
    navigation: (points) => points.filter(navigable).toSorted((left, right) => indexOf(left.datum) - indexOf(right.datum)),
    resolve: (points, { x, y }) => {
      const dx = x - center;
      const dy = y - center;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dx, -dy);
      const current = hovered?.() ?? null;
      for (const target of reversed) {
        const scale = scaleOf ? scaleOf(target.index, current) : 1;
        const scaled = scale === 1 ? target : { ...target, innerRadius: target.innerRadius * scale, outerRadius: target.outerRadius * scale };
        if (insideSector(scaled, radius, angle)) { return ofIndex(points, target.index); }
      }
      return [];
    },
  };
};

// --- Children --------------------------------------------------------------------------------
interface ClassifyPolarOptions<TConfig> {
  readonly isCenter: (child: ReactElement) => boolean;
  readonly isDefs?: (child: ReactElement) => boolean;
  readonly configOf?: (child: ReactElement) => TConfig | undefined;
}

interface ClassifiedPolarChildren<TConfig> {
  readonly centerChildren: ReactNode[];
  readonly configs: TConfig[];
  readonly defsChildren: ReactElement[];
}

/** Splits children into the center overlay, SVG resource defs and config carriers (Slice/Ring). */
const classifyPolarChildren = <TConfig>(children: ReactNode, options: Readonly<ClassifyPolarOptions<TConfig>>): ClassifiedPolarChildren<TConfig> => {
  const centerChildren: ReactNode[] = [];
  const defsChildren: ReactElement[] = [];
  const configs: TConfig[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) { return; }
    if (options.isCenter(child)) {
      centerChildren.push(child);
    } else if (options.isDefs?.(child) === true) {
      defsChildren.push(child);
    } else {
      const config = options.configOf?.(child);
      if (config !== undefined) { configs.push(config); }
    }
  });
  return { centerChildren, configs, defsChildren };
};

export { classifyPolarChildren, createAnnularFocus, createHoverSource, useHoverIndex, useHostHoverAttr, usePolarHover, useScheduledHoverIndex };
export type { AnnulusTarget, HoverSource };
