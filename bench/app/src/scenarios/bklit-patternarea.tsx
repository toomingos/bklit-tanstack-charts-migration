// bklit PatternArea scenario (initiative 11, plan-loop-1 §2.1/§8, ruling 7).
// bklit's own PatternArea takes a raw `fill: string` URL and requires the
// consumer to hand-author the sibling pattern-defs component -- the doc
// idiom (verbatim, apps/web/components/docs/area-chart-pattern-demo.tsx):
//   <AreaChart data>
//     <PatternLines id="..." orientation={["diagonal"]} .../>
//     <PatternArea dataKey="desktop" fill="url(#...)" />
//     <Area dataKey="desktop" fillOpacity={0} strokeWidth={2} />
//   </AreaChart>
// PatternLines/PatternArea/Area/Grid/XAxis are all recognized as config
// children by AreaChart's own child-scanning (chart-child-passthrough.ts) --
// they are NOT literally rendered into the DOM at that JSX position.
//
// This scenario additionally needs to CYCLE through all 8 pattern-preset IDs
// (ruling 7: one cycling Q1 scenario, not 8) for parity with migrated's
// `patternPreset` convenience prop. bklit's PatternArea has no preset
// concept of its own -- the preset FAMILY lives in `renderPatternPreset`
// (pattern-preset.tsx), which IS exported from bklit's package barrel and
// used here directly. Since `renderPatternPreset`'s output isn't a named
// component AreaChart recognizes, it can't be passed as an AreaChart child;
// instead all 8 presets' <defs> are pre-rendered into a manual sibling
// 0x0 <svg>, and only the REFERENCED pattern id changes via
// `window.__qaSetPatternPreset`. Per the migrated area-chart.tsx precedent
// (§3.1, D228-safe placement), this sibling svg is placed AFTER <AreaChart>
// in the DOM so `#chart-root svg:first` (qa/screenshot.mjs's generic hover-
// sweep svgBox lookup) still resolves to the real chart svg, not the 0x0
// defs host.
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
// Doc-idiom static pattern used for the DEFAULT (non-cycling) settled/hover
// captures -- matches area-chart-pattern-demo.tsx exactly.
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
    // Cycling hook (ruling 7): drives one of the 8 PATTERN_PRESET_IDS via
    // the preset-defs sibling svg below (swaps the referenced url(#id)
    // only -- all 8 defs are always present).
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
      {/* Preset-cycling defs (ruling 7): all 8 IDs pre-rendered, sibling
          AFTER the chart, 0x0 -- see file header for the D228-class
          first-svg ordering rationale. */}
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
