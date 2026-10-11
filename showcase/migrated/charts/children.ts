// Config-carrier children: never rendered, compiled once into a TanStack defineChart spec.
export { Area, Background, ChartMarkers, ChartTooltip, Grid, Line, LineSeriesTerminalMarker, MarkerGroup, PatternArea, ProfitLossLine, ProjectionLine, ProjectionLineEndMarker, Scatter, SeriesMarkers, XAxis, YAxis } from "./kit/cartesian/carriers";
export { Bar, BarColumnTrack, BarDepthBack, BarDepthFront, BarDepthProvider, BarPulse, BarSquares, BarXAxis } from "./bar/carriers";
export { Candlestick } from "./candlestick/carrier";
export { LiveLine, LiveXAxis, LiveYAxis } from "./live-line/carriers";
export { SeriesBar } from "./composed/series-bar";
export { CHART_ROLE } from "./kit/role";
export type {
  LineSeriesTerminalMarkerProps,
  MarkerGroupProps,
  ProfitLossLineProps,
  ProjectionLineEndMarkerProps,
  ProjectionLineProps,
  SeriesMarkersProps,
} from "./kit/types";
