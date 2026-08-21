// Migrated brush scenario — IDENTICAL composition to bklit-brush.tsx (same
// tree, same props, same seeded data), only the import source and the two
// layout component names change (bklit ChartBrushLayout → migrated
// BrushLayout; ChartBrush keeps its name). This is the point: the migrated
// brush must be a drop-in for the bklit docs-demo composition
// (repos/bklit-ui/apps/web/components/docs/line-chart-brush-demo.tsx).
// See bklit-brush.tsx for the full scenario contract (__qaSetBrush hook,
// settle, live/update ticks) — mirrored here line-for-line.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrushLayout,
  ChartBrush,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  XAxis,
} from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

// repos/bklit-ui/apps/web/components/docs/line-chart-brush-demo.tsx:25
const brushStripMargin = { top: 4, right: 40, bottom: 4, left: 40 };

type QaSetBrush = (startFrac: number | null, endFrac?: number) => void;
type BrushSel = { start: Date; end: Date } | null;

export default function MigratedBrush({ n, state }: { n: number; state?: "ready" | "loading" }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("brush", n),
  );
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

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
    // demo:28 gives the layout a definite height — see bklit-brush.tsx.
    <div style={{ height: 360, minHeight: 0 }}>
      <BrushLayout
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
      </BrushLayout>
    </div>
  );
}
