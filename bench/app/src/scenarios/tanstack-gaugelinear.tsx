// Native TanStack Charts PERFORMANCE-CEILING approximation of bklit's
// linear Gauge -- NOT a pixel clone (ceiling-not-clone philosophy, see
// tanstack-gauge.tsx's/tanstack-radar.tsx's header comments). Per
// docs/LOG.md D28, the real migrated linear gauge uses the SAME bespoke
// `createNotchPath`-based `PolarMark`-analog custom mark as the arc
// orientation (rectangular/tapered notch corners via straight chords +
// quadratic-Bezier fillets); there is no native TanStack primitive that
// draws that shape. Per this task's own ceiling-design instruction ("for
// the linear ceiling use n plain SVG rects via a minimal cartesian
// defineChart with rect-family marks ... pick the simplest native-TanStack
// expression that renders n notch-like nodes"), this file picks `barY` --
// the simplest, already-proven (tanstack-bar.tsx) cartesian rect-family
// mark: `n` notches become `n` categorical bars of unit height along a
// `scaleBand` x-axis, each colored by whether bklit's own
// `activeNotches = round(value/100*totalNotches)` rule would mark it
// active. This reproduces "n notch-like rects, some active" at the DOM
// level (n `<rect>` nodes, same order of magnitude as bklit's real linear
// track) without attempting bklit's actual tapered/uniform notch geometry.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { barY, defineChart } from "@tanstack/charts";
import {
  generateGauge,
  generateGaugeUpdate,
  type SeededGauge,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// bklit's linear `Gauge` is a thin horizontal track (`linearHeight` default
// 24px, full responsive width) -- a wide, short aspect ratio approximates
// that footprint for this cartesian ceiling (arbitrary-but-reasonable
// choice; this is a performance-only approximation, not a pixel target, so
// the exact ratio doesn't need to match bklit's real `linearHeight`/width
// math).
const LINEAR_ASPECT_RATIO = 8;

interface LinearNotch {
  index: string;
  height: number;
  active: boolean;
}

function buildLinearNotches(
  totalNotches: number,
  value: number,
): LinearNotch[] {
  const activeNotches = Math.round((value / 100) * totalNotches);
  return Array.from({ length: totalNotches }, (_, i) => ({
    index: `notch-${i}`,
    height: 1, // every notch is a unit-height rect -- the track has no y-domain of its own
    active: i < activeNotches,
  }));
}

export default function TanstackGaugeLinear({ n }: { n: number }) {
  const [gauge, setGauge] = useState<SeededGauge>(() =>
    generateGauge("gaugelinear", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setGauge(generateGaugeUpdate("gaugelinear", n, tickRef.current));
      });
    // Same as bklit-gaugelinear.tsx: `n` is totalNotches, no live-append
    // concept.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const notches = buildLinearNotches(gauge.totalNotches, gauge.value);
    return defineChart({
      marks: [
        barY(notches, {
          id: "notches",
          x: "index",
          y: "height",
          key: "index",
          inset: 1,
          fill: (notch) => (notch.active ? "#10b981" : "#e5e7eb"),
        }),
      ],
      x: { scale: () => scaleBand<string>().paddingInner(0.15), grid: false },
      // Pre-domained [0, 1] instance (every notch is unit height, so the
      // "value" axis has no real data range to infer -- same
      // "pass a pre-domained instance" pattern as tanstack-radar.tsx's
      // hardcoded [0, 100] radius scale).
      y: { scale: scaleLinear().domain([0, 1]), grid: false },
      tooltip: false,
    });
  }, [gauge]);

  return (
    <Chart
      ariaLabel="Gauge (linear) chart benchmark scenario"
      aspectRatio={LINEAR_ASPECT_RATIO}
      definition={definition}
      onRender={onRender}
    />
  );
}
