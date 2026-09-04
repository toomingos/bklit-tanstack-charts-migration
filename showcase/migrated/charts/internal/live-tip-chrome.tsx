import { useCallback } from "react";
import type { ReactElement } from "react";
import type { LiveLineConfig } from "./series-config-types";

interface LiveTipChromeProps {
  readonly cfg: Readonly<LiveLineConfig>;
  readonly dotColor: string;
  readonly getLiveGroups: () => Map<string, SVGGElement>;
  readonly groupKey: string;
  readonly liveValue: number;
  readonly liveDotX: number;
  readonly liveDotY: number;
  readonly resolvedStroke: string;
  readonly innerWidth: number;
}

// Static overlay styles hoisted so host elements reuse stable identities.
const LIVE_TIP_GROUP_STYLE = { transition: "opacity 300ms ease-in-out" } as const;

// Five chrome elements render at the throttled frame rate; scrub-dim applies imperatively.
const DEFAULT_LIVE_DOT_SIZE_PX = 4;
/** Pulse halo peak radius as a multiple of the live dot size. */
const LIVE_DOT_PULSE_RADIUS_FACTOR = 3.5;
/** Badge horizontal offset from the live dot. */
const LIVE_BADGE_OFFSET_X_PX = 12;
/** Badge width: measured label characters plus horizontal padding. */
const LIVE_BADGE_CHAR_WIDTH_PX = 7.5;
const LIVE_BADGE_HORIZONTAL_PADDING_PX = 16;

const defaultFormatValue = (value: number): string => value.toFixed(2);

interface PulseHaloOptions {
  readonly dotColor: string;
  readonly dotSize: number;
  readonly x: number;
  readonly y: number;
}

// Expanding halo ring behind the live dot; the SMIL pulses run on the compositor.
const renderPulseHalo = (options: Readonly<PulseHaloOptions>): ReactElement => (
  <circle
    cx={options.x}
    cy={options.y}
    fill="none"
    opacity={0.4}
    r={options.dotSize * 2}
    stroke={options.dotColor}
    strokeWidth={1.5}
  >
    <animate
      attributeName="r"
      dur="1.5s"
      from={String(options.dotSize)}
      repeatCount="indefinite"
      to={String(options.dotSize * LIVE_DOT_PULSE_RADIUS_FACTOR)}
    />
    <animate attributeName="opacity" dur="1.5s" from="0.5" repeatCount="indefinite" to="0" />
  </circle>
);

interface LiveBadgeOptions {
  readonly formatValue: (value: number) => string;
  readonly liveValue: number;
  readonly x: number;
  readonly y: number;
}

// Value label floating beside the live dot; width tracks the formatted text.
const renderLiveBadge = (options: Readonly<LiveBadgeOptions>): ReactElement => (
  <g transform={`translate(${options.x + LIVE_BADGE_OFFSET_X_PX},${options.y})`}>
    <rect
      fill="var(--popover)"
      height={24}
      opacity={0.95}
      rx={6}
      width={options.formatValue(options.liveValue).length * LIVE_BADGE_CHAR_WIDTH_PX + LIVE_BADGE_HORIZONTAL_PADDING_PX}
      x={0}
      y={-12}
    />
    <text
      fill="var(--popover-foreground)"
      fontFamily="SF Mono, Menlo, Monaco, monospace"
      fontSize={11}
      fontWeight={500}
      x={8}
      y={4}
    >
      {options.formatValue(options.liveValue)}
    </text>
  </g>
);

interface CrosshairLineOptions {
  readonly innerWidth: number;
  readonly resolvedStroke: string;
  readonly y: number;
}

// Horizontal dashed guide at the live value, spanning the plot width.
const renderCrosshairLine = (options: Readonly<CrosshairLineOptions>): ReactElement => (
  <line
    opacity={0.25}
    stroke={options.resolvedStroke}
    strokeDasharray="4,4"
    strokeWidth={1}
    x1={0}
    x2={options.innerWidth}
    y1={options.y}
    y2={options.y}
  />
);

interface LiveDotOptions {
  readonly dotColor: string;
  readonly size: number;
  readonly x: number;
  readonly y: number;
}

// Core live dot with its soft halo disc.
const renderLiveDot = (options: Readonly<LiveDotOptions>): ReactElement => (
  <>
    <circle cx={options.x} cy={options.y} fill={options.dotColor} opacity={0.1} r={options.size + 2} />
    <circle
      cx={options.x}
      cy={options.y}
      fill={options.dotColor}
      r={options.size}
      stroke="var(--chart-background)"
      strokeWidth={2}
    />
  </>
);

const LiveTipChrome = ({
  cfg,
  dotColor,
  getLiveGroups,
  groupKey,
  liveValue,
  liveDotX,
  liveDotY,
  resolvedStroke,
  innerWidth,
}: Readonly<LiveTipChromeProps>): ReactElement => {
  const pulse = cfg.pulse ?? true;
  const dotSize = cfg.dotSize ?? DEFAULT_LIVE_DOT_SIZE_PX;
  const badge = cfg.badge ?? true;
  const formatValue = cfg.formatValue ?? defaultFormatValue;
  const handleLiveGroupRef = useCallback(
    (element: SVGGElement | null): void => {
      const groups = getLiveGroups();
      if (element) {groups.set(groupKey, element);}
      else {groups.delete(groupKey);}
    },
    [getLiveGroups, groupKey],
  );

  return (
    <>
      {renderCrosshairLine({ innerWidth, resolvedStroke, y: liveDotY })}
      <g ref={handleLiveGroupRef} style={LIVE_TIP_GROUP_STYLE}>
        <g>
          {pulse && renderPulseHalo({ dotColor, dotSize, x: liveDotX, y: liveDotY })}
          {renderLiveDot({ dotColor, size: dotSize, x: liveDotX, y: liveDotY })}
        </g>
        {badge && renderLiveBadge({ formatValue, liveValue, x: liveDotX, y: liveDotY })}
      </g>
    </>
  );
};

export { LiveTipChrome };
export type { LiveTipChromeProps };
