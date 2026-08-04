// Native TanStack Charts equivalent of bklit's radar-chart demo, expressed
// via `@tanstack/charts/polar`'s `polar()` + `radialGrid`/`angleGrid` guides
// + `radialArea`/`radialDot` marks, following the "Radar profile" worked
// example in repos/tanstack-charts/docs/examples/polar-and-radar.md and the
// multi-series `z`-grouping pattern from the canonical comparative-radar
// conformance fixture (repos/tanstack-charts/benchmarks/conformance/cases/
// 99-comparative-radar/tanstack.ts) generalized to this bench's `n`
// (series-count) axis. Default/unstyled TanStack theming only (see
// docs/LOG.md) -- this is the PERFORMANCE-CEILING reference, NOT a
// bklit-styled clone (same philosophy as tanstack-line.tsx's/
// tanstack-candlestick.tsx's header comments): header marks it as such, no
// bklit-specific chrome (hover dim/glow/scale springs, always-centered
// labels, etc. -- D24) is ported here.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { curveLinearClosed } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { defineChart } from "@tanstack/charts";
import {
  angleGrid,
  polar,
  radialArea,
  radialDot,
  radialGrid,
  type PolarGuideLabelContext,
} from "@tanstack/charts/polar";
import {
  generateRadar,
  generateRadarUpdate,
  type SeededRadarSet,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Matches bklit-radar.tsx's size choice (see that file's comment): fixed
// 400x400 square, comfortably inside #chart-root's 1052px usable width and
// the 800px-tall bench viewport.
const RADAR_SIZE = 400;

// Small fixed palette, cycled by series index -- this is the ceiling
// scenario (native/idiomatic TanStack styling), not a pixel clone of
// bklit's `--chart-1`..`--chart-5` CSS-variable palette, so a plain hex
// cycle is sufficient. First two values match the comparative-radar
// conformance fixture's `seriesColors` for continuity with that reference.
const RADAR_PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#64748b",
];

interface RadarRow {
  metric: string;
  value: number;
  series: string;
}

function buildRows(set: SeededRadarSet): RadarRow[] {
  const rows: RadarRow[] = [];
  for (const series of set.data) {
    for (const metric of set.metrics) {
      rows.push({
        metric: metric.key,
        value: series.values[metric.key] ?? 0,
        series: series.label,
      });
    }
  }
  return rows;
}

// Quadrant-aware angle-grid label offset/baseline, taken directly from the
// docs "Radar profile" worked example -- native TanStack idiom, not a
// bklit-fidelity requirement (bklit's own labels are always centered,
// unconditionally, per D24 -- irrelevant for this ceiling scenario).
function angleLabelDx({ x }: PolarGuideLabelContext): number {
  return x < -1 ? -3 : x > 1 ? 3 : 0;
}
function angleLabelDy({ y }: PolarGuideLabelContext): number {
  return y < -1 ? -2 : y > 1 ? 2 : 0;
}

export default function TanstackRadar({ n }: { n: number }) {
  const [set, setSet] = useState<SeededRadarSet>(() =>
    generateRadar("radar", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setSet(generateRadarUpdate("radar", n, tickRef.current));
      });
    // See bklit-radar.tsx: radar's `n` is series count at a fixed 5
    // metrics, not a time-series window -- no live-append concept applies.
    window.__benchLiveTick = () => {};
  }, [n]);

  const definition = useMemo(() => {
    const rows = buildRows(set);
    const colorFor = (row: RadarRow) => {
      const index = set.data.findIndex((s) => s.label === row.series);
      return RADAR_PALETTE[index % RADAR_PALETTE.length] ?? RADAR_PALETTE[0];
    };

    return defineChart({
      marks: [
        polar({
          radiusRatio: 0.72,
          // Angle over metric keys via `scaleBand` (a point-ish band scale
          // for the fixed, discrete metric axis) -- factory reference (not
          // called), matching the docs worked example's
          // `angle: { scale: scaleBand<string> }`; domain is inferred from
          // the marks' angle channel values (every row's `metric`).
          angle: { scale: scaleBand<string> },
          // Radius: a PRE-DOMAINED `scaleLinear` INSTANCE fixed to [0, 100]
          // -- per docs/LOG.md D24, bklit's radar value domain is
          // HARDCODED [0, 100] with no inference/clamping/nice-ing, so this
          // passes an already-domained instance rather than letting
          // `polar()` infer (and `nice()`) a domain from the data, the same
          // "pass a pre-domained instance" ruling D24 calls out explicitly.
          // (The docs example chains `.nice(4)` on top for its own general
          // demo purposes; omitted here to keep the domain exactly
          // [0, 100], not [0, nice(100)].)
          radius: { scale: scaleLinear().domain([0, 100]) },
          guides: [
            radialGrid({ ticks: 5, shape: "polygon", labels: false }),
            angleGrid({
              labels: true,
              labelDx: angleLabelDx,
              labelDy: angleLabelDy,
            }),
          ],
          marks: [
            // One composite mark for ALL series (bklit strokes the same
            // path it fills -- D24 ruling (4) -- `radialArea`'s own
            // `stroke`/`strokeWidth` options make a single fill+stroke path
            // per series possible without a second boundary mark, D21's
            // single-focus-bearing-mark precedent). `z: "series"` groups
            // the flattened metric x series rows back into one path per
            // series, exactly like the canonical comparative-radar
            // conformance fixture generalized from 2 series to `n`.
            radialArea(rows, {
              angle: "metric",
              radius: "value",
              z: "series",
              key: "metric",
              curve: curveLinearClosed,
              fill: colorFor,
              fillOpacity: 0.18,
              stroke: colorFor,
              strokeWidth: 2,
            }),
            // Per-metric vertex markers (bklit's default `showPoints`),
            // same z-grouping/coloring as the area.
            radialDot(rows, {
              angle: "metric",
              radius: "value",
              z: "series",
              key: "metric",
              r: 3,
              fill: colorFor,
            }),
          ],
        }),
      ],
      // Polar is a positionless container mark (polar.ts) -- the outer
      // chart has no cartesian x/y scales or guides, matching every polar
      // worked example in the docs.
      guides: false,
      x: null,
      y: null,
    });
  }, [set]);

  return (
    <Chart
      ariaLabel="Radar chart benchmark scenario"
      width={RADAR_SIZE}
      height={RADAR_SIZE}
      definition={definition}
      onRender={onRender}
    />
  );
}
