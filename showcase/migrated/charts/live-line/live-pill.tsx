import type { ReactElement } from "react";

const HIDDEN_SVG_STYLE = { position: "absolute" } as const;
const FLOOD_STYLE = { floodColor: "var(--chart-date-pill-background)" } as const;

/** The date pill's merged-edge filter (liveline.css): dilate, erode and blur the label plates into one rounded shape. */
export const LivePillFilter = (): ReactElement => (
  <svg aria-hidden="true" width="0" height="0" style={HIDDEN_SVG_STYLE}>
    <filter id="bkm-live-pill" x="-60%" y="-400%" width="220%" height="900%" colorInterpolationFilters="sRGB">
      <feMorphology operator="dilate" radius="14 0" in="SourceGraphic" result="d" />
      <feMorphology operator="erode" radius="8 0" in="d" result="c" />
      <feGaussianBlur stdDeviation="8" in="c" result="b" />
      <feComponentTransfer in="b" result="t">
        <feFuncA type="linear" slope="16" intercept="-7.2" />
      </feComponentTransfer>
      <feFlood style={FLOOD_STYLE} result="f" />
      <feComposite in="f" in2="t" operator="in" />
    </filter>
  </svg>
);
