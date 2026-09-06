// MarkerGroup registering child: the marker overlay owns the paint; this carrier
// Registers props (and throws outside a chart) so the public component keeps its legacy type.
import { createElement } from "react";
import type { ReactElement, RefObject } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { ChartMarker } from "./types";

interface MarkerGroupProps {
  /** X position in pixels */
  readonly x: number;
  /** Y position (top of chart area) */
  readonly y: number;
  /** Markers at this position */
  readonly markers: ChartMarker[];
  /** Whether this marker group is currently hovered (via chart hover) */
  readonly isActive?: boolean;
  /** Size of each marker circle */
  readonly size?: number;
  /** Callback when marker group is hovered */
  readonly onHover?: (markers: ChartMarker[] | null) => void;
  /** Reference to chart container for portal positioning */
  readonly containerRef?: RefObject<HTMLDivElement | null>;
  /** Margin left offset from chart container */
  readonly marginLeft?: number;
  /** Margin top offset from chart container */
  readonly marginTop?: number;
  /** Delay before entrance animation starts */
  readonly animationDelay?: number;
  /** Whether the marker should animate in */
  readonly animate?: boolean;
  /** Height of the vertical guide line below the marker */
  readonly lineHeight?: number;
  /** Whether to show the vertical guide line. Default: true */
  readonly showLine?: boolean;
  /** Force the marker fan to open even when the user isn't hovering this group directly. */
  readonly forceOpen?: boolean;
  /** Make the icon `foreignObject` fill the entire circle (no 4px inset). */
  readonly iconFill?: boolean;
  /** Override the marker circle's stroke color. */
  readonly borderColor?: string;
  /** Marker circle stroke width in px. Default 1.5. */
  readonly borderWidth?: number;
  /** Cap the number of markers rendered in the fan-out arc. */
  readonly maxFanned?: number;
  /** Fade this marker group when another cluster has focus. */
  readonly isMuted?: boolean;
}

const MarkerGroup: ((props: MarkerGroupProps) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: MarkerGroupProps): ReactElement => {
    // Only the marker payload registers; no reader consumes this role.
    useChartChild("markerGroup", { items: props.markers });
    return createElement("g");
  },
  { [CHART_ROLE]: "markerGroup", displayName: "MarkerGroup" },
);

export { MarkerGroup };
export type { MarkerGroupProps };
