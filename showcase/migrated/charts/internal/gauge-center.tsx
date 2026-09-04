/*
 * Arc overlay rolls in from zero on first mount while linear stat passes through un-animated,
 * preserving bklit's genuine orientation difference; layout uses inline flexbox outside Tailwind scan.
 */
import type { ReactElement } from "react";
import { CenterShell } from './center-stat';
import type { CenterStatFormat } from './center-stat';

// Arc stat box tracks 20% of the square reference size (52px floor), inset 16px
// For the container-query basis of the clamp() value/label font sizes.
const GAUGE_CENTER_RADIUS_FRACTION = 0.2;
const GAUGE_CENTER_MIN_RADIUS_PX = 52;
const GAUGE_CENTER_BOX_INSET_PX = 16;

type GaugeLabelPlacement = "top" | "bottom" | "left" | "right";
type GaugeLabelAlign = "start" | "center" | "end";

interface GaugeCenterOverlayProps {
  readonly centerValue: number;
  /** The arc gauge's square reference size (`min(width, height)`) — sizes the
      stat box to `innerRadius*2 - 16` px square, the container-query basis
      for the clamp() value/label font sizes. Must NOT be the full chart
      overlay size: that coincidentally matches at bench sizes (both hit the
      clamp caps) but diverges for any gauge small enough to fall under the cap. */
  readonly contextSize: number;
  readonly defaultLabel: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly formatOptions?: CenterStatFormat;
}

// The double-rAF 0→value intro state machine lives in CenterShell as the
// Opt-in `intro` prop; sizing stays per-part.
const GaugeCenterOverlay = ({
  centerValue,
  contextSize,
  defaultLabel,
  prefix,
  suffix,
  formatOptions,
}: Readonly<GaugeCenterOverlayProps>): ReactElement => {
  const innerRadiusPx = Math.max(contextSize * GAUGE_CENTER_RADIUS_FRACTION, GAUGE_CENTER_MIN_RADIUS_PX);
  const centerSize = innerRadiusPx * 2 - GAUGE_CENTER_BOX_INSET_PX;

  return (
    <CenterShell
      centerSize={centerSize}
      formatOptions={formatOptions}
      intro
      label={defaultLabel}
      prefix={prefix}
      suffix={suffix}
      value={centerValue}
    />
  );
}

export { GaugeLabelStat } from "./gauge-label-stat";
export { GaugeLabelLayout } from "./gauge-label-layout";
export type { GaugeLabelStatProps } from "./gauge-label-stat";
export type { GaugeLabelLayoutProps } from "./gauge-label-layout";
export { GaugeCenterOverlay };
export type { GaugeLabelPlacement, GaugeLabelAlign, GaugeCenterOverlayProps };
