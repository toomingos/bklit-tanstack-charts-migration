"use client";
// bklit LiveLineChart on native TanStack Charts: the streaming scroll is the native `motion.path` rolling contract (linear tween one sample interval long), not a rAF loop.
// Config comes from LiveLine / LiveXAxis / LiveYAxis / ChartTooltip carrier children; see live-line/ for the pieces.
import { erase } from "./kit/erased-types";
import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { motion } from "@tanstack/charts/motion";
import { readChildren, propsFor } from "./kit/read-children";
import { warnUnrenderedChildren } from "./kit/stable-children";
import { BklitTooltipBody } from "./kit/tooltip/tooltip-body";
import { RendererChart } from "./kit/tooltip/tooltip-leaf";
import { useParentSizeWidth } from "./kit/size/parent-size-arm";
import { bklitSurfaceStyle } from "./kit/theme";
import type { ChartMargin } from "./kit/theme";
import type { ChartTooltipProps } from "./kit/types";
import type { LiveLineConfig, LiveXAxisConfig, LiveYAxisConfig } from "./live-line/carriers";
import { defaultFormatTime, defaultFormatValue } from "./live-line/live-format";
import { useLiveBuilt } from "./live-line/live-built";
import { useLiveFocus } from "./live-line/live-focus";
import { useLiveFrame } from "./live-line/live-frame-build";
import { parseHeight, useLivePlot } from "./live-line/live-geometry";
import { liveHostVars } from "./live-line/live-host-style";
import { LivePillFilter } from "./live-line/live-pill";
import { TICK_FADE_CSS } from "./live-line/live-tick-fade";
import { liveTooltipEqual, useLiveTooltipOptions } from "./live-line/live-tooltip";
import { LiveYLabels, Y_LABEL_GAP } from "./live-line/live-ylabels";
import "./styles.css";
import "./live-line/liveline.css";
import { useSanitizedId } from "./kit/use-sanitized-id";

export interface LiveLinePoint {
  readonly time: number;
  readonly value: number;
}

export interface LiveLineChartProps {
  readonly data: LiveLinePoint[];
  readonly value: number;
  readonly dataKey?: string;
  readonly window?: number;
  readonly numXTicks?: number;
  readonly nowOffsetUnits?: number;
  readonly exaggerate?: boolean;
  readonly lerpSpeed?: number;
  readonly margin?: Partial<ChartMargin>;
  readonly paused?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

const DEFAULT_MARGIN: ChartMargin = { top: 24, right: 16, bottom: 32, left: 16 };
const LERP_SPEED = 0.08;

export const LiveLineChart = ({
  data,
  value,
  dataKey = "value",
  window: windowSecs = 30,
  numXTicks = 5,
  nowOffsetUnits = 0,
  exaggerate = false,
  lerpSpeed = LERP_SPEED,
  margin: marginProp,
  paused = false,
  children,
  className,
  style,
  ariaLabel = "Live line chart",
  ariaDescription,
}: Readonly<LiveLineChartProps>): ReactElement => {
  const uid = `l${useSanitizedId()}`;
  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const table = useMemo(() => { warnUnrenderedChildren(children, "LiveLineChart"); return readChildren(children); }, [children]);
  const line = propsFor<LiveLineConfig>(table, "liveLine").at(0);
  const xAxis = propsFor<LiveXAxisConfig>(table, "liveXAxis").at(0);
  const yAxis = propsFor<LiveYAxisConfig>(table, "liveYAxis").at(0);
  const tooltipCfg = propsFor<ChartTooltipProps>(table, "tooltip").at(0);
  const key = line?.dataKey ?? dataKey;
  const formatValue = line?.formatValue ?? defaultFormatValue;
  const formatTime = xAxis?.formatTime ?? defaultFormatTime;
  const tooltipEnabled = tooltipCfg !== undefined;
  const height = parseHeight(style?.height);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  // Host width for the plot geometry. bklit mounts under `<ParentSize debounceTime={10}>` (live-line-chart.tsx:663); the first width arrives on the same chain (observer, then one frame; kit/size/parent-size-arm.tsx).
  // The frame builder and plot geometry (`useLivePlot`, `useLiveFrame`) need the width before the first scene, so TanStack's host cannot size this chart (TanStack-native host sizing only brings a first-layout paint).
  // Later widths come from the renderer's scene, `onRender({ scene })` (`ChartScene extends ChartSize`, dom-types.ts:243).
  const [hostRef, measuredWidth] = useParentSizeWidth<HTMLDivElement>();
  const [sceneWidth, setSceneWidth] = useState(0);
  const width = sceneWidth || Math.round(measuredWidth ?? 0);
  const rightAxis = yAxis?.position === "right";
  const { bklitWidth, pxPerMs, stepSecs, plotRight, plotWidth, rollEdge, plotMargin, clipExt, labelShift } = useLivePlot({ width, data, windowSecs, numXTicks, nowOffsetUnits, margin, rightAxis });

  const minGap = yAxis?.minGap ?? 36;
  const { frame, state, yPick } = useLiveFrame({ width, data, value, dataKey: key, top: margin.top, windowSecs, exaggerate, lerpSpeed, paused, pxPerMs, plotWidth, stepSecs, innerHeight, minGap, plotRight, rollEdge });

  const stroke = line?.stroke ?? "var(--chart-line-primary)";
  const momentumStroke = frame && line?.momentumColors ? line.momentumColors[frame.momentum] : stroke;
  const dotPalette = line?.momentumColors ?? { up: "var(--chart-1)", down: "var(--chart-5)", flat: stroke };
  const dotColor = frame ? dotPalette[frame.momentum] : stroke;
  const { built, hoverBounds, pad, headCss, introEaseCss } = useLiveBuilt({ frame, width, margin, plotMargin, innerHeight, windowSecs, numXTicks, lerpSpeed, pxPerMs, uid, dataKey: key, momentumStroke, dotColor, line, xAxis, yAxis, tooltipCfg, tooltipEnabled, formatValue, formatTime });

  // First paint skips the entrance; every later update is the roll.
  const renderer = useMemo(() => motion({ initial: false }), []);
  const tooltipOptions = useLiveTooltipOptions({ formatTime, formatValue, dataKey: key, stroke: momentumStroke, tooltipCfg });
  const { onRender, onFocusChange } = useLiveFocus({ hostRef, frame, state, hoverBounds, left: margin.left, top: margin.top, innerHeight, pxPerMs, hosted: built !== null, setSceneWidth });

  if (!built) {
    return <div ref={hostRef} className={className} style={{ width: "100%", ...style, height }} data-bkm-chart="liveline" />;
  }
  return (
    <div
      ref={hostRef}
      className={className}
      data-bkm-chart="liveline"
      data-uid={uid}
      data-slot="chart"
      data-bkm-rolling={frame?.seed === true ? undefined : ""}
      data-bkm-jump={frame?.jump === true && !frame.seed ? frame.parity : undefined}
      data-bkm-roll={frame && !frame.seed ? frame.parity : undefined}
      style={{ width: "100%", position: "relative", ...bklitSurfaceStyle, ...style, height, ...liveHostVars({ frame, pad, bklitWidth, plotRight, plotLeft: margin.left, clipExt, lerpSpeed, introEaseCss, fillRamp: built.fillRamp }) }}
    >
      <style>{TICK_FADE_CSS + headCss}</style>
      {/* bklit's LiveYAxis: an absolute inset-0, pointer-events-none layer over the plot (live-y-axis.tsx:188-191). It comes first
          so the line's chart (and its tooltip) paints above it. */}
      {frame ? (
        <LiveYLabels
          frame={frame}
          roll={state}
          pick={yPick}
          height={height}
          margin={plotMargin}
          top={margin.top}
          innerHeight={innerHeight}
          minGap={minGap}
          lerp={lerpSpeed}
          allowDecimals={yAxis?.allowDecimals !== false}
          position={yAxis?.position ?? "left"}
          format={yAxis?.formatValue ?? formatValue}
          labelBox={(rightAxis ? margin.right : margin.left) - Y_LABEL_GAP}
          labelShift={labelShift}
        />
      ) : null}
      <RendererChart
        definition={erase(built.definition)}
        idPrefix={uid}
        renderer={renderer}
        height={height}
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        onRender={erase(onRender)}
        onFocusChange={onFocusChange}
        tooltipEqual={liveTooltipEqual}
        renderTooltipBody={({ points }) => <BklitTooltipBody points={points} options={tooltipOptions} />}
      />
      <LivePillFilter />
    </div>
  );
};
