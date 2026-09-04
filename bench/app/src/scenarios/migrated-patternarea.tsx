// Twin of bklit-patternarea.tsx; patternPreset resolves internally, so no manual defs plumbing.
// GUARD: __qaSetPatternPreset must route through the same state the chart reads (real prop path).
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import {
  AreaChart,
  Area,
  PatternArea,
  Grid,
  XAxis,
  ChartTooltip,
  type PatternPresetId,
} from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

const DEFAULT_PATTERN: PatternPresetId = "diagonal";

export default function MigratedPatternArea({ n }: { n: number }) {
  const [data, setData] = useState<SeededRow[]>(() =>
    generateTimeSeries("patternarea", n),
  );
  const [pattern, setPattern] = useState<PatternPresetId>(DEFAULT_PATTERN);
  const tickRef = useRef(0);
  const liveTickRef = useRef(0);
  const { onPhaseChange } = useMemo(() => armBklitSettle(), []);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateTimeSeriesUpdate("patternarea", n, tickRef.current));
      });
    window.__benchLiveTick = () => {
      liveTickRef.current += 1;
      setData((prev) => appendLiveRow("patternarea", n, prev, liveTickRef.current));
    };
    (window as unknown as Record<string, unknown>).__qaSetPatternPreset = (
      id: PatternPresetId,
    ) => setPattern(id);
  }, [n]);

  return (
    <AreaChart data={data} animationDuration={1100} onPhaseChange={onPhaseChange}>
      <Grid horizontal />
      <PatternArea
        dataKey="seriesA"
        patternPreset={pattern}
        patternColor="var(--chart-1)"
        curve={curveNatural}
      />
      <Area dataKey="seriesA" curve={curveNatural} fillOpacity={0} strokeWidth={2.5} />
      <XAxis />
      <ChartTooltip />
    </AreaChart>
  );
}
