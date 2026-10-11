"use client";

import { motion, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import type { ComponentProps, RefObject } from "react";
import { createPortal } from "react-dom";
import type { ImplCharts } from "./impl-charts";
import { barChartDocsData, lineChartDocsData } from "@/lib/docs-data";

interface CompositionDemoProps {
  impl: "bklit" | "migrated";
  charts: ImplCharts;
  n: number;
}

type UseChart = () => { yScale: (v: number) => number; innerWidth: number; tooltipData: { x: number; yPositions: Record<string, number> } | null };

/** A custom SVG child: a threshold line plus a ring on the hovered "users" point, in the chart's plot coordinates. */
function ThresholdIndicator({ useChart }: { useChart: UseChart }) {
  const { yScale, innerWidth, tooltipData } = useChart();
  const y = yScale(1500);
  const hovered = tooltipData?.yPositions.users;
  return (
    <g pointerEvents="none">
      <line stroke="var(--chart-line-secondary)" strokeDasharray="4 4" x1={0} x2={innerWidth} y1={y} y2={y} />
      <text fill="var(--chart-label)" fontSize={11} textAnchor="end" x={innerWidth} y={y - 6}>Threshold 1,500</text>
      {tooltipData && hovered !== undefined ? <circle cx={tooltipData.x} cy={hovered} fill="none" r={9} stroke="var(--chart-line-primary)" strokeWidth={2} /> : null}
    </g>
  );
}

interface BarUseChart {
  barScale?: (category: string) => number | undefined;
  bandWidth?: number;
  innerHeight: number;
  yScale: (v: number) => number;
  hoveredBarIndex?: number | null;
  margin: { top: number; left: number };
  containerRef: RefObject<HTMLDivElement | null>;
}

// Bklit's docs "animated line indicator": a rect per bar that rises to the bar top while hovered.
function AnimatedBarLine({ barX, barTopY, barBottomY, width, isHovered }: { barX: number; barTopY: number; barBottomY: number; width: number; isHovered: boolean }) {
  const animatedY = useSpring(barBottomY, { stiffness: 300, damping: 30 });
  const animatedOpacity = useSpring(0, { stiffness: 300, damping: 30 });
  useEffect(() => {
    animatedY.set(isHovered ? barTopY : barBottomY);
    animatedOpacity.set(isHovered ? 1 : 0);
  }, [isHovered, barTopY, barBottomY, animatedY, animatedOpacity]);
  return <motion.rect fill="var(--chart-indicator-color)" height={2} style={{ opacity: animatedOpacity, y: animatedY }} width={width} x={barX} />;
}

// Bklit's docs custom bar indicator: reads useChart() and portals an svg into containerRef.
function BarHorizontalLineIndicator({ data, dataKeys, useChart }: { data: typeof barChartDocsData; dataKeys: ("revenue" | "profit")[]; useChart: () => BarUseChart }) {
  const { barScale, bandWidth, innerHeight, margin, containerRef, hoveredBarIndex, yScale } = useChart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const container = containerRef.current;
  if (!(mounted && container && bandWidth && barScale)) {
    return null;
  }
  const individualBarWidth = bandWidth / dataKeys.length;
  return createPortal(
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-50" height="100%" width="100%">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {data.map((d, i) => {
          const groupX = barScale(d.month) ?? 0;
          return dataKeys.map((dataKey, barIndex) => (
            <AnimatedBarLine key={`${d.month}-${dataKey}`} barBottomY={innerHeight} barTopY={yScale(d[dataKey]) ?? innerHeight} barX={groupX + barIndex * individualBarWidth} isHovered={hoveredBarIndex === i} width={individualBarWidth} />
          ));
        })}
      </g>
    </svg>,
    container,
  );
}

// What a user writes in copied code: their own component wrapping <Line> and a fragment of series, plus custom SVG reading useChart().
export default function CompositionDemo({ impl, charts, n: _n }: CompositionDemoProps) {
  const Charts = charts;
  const BrandLine = (props: ComponentProps<typeof Charts.Line>) => <Charts.Line {...props} stroke="var(--chart-line-primary)" strokeWidth={3} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
    <Charts.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <Charts.Grid horizontal />
      <BrandLine dataKey="users" />
      <>
        <Charts.Line dataKey="pageviews" stroke="var(--chart-line-secondary)" />
      </>
      <Charts.XAxis />
      <Charts.ChartTooltip />
      <ThresholdIndicator useChart={Charts.useChart} />
    </Charts.LineChart>
    <Charts.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1" barGap={0}>
      <Charts.Grid horizontal />
      <Charts.Bar dataKey="revenue" fill="var(--chart-line-primary)" />
      <Charts.Bar dataKey="profit" fill="var(--chart-line-secondary)" />
      <Charts.BarXAxis />
      <Charts.ChartTooltip showCrosshair={false} showDots={false} />
      <BarHorizontalLineIndicator data={barChartDocsData} dataKeys={["revenue", "profit"]} useChart={Charts.useChart} />
    </Charts.BarChart>
    </div>
  );
}
