// Native TanStack Charts equivalent of bklit's ring-chart docs demo,
// expressed via `@tanstack/charts/polar`'s `polar()` + `radialArc` -- there
// is no single worked "concentric rings" recipe in
// repos/tanstack-charts/docs/examples/polar-and-radar.md, but the "Pie and
// donut" recipe's `innerRadius: ({ radius }) => radius * innerRatio` pattern
// (a `PolarLength` resolver function, `packages/charts-core/src/polar.ts`)
// and the "Partial-circle gauge" recipe's restricted-sweep `radialArc`
// generalize directly to N concentric rings: docs/LOG.md D27 ("Ring = 2
// radialArc per ring (track + progress), cornerRadius strokeWidth/2, round
// caps") is realized here as ONE `radialArc` call per ring for the
// full-sweep muted TRACK plus ONE more for the value-fraction PROGRESS arc
// -- 2*n total `radialArc` marks in a single `polar()` container. Each
// ring's `innerRadius`/`outerRadius` are CONSTANT ratios of the resolved
// container radius (computed once per ring index, not data-driven), so
// rings stack outward from a fixed inner hole to the container edge exactly
// like bklit's own concentric layout (`getRingRadii` in ring-chart.tsx),
// just expressed as ratios of `layout.radius` instead of absolute pixels --
// this scales to the same n=20/50 structural rows bklit's own
// `designOuterRadius` scale-to-fit handles.
//
// This is the PERFORMANCE-CEILING reference (native/idiomatic TanStack
// styling), NOT a bklit-styled clone (tanstack-radar.tsx/tanstack-pie.tsx
// header-comment philosophy): no bklit-specific chrome (hover glow, push-out
// neighbor scale, track/progress two-phase staggered reveal, always-mounted
// RingCenter, etc. -- D27) is ported here.
import { useEffect, useMemo, useRef, useState } from "react";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { polar, radialArc, type PolarLayoutContext } from "@tanstack/charts/polar";
import {
  generateRing,
  generateRingUpdate,
  type SeededRing,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Matches bklit-ring.tsx's size choice (docs demo's `size={280}`).
const RING_SIZE = 280;

// Small fixed palette, cycled by ring index -- ceiling scenario styling
// (native/idiomatic TanStack), not a pixel clone of bklit's `--chart-1`..
// `--chart-5` CSS-variable palette (radar/pie precedent).
const RING_PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#64748b",
];

// Flat muted track color -- ceiling styling stand-in for bklit's
// `ringCssVars.ringBackground` (`var(--border)`), not a CSS-var pixel clone.
const TRACK_COLOR = "#e2e8f0";

// Full-circle sweep, matching bklit's own default `startAngle`/`endAngle`
// (RingChart's defaults: -PI/2 .. 3*PI/2, "12 o'clock, clockwise, full
// circle" -- ring-chart.tsx) -- a natural, idiomatic full-sweep choice here
// too, not a fidelity requirement for this ceiling scenario.
const START_ANGLE = -Math.PI / 2;
const END_ANGLE = (3 * Math.PI) / 2;

// Concentric band geometry: ring 0 is innermost, ring n-1 outermost, each
// occupying an equal fractional band of the available radius from
// `BASE_INNER_RATIO` out to the container edge (ratio 1), with a small
// fixed proportional gap between bands. Ratios only -- the actual pixel
// radii come from multiplying by `layout.radius` (already inset/
// radiusRatio-resolved) at render time, so this scales cleanly from n=1 up
// through the n=50 structural row.
const BASE_INNER_RATIO = 0.28;
const GAP_RATIO = 0.015;

function ringBandRatios(
  ringCount: number,
  index: number,
): { innerRatio: number; outerRatio: number } {
  const available = 1 - BASE_INNER_RATIO;
  const bandWidth = ringCount > 0 ? available / ringCount : available;
  const innerRatio = BASE_INNER_RATIO + index * bandWidth;
  const outerRatio = Math.max(innerRatio + 0.004, innerRatio + bandWidth - GAP_RATIO);
  return { innerRatio, outerRatio };
}

interface RingArcRow {
  startAngle: number;
  endAngle: number;
}

export default function TanstackRing({ n }: { n: number }) {
  const [data, setData] = useState<SeededRing[]>(() => generateRing("ring", n));
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateRingUpdate("ring", n, tickRef.current));
      });
    // See bklit-ring.tsx: ring's `n` is ring count, not a time-series window
    // -- no live-append concept applies.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const arcMarks = data.flatMap((ring, index) => {
      const { innerRatio, outerRatio } = ringBandRatios(data.length, index);
      const innerRadius = ({ radius }: PolarLayoutContext) => radius * innerRatio;
      const outerRadius = ({ radius }: PolarLayoutContext) => radius * outerRatio;
      // Round caps, matching D27's "cornerRadius strokeWidth/2" idiom --
      // here "strokeWidth" is this ring's own band thickness (outer-inner).
      const cornerRadius = ({ radius }: PolarLayoutContext) =>
        (radius * (outerRatio - innerRatio)) / 2;

      const progress =
        ring.maxValue > 0 ? Math.min(1, Math.max(0, ring.value / ring.maxValue)) : 0;
      const trackRow: RingArcRow = { startAngle: START_ANGLE, endAngle: END_ANGLE };
      const progressRow: RingArcRow = {
        startAngle: START_ANGLE,
        endAngle: START_ANGLE + (END_ANGLE - START_ANGLE) * progress,
      };
      const color = RING_PALETTE[index % RING_PALETTE.length] ?? RING_PALETTE[0];

      return [
        // Full-sweep track (muted), rendered first so the progress arc
        // paints on top of it.
        radialArc<RingArcRow>([trackRow], {
          id: `ring-${index}-track`,
          key: () => "arc",
          // startAngle/endAngle omitted (see tanstack-pie.tsx header comment
          // on radialArc's default channels): `trackRow`/`progressRow`
          // already carry those exact field names.
          innerRadius,
          outerRadius,
          cornerRadius,
          fill: TRACK_COLOR,
        }),
        // Value-fraction progress arc, same band, series color.
        radialArc<RingArcRow>([progressRow], {
          id: `ring-${index}-progress`,
          key: () => "arc",
          innerRadius,
          outerRadius,
          cornerRadius,
          fill: color,
        }),
      ];
    });

    return defineChart({
      marks: [
        polar({
          inset: 8,
          radiusRatio: 0.92,
          marks: arcMarks,
        }),
      ],
      // Polar is a positionless container mark -- no cartesian x/y scales or
      // guides (every polar worked example in the docs, radar/pie
      // precedent).
      guides: false,
      x: null,
      y: null,
    });
  }, [data]);

  return (
    <Chart
      ariaLabel="Ring chart benchmark scenario"
      width={RING_SIZE}
      height={RING_SIZE}
      definition={definition}
      onRender={onRender}
    />
  );
}
