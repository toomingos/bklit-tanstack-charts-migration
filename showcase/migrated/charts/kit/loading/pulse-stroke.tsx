// Standalone bklit `LineLoadingPulseStroke`: the stroke grows in from the left, then exits to the right, as a CSS clip-path
// keyframe on the path (styles.css `bkm-loading-*`); no rAF. Chart-attached series use the same keyframes via `loading-css.ts`.
import type { CSSProperties, ReactElement } from "react";
import { useOptionalChartStable } from "../cartesian/chart-context";
import { REVEAL_CSS_EASE } from "../motion/easing";
import type { LineLoadingPulseMode } from "../motion/phase";
import { useSanitizedId } from "../use-sanitized-id";

export type { LineLoadingPulseMode } from "../motion/phase";

/** Props of `LineLoadingPulseStroke`. */
export interface LineLoadingPulseStrokeProps {
  /** SVG path data of the line to animate. */
  pathD: string;
  /**
   * `"loop"` repeats, `"exit"` plays the loading-to-ready half cycle, `"enter"` the ready-to-loading half cycle.
   * @default "loop"
   */
  mode?: LineLoadingPulseMode;
  /**
   * Change this number to restart the loop without remounting the stroke.
   * @default 0
   */
  loopEpoch?: number;
  /**
   * Line color.
   * @default "var(--chart-foreground)"
   */
  stroke?: string;
  /**
   * Opacity of the animated segment.
   * @default 0.5
   */
  strokeOpacity?: number;
  /**
   * Line width in px.
   * @default 2.5
   */
  strokeWidth?: number;
  /** Called when an `"exit"` or `"enter"` cycle finishes. */
  onCycleComplete?: () => void;
  /** Plot width in px. Only needed outside a chart; inside one it is the chart's plot width. */
  innerWidth?: number;
}

// bklit line-loading-timing.ts: 2.2s cycle + 280ms loop pause = 2.48s; enter/exit are one 1.1s half cycle.
const ANIMATION_STYLE: Readonly<Record<LineLoadingPulseMode, CSSProperties>> = {
  loop: { animation: "bkm-loading-pulse 2.48s linear infinite" },
  enter: { animation: `bkm-loading-enter 1.1s ${REVEAL_CSS_EASE} forwards` },
  exit: { animation: `bkm-loading-exit 1.1s ${REVEAL_CSS_EASE} forwards` },
};
const FADE_STOPS = [
  { offset: "0%", opacity: 0 },
  { offset: "15%", opacity: 1 },
  { offset: "85%", opacity: 1 },
  { offset: "100%", opacity: 0 },
] as const;

/** @internal */
export const LineLoadingPulseStroke = ({
  pathD,
  mode = "loop",
  loopEpoch = 0,
  stroke = "var(--chart-foreground)",
  strokeOpacity = 0.5,
  strokeWidth = 2.5,
  onCycleComplete,
  innerWidth: innerWidthProp,
}: Readonly<LineLoadingPulseStrokeProps>): ReactElement | null => {
  const chart = useOptionalChartStable();
  const innerWidth = innerWidthProp ?? chart?.innerWidth ?? 0;
  const gradientId = `line-loading-gradient-${useSanitizedId()}`;
  if (innerWidth <= 0) {
    return null;
  }
  return (
    <>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={0} x2={innerWidth} y1={0} y2={0}>
          {FADE_STOPS.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stroke} stopOpacity={stop.opacity} />
          ))}
        </linearGradient>
      </defs>
      <path
        key={loopEpoch}
        d={pathD}
        fill="none"
        onAnimationEnd={mode === "loop" ? undefined : onCycleComplete}
        onAnimationIteration={mode === "loop" ? onCycleComplete : undefined}
        opacity={strokeOpacity}
        stroke={`url(#${gradientId})`}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        style={ANIMATION_STYLE[mode]}
      />
    </>
  );
};

LineLoadingPulseStroke.displayName = "LineLoadingPulseStroke";
