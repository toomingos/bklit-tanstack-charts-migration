// Standalone bklit `LineLoadingPulseStroke`: the stroke grows in from the left, then exits to the right, as a CSS clip-path
// keyframe on the path (styles.css `bkm-loading-*`); no rAF. Chart-attached series use the same keyframes via `loading-css.ts`.
import type { CSSProperties, ReactElement } from "react";
import "../../styles.css";
import { useOptionalChartStable } from "../cartesian/chart-context";
import { REVEAL_CSS_EASE } from "../motion/easing";
import type { LineLoadingPulseMode } from "../motion/phase";
import { useSanitizedId } from "../use-sanitized-id";

export type { LineLoadingPulseMode } from "../motion/phase";

export interface LineLoadingPulseStrokeProps {
  pathD: string;
  mode?: LineLoadingPulseMode;
  /** Bumps to restart loop cycles without remounting the stroke. */
  loopEpoch?: number;
  stroke?: string;
  /** Stroke opacity for the animated segment. Default: 0.5 */
  strokeOpacity?: number;
  strokeWidth?: number;
  onCycleComplete?: () => void;
  /** Plot width, when rendered outside a chart. Default: the chart's inner width. */
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
