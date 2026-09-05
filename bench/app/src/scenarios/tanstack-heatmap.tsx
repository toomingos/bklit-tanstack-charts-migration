// Ceiling reference: single cell mark over week x weekday band scales (fixture 25-calendar-heatmap).
// GUARD: color is scaleThreshold (bklit's discrete 5-level model), not the fixture's scaleSequential.
import { useEffect, useMemo, useRef, useState } from "react";
import { scaleBand, scaleThreshold } from "d3-scale";
import { Chart } from "@tanstack/react-charts";
import { cell, defineChart } from "@tanstack/charts";
import { tooltip } from "@tanstack/charts/tooltip";
import {
  generateHeatmap,
  generateHeatmapUpdate,
  type SeededHeatmapColumn,
} from "../../../data";
import { armTanstackSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Discrete 5-level threshold mirroring bklit's contribution levels (0/1/2/3/>=4).
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
    // GUARD: n is week count; no live-append axis.
    window.__benchLiveTick = () => {};
  }, [n]);

  const rows = useMemo(() => flattenHeatmap(columns), [columns]);
  // GUARD: true week count is columns.length (n=52 magic path may differ from 52).
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
        scales: {
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
        },
        color: {
          scale: scaleThreshold<number, string>()
            .domain([1, 2, 3, 4])
            .range(THRESHOLD_COLORS),
        },
        tooltip,
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
