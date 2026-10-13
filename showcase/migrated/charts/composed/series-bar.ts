"use client";
// SeriesBar config carrier: renders nothing. ComposedChart reads its props with
// `readChildren` (role "seriesBar") and compiles them into native rect marks.
import type { ReactElement } from "react";
import { CHART_ROLE } from "../kit/role";


export interface SeriesBarProps {
  /** Key of the data field that holds the bar heights. */
  readonly dataKey: string;
  /**
   * Fill color of the bars.
   * @default "var(--chart-line-primary)"
   */
  readonly fill?: string;
  /** Color of the tooltip dot, for when `fill` is a gradient or pattern. Defaults to `fill`. */
  readonly stroke?: string;
  /**
   * Corner radius of the bars in px.
   * @default 0
   */
  readonly radius?: number;
  /**
   * Grow the bars from the baseline on entrance.
   * @default true
   */
  readonly animate?: boolean;
  /**
   * Opacity of the bars that are not hovered while another x position is focused.
   * @default 0.3
   */
  readonly fadedOpacity?: number;
}

const SeriesBarCarrier = (_props: Readonly<SeriesBarProps>): ReactElement | null => null;

/** A bar series for a `ComposedChart`, drawn together with `Line` and `Area` series. Bars are grouped by default or stacked with `stacked`. It renders nothing itself; place it as a child of the chart. */
export const SeriesBar = Object.assign(SeriesBarCarrier, {
  [CHART_ROLE]: "seriesBar",
  displayName: "SeriesBar",
});
