// SeriesPointMarker registering child: the series overlay owns the paint; this carrier
// Registers props (and throws outside a chart) so the public component keeps its legacy type.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { SeriesPointMarkerStyle } from "./types";

interface SeriesPointMarkerProps extends SeriesPointMarkerStyle {
  readonly dataKey: string;
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly revealDelay: number;
  readonly revealEpoch: number;
  readonly enterDuration: number;
}

/** Motion enter marker — used only while the chart reveal is running. */
const SeriesPointMarker: ((props: SeriesPointMarkerProps) => ReactElement) & {
  [CHART_ROLE]?: string;
} = Object.assign(
  (props: SeriesPointMarkerProps): ReactElement => {
    useChartChild("seriesPointMarker", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "seriesPointMarker" },
);

export { SeriesPointMarker };
export type { SeriesPointMarkerProps };
