"use client";
// SeriesBar config carrier: renders nothing. ComposedChart reads its props with
// `readChildren` (role "seriesBar") and compiles them into native rect marks.
import type { ReactElement } from "react";
import { CHART_ROLE } from "../kit/role";


export interface SeriesBarProps {
  /** Key in data for bar height (y value). */
  readonly dataKey: string;
  /** Fill color. Default: var(--chart-line-primary). */
  readonly fill?: string;
  /** Tooltip dot color when fill is a gradient/pattern. Default: fill. */
  readonly stroke?: string;
  /** Corner radius of the bar's corners (bklit rx/ry). Default: 0. */
  readonly radius?: number;
  /** Animate the grow from the baseline. Default: true. */
  readonly animate?: boolean;
  /** Opacity of non-hovered bars while another x is focused. Default: 0.3. */
  readonly fadedOpacity?: number;
}

const SeriesBarCarrier = (_props: Readonly<SeriesBarProps>): ReactElement | null => null;

export const SeriesBar = Object.assign(SeriesBarCarrier, {
  [CHART_ROLE]: "seriesBar",
  displayName: "SeriesBar",
});
