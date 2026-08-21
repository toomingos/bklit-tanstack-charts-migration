// SeriesMarkers point grid + dash-tail overlay + ChartMarkers fan-out pair
// (initiative 10, D229 ruling 10): a 2-series LineChart where seriesA carries
// `showMarkers` (SeriesMarkers point grid) + `dashFromIndex`/`dashArray`
// (dash-tail overlay) and a `<ChartMarkers>` set with a same-date cluster
// (3 markers -> exercises the fan-out badge path) plus 2 single-date
// markers, paired with a 2-item legend (D225-class legend-hover pattern,
// mirroring migrated-candlestick-legend.tsx) so the legend-hover OR-term
// over the marker grid + dash-tail dim (hover-chrome.ts) is exercised too.
// Cluster/single dates are picked as INDEX FRACTIONS of the seeded rows
// (not hardcoded dates) so the scenario stays valid across `n` and across
// update/live ticks (bench/data.ts dates are stable across those).
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import {
  ChartLegend,
  ChartLegendHoverProvider,
  ChartMarkers,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  type ChartMarker,
} from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

const LEGEND_ITEMS = [
  { label: "Series A", value: 100, color: "var(--chart-line-primary)" },
  { label: "Series B", value: 100, color: "var(--chart-line-secondary)" },
];

function rowAt(rows: SeededRow[], frac: number): Date {
  const idx = Math.min(rows.length - 1, Math.max(0, Math.floor(rows.length * frac)));
  return rows[idx]!.date;
}

function buildMarkers(rows: SeededRow[]): ChartMarker[] {
  if (rows.length === 0) return [];
  const cluster = rowAt(rows, 0.4);
  const single1 = rowAt(rows, 0.2);
  const single2 = rowAt(rows, 0.7);
  return [
    // Same-date cluster (>=3 markers sharing one date) -> fan-out badge path.
    { date: cluster, icon: "\u{1F680}", title: "Launch", description: "Release shipped" },
    { date: cluster, icon: "⚠️", title: "Alert", description: "Threshold breached" },
    { date: cluster, icon: "\u{1F527}", title: "Fix", description: "Hotfix deployed" },
    // Single-date markers.
    { date: single1, icon: "\u{1F389}", title: "Milestone", description: "100k users" },
    { date: single2, icon: "\u{1F4C8}", title: "Growth", description: "Quarterly peak" },
  ];
}

export default function BklitMarkers({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("markers", n),
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);
  const markerItems = useMemo(() => buildMarkers(data), [data]);
  const dashFromIndex = useMemo(() => Math.floor(n * 0.75), [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("markers", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("markers", n, prev, liveTickRef.current));
    };
    (window as unknown as Record<string, unknown>).__qaSetLegendHover = (
      i: number | null,
    ) => setHoveredIndex(i);
  }, [n]);

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ChartLegendHoverProvider
          hoveredIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
        >
          <LineChart data={data} onPhaseChange={onPhaseChange}>
            <Grid horizontal />
            <Line
              dataKey="seriesA"
              curve={curveNatural}
              stroke="var(--chart-line-primary)"
              showMarkers
              markers={{ radius: 5, fill: "var(--chart-line-primary)" }}
              dashFromIndex={dashFromIndex}
              dashArray="6,4"
            />
            <Line
              dataKey="seriesB"
              curve={curveNatural}
              stroke="var(--chart-line-secondary)"
            />
            <XAxis />
            <YAxis />
            <ChartTooltip />
            <ChartMarkers items={markerItems} />
          </LineChart>
        </ChartLegendHoverProvider>
      </div>
      <div style={{ width: 220 }}>
        <ChartLegend
          hoveredIndex={hoveredIndex}
          items={LEGEND_ITEMS}
          onHover={setHoveredIndex}
          title="Series"
        />
      </div>
    </div>
  );
}
