// Ceiling reference: 2 radialArc per ring (track + progress) in one polar container.
// Rings stack outward as constant radius ratios; scales to the n=20/50 structural rows.
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

const RING_SIZE = 280;

const RING_PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#64748b",
];

const TRACK_COLOR = "#e2e8f0";

// Full-circle sweep (12 o'clock, clockwise), like bklit's defaults.
const START_ANGLE = -Math.PI / 2;
const END_ANGLE = (3 * Math.PI) / 2;

// Ring 0 innermost; equal fractional bands from base ratio to edge, so geometry scales with n.
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
    // GUARD: n is ring count; no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const arcMarks = data.flatMap((ring, index) => {
      const { innerRatio, outerRatio } = ringBandRatios(data.length, index);
      const innerRadius = ({ radius }: PolarLayoutContext) => radius * innerRatio;
      const outerRadius = ({ radius }: PolarLayoutContext) => radius * outerRatio;
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
        radialArc<RingArcRow>([trackRow], {
          id: `ring-${index}-track`,
          key: () => "arc",
          // Rows already carry startAngle/endAngle, so no channel overrides.
          innerRadius,
          outerRadius,
          cornerRadius,
          fill: TRACK_COLOR,
        }),
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
          scales: { angle: null, radius: null },
          inset: 8,
          radiusRatio: 0.92,
          marks: arcMarks,
        }),
      ],
      guides: false,
      scales: { x: null, y: null },
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
