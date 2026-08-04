// Native TanStack Charts equivalent of bklit's pie-chart registry demo,
// expressed via `@tanstack/charts/polar`'s "Pie and donut" worked example
// (repos/tanstack-charts/docs/examples/polar-and-radar.md): d3-shape's
// `pie().sort(null)` turns the seeded slices into angular intervals,
// `radialArc` renders them with a ZERO inner radius (solid pie, matching
// bklit-pie.tsx's registry-parity scope -- no donut hole, no center).
// `radialArc`'s DEFAULT `startAngle`/`endAngle`/`padAngle` channels read
// those exact property names straight off each datum (verified in
// packages/charts-core/src/polar.ts's `radialArc`: `numberProperty(datum,
// 'startAngle')` etc. when no channel option is given) -- and d3 `pie()`'s
// output objects (`{ data, index, value, startAngle, endAngle, padAngle }`)
// already have those exact fields, so passing the pie() output straight
// through as `radialArc`'s source is zero-transformation, exactly as
// docs/LOG.md D27 observes for bklit's own arc feed.
//
// This is the PERFORMANCE-CEILING reference (native/idiomatic TanStack
// styling), NOT a bklit-styled clone -- same philosophy as
// tanstack-radar.tsx's/tanstack-line.tsx's header comments: no bklit-specific
// chrome (hover translate-out spring, glow, fade-others, angular-sweep
// stagger reveal, etc. -- D27) is ported here.
import { useEffect, useMemo, useRef, useState } from "react";
import { pie } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import { polar, radialArc } from "@tanstack/charts/polar";
import {
  generatePie,
  generatePieUpdate,
  type SeededPieSlice,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Matches bklit-pie.tsx's size choice (registry example's `size={280}`).
const PIE_SIZE = 280;

// Small fixed palette, cycled by slice index -- ceiling scenario styling
// (native/idiomatic TanStack), not a pixel clone of bklit's `--chart-1`..
// `--chart-5` CSS-variable palette (radar precedent).
const PIE_PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#64748b",
];

export default function TanstackPie({ n }: { n: number }) {
  const [data, setData] = useState<SeededPieSlice[]>(() =>
    generatePie("pie", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generatePieUpdate("pie", n, tickRef.current));
      });
    // See bklit-pie.tsx: pie's `n` is slice count, not a time-series window
    // -- no live-append concept applies.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    // `pie().sort(null)` per the docs recipe: "Keep pie().sort(null) when
    // source order is semantic" -- preserves the seeded generator's data
    // order exactly like bklit's own `d3Pie<PieData>()...sort(null)` call
    // (pie-chart.tsx).
    const slices = pie<SeededPieSlice>()
      .sort(null)
      .value((d) => d.value)(data);

    return defineChart({
      marks: [
        polar({
          inset: 8,
          radiusRatio: 0.82,
          marks: [
            radialArc(slices, {
              key: (slice) => slice.data.label,
              // startAngle/endAngle/padAngle deliberately omitted: d3
              // pie()'s output already carries those exact field names, and
              // radialArc's default channels read them directly (see header
              // comment) -- zero-transformation pass-through.
              innerRadius: 0, // solid pie (registry-parity pilot scope, D27)
              fill: (slice) => PIE_PALETTE[slice.index % PIE_PALETTE.length] ?? PIE_PALETTE[0],
            }),
          ],
        }),
      ],
      // Polar is a positionless container mark -- no cartesian x/y scales or
      // guides (every polar worked example in the docs, radar precedent).
      guides: false,
      x: null,
      y: null,
    });
  }, [data]);

  return (
    <Chart
      ariaLabel="Pie chart benchmark scenario"
      width={PIE_SIZE}
      height={PIE_SIZE}
      definition={definition}
      onRender={onRender}
    />
  );
}
