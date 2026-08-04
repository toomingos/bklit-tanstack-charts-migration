// Native TanStack Charts approximation of bklit's HeatmapChart, expressed
// via `defineChart` + a single `cell` mark over TWO band scales (week index
// x weekday) -- this is a PERFORMANCE-CEILING reference (default/unstyled
// TanStack theming only, same philosophy as tanstack-composed.tsx's/
// tanstack-line.tsx's header comments), NOT a pixel clone. Per docs/LOG.md
// D31, bklit's own GitHub-style calendar grid (week columns x 7 day rows,
// with ALL calendar math -- range alignment, partial-lead-week skip,
// ghost bins, weekStartDay rotation, month-anchor ticks, quarter
// separators -- done app-side) "has NO TanStack analogue"; this scenario
// exists purely to give a comparable node-count/geometry ceiling for the
// same seeded `n`-week dataset (bench/data.ts's `generateHeatmap`), not to
// replicate bklit's bespoke layout/reveal/hover model.
//
// Structural basis is TanStack's OWN conformance fixture for exactly this
// chart family:
// repos/tanstack-charts/benchmarks/conformance/cases/25-calendar-heatmap/tanstack.ts
//   cell(rows, { x: (row) => weekIndex, y: (row) => weekdayLabel, z: 'count',
//     key: 'id', inset: 1, radius: 2 })
//   x: { scale: scaleBand<number>().domain(weeks)... }
//   y: { scale: scaleBand<string>().domain(weekdays)... }
//   color: { scale: scaleSequential<string>()... }
// `cell` IS `rect` (a literal alias, charts-core/src/rect.ts: `export
// function cell(...) { return rect(source, options) }`) -- same mark,
// same node count/geometry as the conformance fixture's own `cell` usage.
//
// One deliberate deviation from that fixture: color uses `scaleThreshold`
// (discrete, 5-level) instead of the fixture's own continuous
// `scaleSequential`. Per D31, bklit's REAL heatmap color model is
// "DISCRETE 5-level threshold (count 0/1/2/3/>=4 -> --chart-scale-01..05;
// scaleThreshold, NOT the continuous scaleSequential in TanStack's own
// calendar fixture)" -- swapping to `scaleThreshold` keeps this ceiling
// representative of bklit's actual bucketing (`getHeatmapContributionLevel`,
// heatmap-utils.ts: 0->0, 1->1, 2->2, 3->3, else->4) rather than the
// fixture's own unrelated continuous-gradient design. This swap does not
// change node count or cell geometry either way -- color scale choice is
// orthogonal to both -- it's purely a "stay comparable to the real
// component" choice, not a geometry/perf one. `scaleThreshold` (d3-scale,
// already a bench/app dependency) satisfies TanStack's
// `ConfiguredColorScaleLike` interface (callable + `.copy()` + `.domain()`/
// `.range()`) with no new dependency.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleThreshold } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { cell, defineChart } from "@tanstack/charts";
import {
  generateHeatmap,
  generateHeatmapUpdate,
  type SeededHeatmapColumn,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// Sun-first, matching bench/data.ts's `bin` day-offset convention (0=Sun
// .. 6=Sat) and bklit's own default `weekStartDay` (unrotated).
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Discrete 5-level threshold, mirroring bklit's `getHeatmapContributionLevel`
// bucket boundaries (0 / 1 / 2 / 3 / >=4) -- see header comment above.
const THRESHOLD_COLORS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

interface HeatmapCellRow {
  id: string;
  week: number;
  weekday: (typeof WEEKDAYS)[number];
  count: number;
}

function flattenHeatmap(columns: SeededHeatmapColumn[]): HeatmapCellRow[] {
  const rows: HeatmapCellRow[] = [];
  for (const column of columns) {
    for (const bin of column.bins) {
      rows.push({
        id: `${column.bin}:${bin.bin}`,
        week: column.bin,
        weekday: WEEKDAYS[bin.bin] ?? "Sun",
        count: bin.count,
      });
    }
  }
  return rows;
}

export default function TanstackHeatmap({ n }: { n: number }) {
  const [columns, setColumns] = useState<SeededHeatmapColumn[]>(() =>
    generateHeatmap("heatmap", n),
  );
  const tickRef = useRef(0);
  const { onRender } = useMemo(() => armTanstackSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setColumns(generateHeatmapUpdate("heatmap", n, tickRef.current));
      });
    // Heatmap's `n` is week count (D31), not a live-append time-series
    // axis -- no-op, matching bklit-heatmap.tsx / the gauge/radar/pie/ring/
    // funnel ceiling precedent.
    window.__benchLiveTick = () => {};
  }, [n]);

  const rows = useMemo(() => flattenHeatmap(columns), [columns]);
  // `columns.length` (not the raw `n`) is the true week count -- for the
  // n=52 "magic path" this is calendar-derived and may differ from 52 (see
  // bench/data.ts's `generateHeatmap` doc block).
  const weekCount = columns.length;
  const weeks = useMemo(
    () => Array.from({ length: weekCount }, (_, i) => i),
    [weekCount],
  );

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          cell(rows, {
            id: "heatmap",
            x: (row) => row.week,
            y: (row) => row.weekday,
            z: "count",
            key: "id",
            inset: 1,
            radius: 2,
          }),
        ],
        x: {
          scale: scaleBand<number>()
            .domain(weeks)
            .paddingInner(0.06)
            .paddingOuter(0.03),
        },
        y: {
          scale: scaleBand<string>()
            .domain(WEEKDAYS as unknown as string[])
            .paddingInner(0.06)
            .paddingOuter(0.03),
        },
        color: {
          scale: scaleThreshold<number, string>()
            .domain([1, 2, 3, 4])
            .range(THRESHOLD_COLORS),
        },
        tooltip: true,
      }),
    [rows, weeks],
  );

  return (
    <Chart
      ariaLabel="Heatmap chart benchmark scenario"
      aspectRatio={weekCount > 0 ? weekCount / 7 : 2}
      definition={definition}
      onRender={onRender}
    />
  );
}
