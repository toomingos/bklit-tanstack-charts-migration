// SeriesMarkers registering child: the series overlay owns the paint; this carrier
// Registers props (and throws outside a chart) so the public component keeps its legacy type.
import { createElement } from "react";
import type { ReactElement } from "react";
import { CHART_ROLE } from "./chart-child-carrier";
import { useChartChild } from "./use-chart-child";
import type { SeriesPointMarkerStyle } from "./types";

interface SeriesMarkersProps extends SeriesPointMarkerStyle {
  readonly dataKey: string;
  /** Marker fill color. Defaults to series stroke or chart palette color. */
  readonly fill?: string;
  /** Whether to animate markers with clip reveal. Default: true */
  readonly animate?: boolean;
}

const SeriesMarkers: ((props: SeriesMarkersProps) => ReactElement) & {
  [CHART_ROLE]?: string;
  displayName: string;
} = Object.assign(
  (props: SeriesMarkersProps): ReactElement => {
    useChartChild("seriesMarkers", props);
    return createElement("g");
  },
  { [CHART_ROLE]: "seriesMarkers", displayName: "SeriesMarkers" },
);

export { SeriesMarkers };
export type { SeriesMarkersProps };
