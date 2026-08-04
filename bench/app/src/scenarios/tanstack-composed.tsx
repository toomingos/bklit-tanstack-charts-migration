// Native TanStack Charts equivalent of bklit's composed-chart.tsx demo,
// expressed via `defineChart` + mixed `barY`/`areaY`/`lineY` marks over the
// same seeded rows bklit-composed.tsx uses (`generateComposed`). Default/
// unstyled TanStack theming only (see docs/LOG.md) -- this is the
// performance-ceiling reference, NOT a bklit-styled clone (same philosophy as
// tanstack-line.tsx's/tanstack-candlestick.tsx's header comments).
//
// x is a continuous `scaleUtc` (matching the seeded data's `Date` domain),
// unlike the mixed-marks reference in
// repos/tanstack-charts/benchmarks/conformance/cases/70-composed-chart/tanstack.ts
// (that fixture uses a `scaleBand` categorical x over named categories). On a
// continuous scale `barY` has no real band to size against, so this accepts
// TanStack's own `inferBandwidth` default rather than supplying a
// `groupScale`/fixed `inset` -- there is only one bar series here (no
// grouping), so `inferBandwidth`'s single-series path is the natural fit.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { curveNatural } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { areaY, barY, d3Curve, defineChart, lineY } from "@tanstack/charts";
import {
  generateComposed,
  generateComposedUpdate,
  type SeededComposedRow,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveComposed } from "../bench/live";

const monotone = d3Curve(curveNatural);

export default function TanstackComposed({ n }: { n: number }) {
  const [data, setData] = useState<SeededComposedRow[]>(() =>
    generateComposed("composed", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateComposedUpdate("composed", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) =>
        appendLiveComposed("composed", n, prev, liveTickRef.current),
      );
    };
  }, [n]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          // `x`/`y` are accessor functions rather than string channel keys:
          // `SeededComposedRow` carries a `[key: string]: unknown` index
          // signature (per the required row shape) so its `keyof` widens to
          // plain `string`, which defeats the marks' literal-keyof
          // `ChannelField` overload -- accessors sidestep that and stay
          // fully typed against the row shape.
          barY(data, {
            id: "bars",
            x: (d) => d.date,
            y: (d) => d.bars,
            fill: "#94a3b8",
          }),
          areaY(data, {
            id: "area",
            x: (d) => d.date,
            y: (d) => d.line,
            curve: monotone,
            fillOpacity: 0.3,
            fill: "#6366f1",
            stroke: "#6366f1",
          }),
          lineY(data, {
            id: "line",
            x: (d) => d.date,
            y: (d) => d.line,
            curve: monotone,
            stroke: "#22c55e",
            strokeWidth: 2,
          }),
        ],
        x: { scale: scaleUtc, nice: true },
        y: { scale: scaleLinear, nice: true, grid: true },
        tooltip: true,
      }),
    [data],
  );

  return (
    <Chart
      ariaLabel="Composed chart benchmark scenario"
      aspectRatio={2}
      definition={definition}
      onRender={onRender}
    />
  );
}
