// Docs brush-demo port; __qaSetBrush commits through the layout's own handler (same path as a drag).
// Strip chart is non-animated so only the main chart gates settle.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChartBrush,
  ChartBrushLayout,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  XAxis,
} from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

// Demo's own strip margin.
const brushStripMargin = { top: 4, right: 40, bottom: 4, left: 40 };

type QaSetBrush = (startFrac: number | null, endFrac?: number) => void;
type BrushSel = { start: Date; end: Date } | null;

export default function BklitBrush({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("brush", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  // Forward into the layout-owned handler; refs track latest data/handler for the QA hook.
  const dataRef = useRef(data);
  dataRef.current = data;
  const commitRef = useRef<((sel: BrushSel) => void) | null>(null);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("brush", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("brush", n, prev, liveTickRef.current));
    };
    (window as unknown as Record<string, unknown>).__qaSetBrush = ((
      startFrac: number | null,
      endFrac?: number,
    ) => {
      const commit = commitRef.current;
      if (!commit) return;
      if (startFrac === null || endFrac === undefined) {
        commit(null);
        return;
      }
      const rows = dataRef.current;
      if (rows.length === 0) return;
      const min = rows[0].date.getTime();
      const max = rows[rows.length - 1].date.getTime();
      commit({
        start: new Date(min + startFrac * (max - min)),
        end: new Date(min + endFrac * (max - min)),
      });
    }) satisfies QaSetBrush;
  }, [n]);

  return (
    // Fixed height: #chart-root is auto-height so "100%" would collapse.
    <div style={{ height: 360, minHeight: 0 }}>
      <ChartBrushLayout
        brushStrip={(brushLayout) => {
          commitRef.current = brushLayout.onBrushSelectionChange;
          return (
            <LineChart
              animationDuration={0}
              className="size-full"
              data={data}
              margin={brushStripMargin}
              status="ready"
              style={{ aspectRatio: "unset", height: "100%" }}
            >
              <Line
                animate={false}
                dataKey="seriesA"
                fadeEdges
                showHighlight={false}
                stroke="var(--chart-line-primary)"
                strokeWidth={2}
              />
              <ChartBrush
                initialSelection={brushLayout.brushSelection ?? undefined}
                onSelectionChange={brushLayout.onBrushSelectionChange}
                selectionPattern={{
                  color: "var(--chart-1)",
                  preset: "diagonal",
                }}
              />
            </LineChart>
          );
        }}
        data={data}
        enabled
        height={72}
      >
        {(brushLayout) => (
          <LineChart
            className="size-full"
            data={data}
            onPhaseChange={onPhaseChange}
            status={state === "loading" ? "loading" : "ready"}
            loadingLabel={state === "loading" ? "Loading data" : undefined}
            style={{ aspectRatio: "unset", height: "100%" }}
            tweenYDomainOnXDomainChange
            xDomain={brushLayout.xDomain}
            xDomainSlotCount={brushLayout.xDomainSlotCount}
            yDomainTween
          >
            <Grid horizontal stroke="var(--chart-grid)" />
            <Line
              dataKey="seriesA"
              fadeEdges
              stroke="var(--chart-line-primary)"
              strokeWidth={2}
            />
            <XAxis />
            <ChartTooltip />
          </LineChart>
        )}
      </ChartBrushLayout>
    </div>
  );
}
