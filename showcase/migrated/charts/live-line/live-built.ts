// What the live chart derives from a frame for its render: the x tick slots, the hover area, the path's left cut, the head's
// badge labels and CSS, and the native definition built from them.
import { useMemo } from "react";
import type { ChartDefinition } from "@tanstack/charts";
import type { ChartMargin } from "../kit/theme";
import type { ChartTooltipProps } from "../kit/types";
import type { LiveLineConfig, LiveXAxisConfig, LiveYAxisConfig } from "./carriers";
import { buildLiveDefinition } from "./definition";
import type { LiveRow } from "./definition";
import { commitSteps, headLabels, introEasing, sampledEasing } from "./head-ease";
import type { Frame } from "./live-frame";
import { liveCss } from "./live-css";

interface UseLiveBuiltArgs {
  readonly frame: Frame | null;
  readonly width: number;
  readonly margin: ChartMargin;
  readonly plotMargin: ChartMargin;
  readonly innerHeight: number;
  readonly windowSecs: number;
  readonly numXTicks: number;
  readonly lerpSpeed: number;
  readonly pxPerMs: number;
  readonly uid: string;
  readonly dataKey: string;
  readonly momentumStroke: string;
  readonly dotColor: string;
  readonly line: LiveLineConfig | undefined;
  readonly xAxis: LiveXAxisConfig | undefined;
  readonly yAxis: LiveYAxisConfig | undefined;
  readonly tooltipCfg: ChartTooltipProps | undefined;
  readonly tooltipEnabled: boolean;
  readonly formatValue: (value: number) => string;
  readonly formatTime: (time: number) => string;
}

interface LiveBuilt {
  readonly built: { readonly definition: ChartDefinition<LiveRow, Date, number>; readonly fillRamp: { readonly top: number; readonly bottom: number } } | null;
  readonly hoverBounds: { left: number; right: number; top: number; bottom: number };
  readonly pad: number;
  readonly headCss: string;
  readonly introEaseCss: string;
}

export function useLiveBuilt({ frame, width, margin, plotMargin, innerHeight, windowSecs, numXTicks, lerpSpeed, pxPerMs, uid, dataKey: key, momentumStroke, dotColor, line, xAxis, yAxis, tooltipCfg, tooltipEnabled, formatValue, formatTime }: UseLiveBuiltArgs): LiveBuilt {
  // bklit's x labels are `numTicks` fixed slots at 0..100% of the live window; only their text re-derives as it rolls.
  // The labels under the hover pill fade natively (tickLabels.opacity reads the pointer; see live-line/definition.ts).
  const xTickTimes = useMemo(() => {
    const n = Math.max(2, xAxis?.numTicks ?? numXTicks);
    const start = frame?.xDomain[0] ?? 0;
    // xDomain is the view at the end of the roll; the labels' clock starts rollMs earlier, at the sample (live-xlabels.ts).
    return Array.from({ length: n }, (_, i) => start + (i * windowSecs * 1000) / (n - 1) - (frame?.rollMs ?? 0));
  }, [frame, xAxis?.numTicks, numXTicks, windowSecs]);
  // Only the left/right/top/bottom of bklit's hover area: the plot inside the *requested* margin (the native plot is wider).
  const hoverBounds = useMemo(
    () => ({ left: margin.left, right: (width || 800) - margin.right, top: margin.top, bottom: margin.top + innerHeight }),
    [margin, width, innerHeight],
  );

  // Left path cut in px, applied by CSS clip-path in the path's own coordinates (so it rides the rolling transform):
  // the left pad rows are invisible; the path starts at the first real sample (bklit's fade mask is a cut at the dot).
  const pad = useMemo(() => {
    // The drawn path spans rows[1..length-2] (see smoothRows): the end rows only seed its tangents.
    const rows = frame?.rows ?? [];
    const first = rows.findIndex((r) => !r.pad);
    const start = rows.at(1);
    const firstReal = rows.at(first);
    return first > 1 && firstReal !== undefined && start !== undefined ? Math.round((firstReal.t - start.t) * pxPerMs * 10) / 10 : 0;
  }, [frame, pxPerMs]);
  const labels = useMemo(() => (frame ? headLabels(frame.disp0, frame.tip?.v ?? 0, lerpSpeed, formatValue) : []), [frame, lerpSpeed, formatValue]);
  const headCss = useMemo(() => liveCss(lerpSpeed), [lerpSpeed]);

  const introEase = useMemo(() => introEasing(lerpSpeed, frame?.rollMs ?? 600), [lerpSpeed, frame?.rollMs]);
  // The same easing as a CSS timing function, for the tail's intro slide (live-css.ts).
  const introEaseCss = useMemo(() => sampledEasing(introEase), [introEase]);
  const built = useMemo(
    () =>
      frame
        ? buildLiveDefinition({
            rows: frame.rows,
            xDomain: frame.xDomain,
            yDomain: frame.yDomain,
            areaFloor: frame.areaFloor,
            margin: plotMargin,
            uid,
            dataKey: key,
            stroke: momentumStroke,
            strokeWidth: line?.strokeWidth ?? 2,
            dotColor,
            dotSize: line?.dotSize ?? 4,
            fill: line?.fill !== false,
            badge: line?.badge !== false,
            badgeLabels: labels,
            badgeParity: frame.parity,
            dispV: frame.disp0,
            pxPerMs,
            still: frame.seed,
            tipEase: !frame.intro && !frame.seed,
            yJump: frame.jump,
            tip: frame.tip,
            rollMs: frame.rollMs,
            easing: frame.intro ? introEase : (p: number) => Math.floor(p * commitSteps(frame.rollMs)) / commitSteps(frame.rollMs),
            xTickTimes,
            hoverBounds,
            formatTime,
            formatValue: yAxis?.formatValue ?? formatValue,
            yPosition: yAxis?.position ?? "left",
            plotHeight: innerHeight,
            showCrosshair: tooltipCfg?.showCrosshair !== false,
            showDots: tooltipCfg?.showDots !== false,
            hoverDotSize: (tooltipCfg?.dotSize ?? 5) * (tooltipCfg?.dotScale ?? 1),
            showPill: xAxis !== undefined,
            tooltipEnabled,
            tooltipBox: tooltipCfg,
          })
        : null,
    [frame, plotMargin, uid, key, momentumStroke, dotColor, line, formatValue, formatTime, xAxis, yAxis, xTickTimes, hoverBounds, innerHeight, tooltipCfg, tooltipEnabled, introEase, labels, pxPerMs],
  );

  // First paint skips the entrance; every later update is the roll.
  return { built, hoverBounds, pad, headCss, introEaseCss };
}
