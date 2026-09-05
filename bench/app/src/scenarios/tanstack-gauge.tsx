// Ceiling approximation (not a pixel clone): n notches around an arc via radialArc's angular math.
// GUARD: bklit 135->405deg = TanStack -3PI/4->3PI/4; per-notch radians precomputed, no scale.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { polar, radialArc } from "@tanstack/charts/polar";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const GAUGE_ARC_WIDTH = 420;
const GAUGE_ARC_HEIGHT = 320;

const START_ANGLE = (-3 * Math.PI) / 4;
const END_ANGLE = (3 * Math.PI) / 4;

// Spacing reused for a comparable gap ratio only.
const SPACING_PERCENT = 25;

interface ArcNotch {
  index: number;
  startAngle: number;
  endAngle: number;
}

function buildArcNotches(totalNotches: number): ArcNotch[] {
  const totalAngle = END_ANGLE - START_ANGLE;
  const availableAngle = totalAngle * (1 - SPACING_PERCENT / 100);
  const notchAngle = totalNotches > 0 ? availableAngle / totalNotches : 0;
  const gapDen = totalNotches - 1 > 0 ? totalNotches - 1 : 1;
  const gapAngle = (totalAngle * (SPACING_PERCENT / 100)) / gapDen;

  return Array.from({ length: totalNotches }, (_, i) => {
    const start = START_ANGLE + i * (notchAngle + gapAngle);
    return { index: i, startAngle: start, endAngle: start + notchAngle };
  });
}

export default function TanstackGauge({ n }: { n: number }) {
  const [gauge, setGauge] = useState<SeededGauge>(() =>
    generateGauge("gauge", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setGauge(generateGaugeUpdate("gauge", n, tickRef.current));
      });
    // GUARD: n is totalNotches; no live-append concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const notches = buildArcNotches(gauge.totalNotches);
    const activeNotches = Math.round(
      (gauge.value / 100) * gauge.totalNotches,
    );
    const activeSubset = notches.filter((notch) => notch.index < activeNotches);

    return defineChart({
      marks: [
        polar({
          scales: { angle: null, radius: null },
          startAngle: START_ANGLE,
          endAngle: END_ANGLE,
          radiusRatio: 0.9,
          marks: [
            radialArc(notches, {
              key: (notch) => `bg-${notch.index}`,
              innerRadius: ({ radius }) => radius * 0.6,
              outerRadius: ({ radius }) => radius,
              cornerRadius: 1,
              fill: "#e5e7eb",
              fillOpacity: 0.8,
            }),
            radialArc(activeSubset, {
              key: (notch) => `active-${notch.index}`,
              innerRadius: ({ radius }) => radius * 0.6,
              outerRadius: ({ radius }) => radius,
              cornerRadius: 1,
              fill: "#10b981",
              fillOpacity: 1,
            }),
          ],
        }),
      ],
      guides: false,
      scales: { x: null, y: null },
    });
  }, [gauge]);

  return (
    <Chart
      ariaLabel="Gauge (arc) chart benchmark scenario"
      width={GAUGE_ARC_WIDTH}
      height={GAUGE_ARC_HEIGHT}
      definition={definition}
      onRender={onRender}
    />
  );
}
