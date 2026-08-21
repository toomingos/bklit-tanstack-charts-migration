// Migrated twin of bklit-patternarea.tsx. Migrated PatternArea/AreaConfig
// takes the convenience `patternPreset` prop (plan-loop-1 ruling 1) plus a
// raw `fill: string` escape hatch -- area-chart.tsx already resolves
// `patternPreset` -> its own D228-safe sibling-defs <svg> internally
// (`resolvedPatternAreas`/`patternDefs`, placed after <Chart>), so this
// scenario just passes `patternPreset` directly; no manual defs plumbing
// needed on this side (unlike bklit's raw-URL shape).
// `window.__qaSetPatternPreset` cycles through the 8 PATTERN_PRESET_IDS
// (ruling 7), routed through the SAME state area-chart.tsx reads for
// `patternPreset`, exercising the real prop path.
import { useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import { AreaChart, Area, PatternArea, Grid, XAxis, ChartTooltip } from "@migrated/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

// Local literal-union mirror of internal/pattern-preset.tsx's PatternPresetId
// (not re-exported from the top-level @migrated/charts barrel -- see final
// report's disclosed barrel-export gap). Order matches PATTERN_PRESET_IDS.
type PatternPresetId =
  | "none"
  | "diagonal"
  | "horizontal"
  | "vertical"
  | "cross"
  | "dots"
  | "circles"
  | "accent";
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
