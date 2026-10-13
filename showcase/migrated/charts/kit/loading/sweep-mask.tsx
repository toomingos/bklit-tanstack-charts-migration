// Standalone bklit loading-sweep.tsx: a CSS-animated shimmer band (styles.css `bkm-sweep-travel`) crosses a seeded
// skeleton silhouette through an SVG mask; it re-rolls once per pass, when the band is off-screen.
import { useMemo } from "react";
import type { ReactElement } from "react";


/** One shimmer sweep, in seconds. */
export const DEFAULT_SWEEP_DURATION_S = 2;
const SWEEP_ANGLE_DEG = 25;
const HEIGHT_MIN_PCT = 20;
const HEIGHT_MAX_PCT = 80;

// Heights come from a deterministic hash of (index, seed), never Math.random(), so server and client renders agree.
export const hashFract = (n: number): number => {
  const x = Math.sin(n) * 43_758.5453;
  return x - Math.floor(x);
};

export const skeletonHeights = (count: number, seed: number): number[] =>
  Array.from(
    { length: count },
    (_unused, i) =>
      HEIGHT_MIN_PCT +
      Math.floor(
        hashFract((i + 1) * 12.9898 + seed) * (HEIGHT_MAX_PCT - HEIGHT_MIN_PCT)
      )
  );

/** Bell-curve opacity stops (sin squared) for the band's soft edges. */
const BAND_STOPS = Array.from({ length: 17 }, (_unused, i) => {
  const t = i / 16;
  return {
    offset: `${(t * 100).toFixed(0)}%`,
    opacity: Number((0.05 + Math.sin(t * Math.PI) ** 2 * 0.85).toFixed(3)),
  };
});

export interface SweepMaskProps {
  readonly chartId: string;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly onSweepComplete: () => void;
}

export const SweepMask = ({
  chartId,
  width,
  height,
  durationSeconds,
  onSweepComplete,
}: SweepMaskProps): ReactElement => {
  const style = useMemo(
    () => ({
      "--bkm-sweep-w": `${width}px`,
      animation: `bkm-sweep-travel ${durationSeconds}s linear infinite`,
    }),
    [width, durationSeconds]
  );
  return (
    <>
      <linearGradient id={`${chartId}-grad`} x1="0" x2="1" y1="0" y2="0">
        {BAND_STOPS.map(({ offset, opacity }) => (
          <stop
            key={offset}
            offset={offset}
            stopColor="white"
            stopOpacity={opacity}
          />
        ))}
      </linearGradient>
      <mask id={`${chartId}-mask`} maskUnits="userSpaceOnUse">
        {/* Oversized rect so the rotated band still covers the plot corners. */}
        <g transform={`rotate(${SWEEP_ANGLE_DEG} ${width / 2} ${height / 2})`}>
          <rect
            fill={`url(#${chartId}-grad)`}
            height={height * 3}
            onAnimationIteration={onSweepComplete}
            style={style}
            width={width}
            x={0}
            y={-height}
          />
        </g>
      </mask>
    </>
  );
};
