// Ceiling: polar + radialArea/radialDot per the docs Radar-profile example, z-grouped to n.
// GUARD: radius scale is pre-domained [0,100] (bklit hardcodes it; never infer/nice).
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

const RADAR_SIZE = 400;

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
    // GUARD: n is series count; no live-append concept.
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
          // Angle: scaleBand reference (not called); domain inferred from rows.
          angle: { scale: scaleBand<string> },
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
            // One fill+stroke path per series via z-grouping; no second boundary mark needed.
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
