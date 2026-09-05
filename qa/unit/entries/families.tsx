// One SSR entry for all 16 migrated families. JSX mirrors the showcase demo
// components (migrated branch only) with docs-data representative datasets,
// minus interactivity state. Bundled by qa/unit/lib/render.mjs; never imported
// directly by node (tsx + css need esbuild).
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import * as M from '../../../showcase/migrated/charts/index';
import {
  areaChartDocsData,
  barChartDocsData,
  candlestickChartDocsData,
  composedDocsData,
  funnelDocsData,
  gaugeDocsProps,
  lineChartDocsData,
  pieDocsData,
  radarDocsData,
  radarDocsMetrics,
  ringDocsData,
  sankeyDocsData,
  scatterChartDocsData,
  sunburstDocsData,
} from '../../../showcase/lib/docs-data';
import {
  WORLD_COUNTRIES,
  generateHeatmap,
  getLiveLineSeed,
  liveLineWindowSecs,
} from '../../../showcase/lib/demo-data';

const SUNBURST_SIZE = 440;

// Verbatim from showcase/components/demos/sunburst.tsx (migrated branch).
function countArcs(node: { children?: readonly unknown[] }): number {
  let count = 0;
  for (const child of node.children ?? []) {
    count += 1;
    count += countArcs(child as { children?: readonly unknown[] });
  }
  return count;
}

const sunburstArcs = Array.from({ length: countArcs(sunburstDocsData) }, (_, i) => i);
const liveSeed = getLiveLineSeed(30);

export const families: Record<string, () => ReactElement> = {
  area: () => (
    <M.AreaChart data={areaChartDocsData} aspectRatio="2/1">
      <M.Grid horizontal />
      <M.Area dataKey="revenue" fill="var(--chart-line-primary)" fillOpacity={0.3} fadeEdges />
      <M.Area dataKey="costs" fill="var(--chart-line-secondary)" fillOpacity={0.3} fadeEdges />
      <M.XAxis />
      <M.ChartTooltip />
    </M.AreaChart>
  ),
  bar: () => (
    <M.BarChart data={barChartDocsData} xDataKey="month" aspectRatio="2/1">
      <M.Grid horizontal />
      <M.Bar dataKey="revenue" fill="var(--chart-line-primary)" lineCap="round" />
      <M.Bar dataKey="profit" fill="var(--chart-line-secondary)" lineCap="round" />
      <M.BarXAxis />
      <M.ChartTooltip />
    </M.BarChart>
  ),
  candlestick: () => (
    <M.CandlestickChart
      data={candlestickChartDocsData}
      margin={{ top: 16, right: 16, bottom: 40, left: 16 }}
      style={{ height: 320 }}
    >
      <M.Candlestick fadedOpacity={0.25} />
      <M.ChartTooltip />
      <M.XAxis />
    </M.CandlestickChart>
  ),
  choropleth: () => (
    <M.ChoroplethChart aspectRatio="16 / 9" data={WORLD_COUNTRIES} zoomEnabled>
      <M.ChoroplethFeatureComponent fill="var(--chart-scale-03)" />
      <M.ChoroplethTooltip />
    </M.ChoroplethChart>
  ),
  composed: () => (
    <M.ComposedChart aspectRatio="2 / 1" barGap={0} data={composedDocsData} maxBarSize={32} xDataKey="date">
      <M.Grid horizontal />
      <M.Area dataKey="runRate" fill="var(--chart-4)" fillOpacity={0.32} />
      <M.SeriesBar dataKey="units" fill="var(--chart-3)" radius={4} />
      <M.Line dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} />
      <M.ChartTooltip showCrosshair={false} />
      <M.XAxis numTicks={8} />
    </M.ComposedChart>
  ),
  funnel: () => <M.FunnelChart color="var(--chart-1)" data={funnelDocsData} layers={3} />,
  gauge: () => (
    <M.Gauge
      centerValue={gaugeDocsProps.centerValue}
      defaultLabel={gaugeDocsProps.defaultLabel}
      formatOptions={gaugeDocsProps.formatOptions}
      inactiveFillOpacity={gaugeDocsProps.inactiveFillOpacity}
      spacing={gaugeDocsProps.spacing}
      value={gaugeDocsProps.value}
    />
  ),
  heatmap: () => (
    <M.HeatmapInteractionProvider>
      <M.HeatmapInteractionBoundary>
        <M.HeatmapChart className="w-full" data={generateHeatmap('heatmap', 30)} layout="fluid">
          <M.HeatmapCells inactiveOpacity={1} inactiveScale={1} />
          <M.HeatmapXAxis />
          <M.HeatmapYAxis />
          <M.HeatmapTooltip instant />
        </M.HeatmapChart>
        <M.HeatmapLegend inactiveOpacity={1} inactiveScale={1} />
      </M.HeatmapInteractionBoundary>
    </M.HeatmapInteractionProvider>
  ),
  line: () => (
    <M.LineChart data={lineChartDocsData} aspectRatio="2/1">
      <M.Grid horizontal />
      <M.Line dataKey="users" stroke="var(--chart-line-primary)" />
      <M.Line dataKey="pageviews" stroke="var(--chart-line-secondary)" />
      <M.XAxis />
      <M.ChartTooltip />
    </M.LineChart>
  ),
  'live-line': () => (
    <M.LiveLineChart
      data={liveSeed}
      margin={{ top: 16, right: 16, bottom: 40, left: 56 }}
      style={{ height: 260 }}
      value={liveSeed[liveSeed.length - 1]?.value ?? 0}
      window={liveLineWindowSecs(30)}
    >
      <M.LiveLine dataKey="value" stroke="var(--chart-line-primary)" />
      <M.ChartTooltip />
      <M.LiveXAxis />
      <M.LiveYAxis position="left" />
    </M.LiveLineChart>
  ),
  pie: () => (
    <M.PieChart data={pieDocsData} size={280}>
      {pieDocsData.map((item, i) => (
        <M.PieSlice index={i} key={item.label} />
      ))}
    </M.PieChart>
  ),
  radar: () => (
    <M.RadarChart data={radarDocsData} hoveredIndex={null} metrics={radarDocsMetrics} size={400}>
      <M.RadarGrid />
      <M.RadarAxis />
      <M.RadarLabels interactive />
      {radarDocsData.map((item, index) => (
        <M.RadarArea index={index} key={item.label} />
      ))}
    </M.RadarChart>
  ),
  ring: () => (
    <M.RingChart data={ringDocsData} size={320}>
      {ringDocsData.map((item, i) => (
        <M.Ring index={i} key={item.label} />
      ))}
      <M.RingCenter defaultLabel="Total Sessions" />
    </M.RingChart>
  ),
  sankey: () => (
    <M.SankeyChart data={sankeyDocsData} aspectRatio="16 / 9" nodeWidth={16} nodePadding={24}>
      <M.SankeyLink />
      <M.SankeyNode lineCap={4} labelOrientation="vertical" />
      <M.SankeyTooltip />
    </M.SankeyChart>
  ),
  scatter: () => (
    <M.ScatterChart data={scatterChartDocsData} aspectRatio="2/1">
      <M.Grid horizontal />
      <M.Scatter dataKey="sessions" />
      <M.Scatter dataKey="conversions" />
      <M.XAxis />
      <M.ChartTooltip />
    </M.ScatterChart>
  ),
  sunburst: () => (
    <M.SunburstChart data={sunburstDocsData} focusId="root" onFocusChange={() => {}} size={SUNBURST_SIZE}>
      {sunburstArcs.map((arcIndex) => (
        <M.SunburstSegment index={arcIndex} key={`arc-${arcIndex}`} />
      ))}
      <M.SunburstCenter />
      <M.SunburstLabels />
      <M.SunburstHint />
    </M.SunburstChart>
  ),
};

export { renderToString };
