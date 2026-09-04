// Doc-idiom PatternArea (raw fill URL + hand-authored defs); preset defs pre-rendered in a sibling svg.
// Keep sibling svg AFTER AreaChart: first-svg lookup must resolve to the real chart svg.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { curveNatural } from "@visx/curve";
import {
  AreaChart,
  Area,
  PatternArea,
  PatternLines,
  Grid,
  XAxis,
  ChartTooltip,
  renderPatternPreset,
  type PatternPresetId,
} from "@bklitui/ui/charts";
import {
  generateTimeSeries,
  generateTimeSeriesUpdate,
  type SeededRow,
} from "../../../data";
import { armBklitSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";
import { appendLiveRow } from "../bench/live";

const DEFAULT_PATTERN: PatternPresetId = "diagonal";
const PRESET_BASE_ID = "bklit-patternarea-preset";
// Default (non-cycling) pattern; matches the docs demo exactly.
const DOC_PATTERN_ID = "bklit-patternarea-doc";

export default function BklitPatternArea({ n }: { n: number }) {
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
    // Cycling hook swaps the referenced url(#id) only; all defs are always present.
    (window as unknown as Record<string, unknown>).__qaSetPatternPreset = (
      id: PatternPresetId,
    ) => setPattern(id);
  }, [n]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <AreaChart
        data={data}
        animationDuration={1100}
        onPhaseChange={onPhaseChange}
      >
        <PatternLines
          height={6}
          id={DOC_PATTERN_ID}
          orientation={["diagonal"]}
          stroke="var(--chart-1)"
          strokeWidth={1}
          width={6}
        />
        <Grid horizontal />
        <PatternArea
          dataKey="seriesA"
          fill={
            pattern === DEFAULT_PATTERN
              ? `url(#${DOC_PATTERN_ID})`
              : pattern === "none"
                ? "var(--chart-1)"
                : `url(#${PRESET_BASE_ID}-${pattern})`
          }
          curve={curveNatural}
        />
        <Area dataKey="seriesA" curve={curveNatural} fillOpacity={0} strokeWidth={2.5} />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
      {/* Preset defs: 0x0 sibling AFTER the chart so first-svg lookup still hits the chart. */}
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <defs>
          {(
            [
              "diagonal",
              "horizontal",
              "vertical",
              "cross",
              "dots",
              "circles",
              "accent",
            ] as PatternPresetId[]
          ).map((id) => (
            <Fragment key={id}>
              {renderPatternPreset(id, `${PRESET_BASE_ID}-${id}`, {
                color: "var(--chart-1)",
              })}
            </Fragment>
          ))}
        </defs>
      </svg>
    </div>
  );
}
