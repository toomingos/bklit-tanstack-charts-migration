import * as React from "react";
import { scaleLinear } from "d3-scale";
import { curveNatural } from "d3-shape";
import { area, line } from "d3-shape";
import {
  LINE_LOADING_PULSE_CYCLE_S,
  LINE_LOADING_LOOP_PAUSE_MS,
  LOADING_LABEL_EXIT_S,
  REVEAL_EASE_CSS,
} from "./design-tokens";
import { fadeGradientStops, resolveFadeSides, viewportFadeGradientAttrs } from "./fade-mask";

const CLIP_PADDING = 10;
const DEFAULT_SWEEP_DURATION_S = 2;
const SWEEP_ANGLE_DEG = 25;

function hashFract(n: number): number {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
}

export function getSkeletonHeights(count: number, seed = 0): number[] {
  return Array.from({ length: count }, (_, i) => 20 + Math.floor(hashFract((i + 1) * 12.9898 + seed) * 60));
}

export function LoadingLabel({ text, exiting }: { text: string; exiting?: boolean }) {
  if (!text.trim()) return null;
  return (
    <div
      className="ts-bkm-loading-label-wrap"
      data-bkm-loading-exiting={exiting ? "" : undefined}
      aria-live="polite"
      role="status"
    >
      <span className="ts-bkm-loading-label-text">{text}</span>
    </div>
  );
}

export function LineLoadingPulse({
  pathD,
  width,
  height,
  stroke = "var(--foreground)",
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
  mode = "loop",
  loopEpoch = 0,
  onCycleComplete,
}: {
  pathD: string;
  width: number;
  height: number;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  mode?: "loop" | "exit" | "enter";
  loopEpoch?: number;
  onCycleComplete?: () => void;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `bkm-pulse-clip-${id}`;
  const gradId = `bkm-pulse-grad-${id}`;
  const clipHeight = height + CLIP_PADDING * 2;
  const fadeStops = fadeGradientStops(resolveFadeSides(true));

  const [progress, setProgress] = React.useState(0);
  const animRef = React.useRef<Animation | null>(null);

  React.useEffect(() => {
    const el = document.getElementById(`${clipId}-rect`) as unknown as SVGRectElement | null;
    if (!el || width <= 0) return;
    const half = LINE_LOADING_PULSE_CYCLE_S / 2;
    let cancelled = false;
    const run = (from: number, to: number, dur: number, done?: () => void) => {
      try { animRef.current?.cancel(); } catch { void 0; }
      let start: number | null = null;
      const step = (now: number) => {
        if (cancelled) return;
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / (dur * 1000));
        const cur = from + (to - from) * t;
        setProgress(cur);
        if (t < 1) requestAnimationFrame(step);
        else done?.();
      };
      requestAnimationFrame(step);
    };
    if (mode === "loop") {
      setProgress(0);
      run(0, 1, LINE_LOADING_PULSE_CYCLE_S, () => {
        if (!cancelled) {
          window.setTimeout(() => onCycleComplete?.(), LINE_LOADING_LOOP_PAUSE_MS);
        }
      });
    } else if (mode === "enter") {
      setProgress(0);
      run(0, 0.5, half, () => { if (!cancelled) onCycleComplete?.(); });
    } else if (mode === "exit") {
      const cur = progress;
      if (cur < 0.5) {
        run(cur, 0.5, half * ((0.5 - cur) / 0.5), () => {
          if (!cancelled) run(0.5, 1, half, () => { if (!cancelled) onCycleComplete?.(); });
        });
      } else {
        run(cur, 1, half * ((1 - cur) / 0.5), () => { if (!cancelled) onCycleComplete?.(); });
      }
    }
    return () => { cancelled = true; };
  }, [width, loopEpoch, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const paddedW = width + CLIP_PADDING * 2;
  const rightEdge = width + CLIP_PADDING;
  const clipW = progress <= 0.5 ? (progress / 0.5) * paddedW : (1 - (progress - 0.5) / 0.5) * paddedW;
  const clipX = progress <= 0.5 ? -CLIP_PADDING : rightEdge - clipW;

  if (width <= 0 || !pathD) return null;

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect id={`${clipId}-rect`} height={clipHeight} width={clipW} x={clipX} y={-CLIP_PADDING} />
        </clipPath>
        <linearGradient id={gradId} {...viewportFadeGradientAttrs(width)}>
          {fadeStops.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={stroke} stopOpacity={s.opacity} />
          ))}
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill="none"
        clipPath={`url(#${clipId})`}
        stroke={`url(#${gradId})`}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        opacity={strokeOpacity}
      />
    </>
  );
}

export function LineLoadingSweep({
  width,
  height,
  stroke = "var(--foreground)",
  strokeOpacity = 0.55,
  strokeWidth = 2,
  withArea = false,
  curve = curveNatural,
  pointCount = 14,
  durationSeconds = DEFAULT_SWEEP_DURATION_S,
  mode = "loop",
  onTransitionComplete,
  seed = 0,
}: {
  width: number;
  height: number;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  withArea?: boolean;
  curve?: unknown;
  pointCount?: number;
  durationSeconds?: number;
  mode?: "loop" | "exit" | "enter";
  onTransitionComplete?: () => void;
  seed?: number;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const chartId = `bkm-sweep-${id}`;
  const heights = React.useMemo(() => getSkeletonHeights(pointCount, seed), [pointCount, seed]);
  if (width <= 0 || height <= 0 || heights.length < 2) return null;

  const xScale = scaleLinear().domain([0, heights.length - 1]).range([0, width]);
  const yScale = scaleLinear().domain([0, 100]).range([height, 0]);
  const points = heights.map((value, index) => ({ index, value }));
  const lineGen = line<{ index: number; value: number }>()
    .x((d) => xScale(d.index) ?? 0)
    .y((d) => yScale(d.value) ?? 0)
    .curve(curve as never);
  const areaGen = area<{ index: number; value: number }>()
    .x((d) => xScale(d.index) ?? 0)
    .y1((d) => yScale(d.value) ?? 0)
    .y0(yScale(0) ?? height)
    .curve(curve as never);
  const lineD = lineGen(points) ?? "";
  const areaD = withArea ? (areaGen(points) ?? "") : "";

  const exiting = mode === "exit";
  const entering = mode === "enter";
  const maskId = `${chartId}-mask`;
  const gradId = `${chartId}-grad`;
  const patId = `${chartId}-pat`;

  return (
    <>
      <defs>
        {withArea ? (
          <linearGradient id={`${chartId}-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
          </linearGradient>
        ) : null}
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {Array.from({ length: 17 }, (_, i) => {
            const t = i / 16;
            const eased = Math.sin(t * Math.PI) ** 2;
            const opacity = 0.05 + eased * 0.85;
            return <stop key={i} offset={`${(t * 100).toFixed(0)}%`} stopColor="white" stopOpacity={Number(opacity.toFixed(3))} />;
          })}
        </linearGradient>
        <pattern id={patId} width={3} height="1" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" patternTransform={`rotate(${SWEEP_ANGLE_DEG})`}>
          <rect
            className="ts-bkm-sweep-band"
            style={{ animationDuration: `${durationSeconds}s` } as React.CSSProperties}
            x={-1}
            y={0}
            width={1}
            height={1}
            fill={`url(#${gradId})`}
          />
        </pattern>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect width={width} height={height} fill={`url(#${patId})`} />
        </mask>
      </defs>
      <g
        mask={`url(#${maskId})`}
        opacity={exiting ? 0 : 1}
        style={
          exiting || entering
            ? { transition: `opacity ${LOADING_LABEL_EXIT_S}s ${REVEAL_EASE_CSS}`, opacity: exiting ? 0 : 1 }
            : undefined
        }
        onTransitionEnd={exiting || entering ? onTransitionComplete : undefined}
      >
        {withArea && areaD ? <path d={areaD} fill={`url(#${chartId}-area)`} /> : null}
        <path d={lineD} fill="none" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={strokeWidth} strokeLinecap="round" />
      </g>
    </>
  );
}

export function BarLoadingSkeleton({
  innerWidth,
  innerHeight,
  barCount = 12,
  fill = "var(--foreground)",
  fillOpacity = 0.45,
  baseline = "bottom",
  barFraction = 0.7,
  durationSeconds = DEFAULT_SWEEP_DURATION_S,
  seed = 0,
}: {
  innerWidth: number;
  innerHeight: number;
  barCount?: number;
  fill?: string;
  fillOpacity?: number;
  baseline?: "bottom" | "center";
  barFraction?: number;
  durationSeconds?: number;
  seed?: number;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const chartId = `bkm-bar-sweep-${id}`;
  const heights = React.useMemo(() => getSkeletonHeights(barCount, seed), [barCount, seed]);
  if (innerWidth <= 0 || innerHeight <= 0) return null;
  const bandW = innerWidth / heights.length;
  const barW = bandW * barFraction;
  const xOff = (bandW * (1 - barFraction)) / 2;
  const isCenter = baseline === "center";
  const baselineY = isCenter ? innerHeight / 2 : innerHeight;
  const halfH = isCenter ? innerHeight / 2 : innerHeight;
  const maskId = `${chartId}-mask`;
  const gradId = `${chartId}-grad`;
  const patId = `${chartId}-pat`;

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {Array.from({ length: 17 }, (_, i) => {
            const t = i / 16;
            const eased = Math.sin(t * Math.PI) ** 2;
            const opacity = 0.05 + eased * 0.85;
            return <stop key={i} offset={`${(t * 100).toFixed(0)}%`} stopColor="white" stopOpacity={Number(opacity.toFixed(3))} />;
          })}
        </linearGradient>
        <pattern id={patId} width={3} height="1" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" patternTransform={`rotate(${SWEEP_ANGLE_DEG})`}>
          <rect className="ts-bkm-sweep-band" style={{ animationDuration: `${durationSeconds}s` } as React.CSSProperties} x={-1} y={0} width={1} height={1} fill={`url(#${gradId})`} />
        </pattern>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect width={innerWidth} height={innerHeight} fill={`url(#${patId})`} />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        {heights.map((value, i) => {
          const barH = Math.max(1, halfH * (value / 100));
          const x = i * bandW + xOff;
          const y = baselineY - barH;
          return <rect key={`${x.toFixed(2)}-${value}`} x={x} y={y} width={barW} height={barH} rx={2} fill={fill} fillOpacity={fillOpacity} />;
        })}
      </g>
    </>
  );
}

export function generateChartSkeletonData(opts: { dataKey?: string; pointCount?: number; baseDate?: Date } = {}): Record<string, unknown>[] {
  const dataKey = opts.dataKey ?? "value";
  const pointCount = opts.pointCount ?? 7;
  const baseDate = opts.baseDate ?? new Date("2025-01-01");
  return Array.from({ length: pointCount }, (_, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    return { date, [dataKey]: Math.round(110 + Math.sin(index * 1.15) * 36 + index * 9) as unknown as number };
  });
}
