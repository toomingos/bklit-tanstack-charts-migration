// Migrated SeriesMarkers point grid + dash-tail + ChartMarkers fan-out
// scenario — IDENTICAL composition to bklit-markers.tsx (same tree, same
// props, same seeded data + marker cluster), only the import source
// changes (migrated `ChartMarkers` is a null-render child-role component
// whose props the LineChart host extracts, vs bklit's own
// context-consuming renderer — same public JSX shape either way). See
// bklit-markers.tsx for the full scenario contract (marker
// cluster/single-date picks, dash-tail config, legend-hover pairing).
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
} from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armManualSettle } from "../bench/settle";
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

// D305 / docs/phase-4/LOG.md D300 — the marker-dot reveal outlives the phase
// that `armBklitSettle` keys on, so an unmargined `__benchSettled` resolves
// mid-reveal and EVERY QA `markers` capture is taken with the dots still
// fading in (measured: absent at +0ms, blurred at +150, crisp at +400; bklit
// is complete at +0). The margin is DERIVED FROM SOURCE, not from that
// stopwatch number — `showcase/migrated/charts/line-chart.tsx`
// `doMarkerReveal` (:662-689):
//
//   delaySec = (leadingEdge / innerW) * durationSec                    (:681)
//   circle.animate([...], { duration: 500, delay: delaySec * 1000 })   (:684)
//
// CORRECTED 2026-08-25 (D316) — the first version of this margin was 500ms +
// 2 frames and it MEASURED WORSE (markers n=100 settled 0.2397 -> 0.7317).
// The diff PNG showed why: red massed on the RIGHT two-thirds of the marker
// band, grey on the left third — a left-to-right stagger caught mid-flight,
// i.e. the margin was too SHORT, not too long.
//
// The error was reading `delaySec` as if it were measured from the clip
// sweep's start. It is not. `doMarkerReveal()` is deferred by double-rAF +
// setTimeout(0) (:691-696) and each `delay` is counted from the moment
// `.animate()` is CALLED, inside that deferred callback — and the chart
// reports `ready` before that timeline runs out. So the full tail past
// `ready` is the whole stagger, not just the last dot's fade:
//
//   rightmost dot start  ~= animationDuration   (delay, :681 — leadingEdge
//                                                /innerW -> ~1)
//   + its own fade       =  500                 (duration literal, :684)
//   + deferred setup     ~= 2 frames            (:691-696)
//
// The `+0` capture this replaced passed (0.2397) for a fragile reason worth
// recording: it fired BEFORE `doMarkerReveal` had attached any animation, so
// the dots were still painted at their default full opacity and happened to
// match bklit. That is the D300 fragility, not a correct capture — the honest
// one is post-reveal.
//
// 1100 is the chart's default animationDuration (the six private
// DEFAULT_ANIMATION_DURATION_MS copies P5.2 is chartered to centralize); this
// scenario does not override it. If that default, or the `duration: 500`
// literal at line-chart.tsx:684, ever changes, this must change with it.
// Same margin principle as `REVEAL_CLOCK_MARGIN_MS` in bklit-radar.tsx:120-130.
// Applied to the MIGRATED scenario only: bklit's dots are complete at +0, so
// margining it would only add dead time.
// Accepted risk (D305 §6): a settle margin can absorb a future regression
// that delays the dots further — inherent to every margin in this harness.
const MARKER_REVEAL_TAIL_MS = 1100 + 500 + Math.ceil(2 * (1000 / 60));

export default function MigratedMarkers({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("markers", n),
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  // `armManualSettle` rather than `armBklitSettle`, for the reason its own
  // doc comment gives (settle.ts:142-148): the shared 2500ms `FALLBACK_MS` is
  // sized for the ~1100ms one-shot reveals every other pilot chart races, and
  // it would fire — silently reporting "settled" — before `ready` +
  // MARKER_REVEAL_TAIL_MS (~1633ms past a `ready` that itself lands ~1100ms
  // in). The net has to sit ABOVE the true end, not below it, exactly as
  // bklit-radar.tsx:139-140 sizes its own. This keeps the honest phase
  // trigger — we still resolve off the chart's own `ready`, not off a timer —
  // and only raises the safety net.
  const { resolve: resolveSettled } = useMemo(
    () => armManualSettle(MARKER_REVEAL_TAIL_MS + 3000),
    [],
  );
  // Mirrors `armBklitSettle`'s `sawNonReady` latch: a `ready` that arrives
  // without a preceding non-ready phase is not a completed reveal.
  const sawNonReadyRef = useRef(false);
  const onPhaseChange = useMemo(
    () => (phase: string) => {
      if (phase !== "ready") {
        sawNonReadyRef.current = true;
        return;
      }
      if (!sawNonReadyRef.current) return;
      window.setTimeout(resolveSettled, MARKER_REVEAL_TAIL_MS);
    },
    [resolveSettled],
  );
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
