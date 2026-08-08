// Config-carrier children replicating bklit-ui's compositional chart API.
// They render nothing; LineChart walks them once and compiles a TanStack
// `defineChart` spec. One canonical role marker replaces bklit's six ad-hoc
// displayName string-matchers (research/01 §3.10).
import * as React from "react";
import type {
  AreaConfig,
  BarConfig,
  BarXAxisConfig,
  CandlestickConfig,
  ChartTooltipConfig,
  GridConfig,
  LineConfig,
  LiveLineConfig,
  LiveXAxisConfig,
  LiveYAxisConfig,
  ScatterConfig,
  SeriesBarConfig,
  XAxisConfig,
  YAxisConfig,
  ExtractedChildren,
} from "./internal/types";

export const CHART_ROLE = Symbol.for("migrated.chartRole");

type RoleCarrier = { [CHART_ROLE]?: string };

// Exported for composed-chart.tsx's own dedicated single-pass extraction
// (it needs cross-role encounter order for bklit's upsert semantics — see
// that file's `extractComposed`).
export function roleOf(type: unknown): string | undefined {
  return (type as RoleCarrier)?.[CHART_ROLE];
}

export function Line(_props: LineConfig): null {
  return null;
}
(Line as RoleCarrier)[CHART_ROLE] = "line";

export function Area(_props: AreaConfig): null {
  return null;
}
(Area as RoleCarrier)[CHART_ROLE] = "area";

export function Scatter(_props: ScatterConfig): null {
  return null;
}
(Scatter as RoleCarrier)[CHART_ROLE] = "scatter";

export function Bar(_props: BarConfig): null {
  return null;
}
(Bar as RoleCarrier)[CHART_ROLE] = "bar";

// ComposedChart's bar series (bklit series-bar.tsx). Distinct role from
// standalone <Bar> — ComposedChart does its own dedicated single-pass
// extraction (composed-chart.tsx `extractComposedSeries`) that needs
// cross-role (bar/area/line) encounter order, so `extractChildren` here
// only files it into `seriesBars` for consumers that don't need order
// (none yet — reserved for parity/future use); ComposedChart itself never
// calls `extractChildren`.
export function SeriesBar(_props: SeriesBarConfig): null {
  return null;
}
(SeriesBar as RoleCarrier)[CHART_ROLE] = "seriesBar";

export function BarXAxis(_props: BarXAxisConfig): null {
  return null;
}
(BarXAxis as RoleCarrier)[CHART_ROLE] = "barXAxis";

export function Grid(_props: GridConfig): null {
  return null;
}
(Grid as RoleCarrier)[CHART_ROLE] = "grid";

export function XAxis(_props: XAxisConfig): null {
  return null;
}
(XAxis as RoleCarrier)[CHART_ROLE] = "xAxis";

export function ChartTooltip(_props: ChartTooltipConfig): null {
  return null;
}
(ChartTooltip as RoleCarrier)[CHART_ROLE] = "tooltip";

export function Candlestick(_props: CandlestickConfig): null {
  return null;
}
(Candlestick as RoleCarrier)[CHART_ROLE] = "candlestick";

export function YAxis(_props: YAxisConfig): null {
  return null;
}
(YAxis as RoleCarrier)[CHART_ROLE] = "yAxis";

// --- LiveLineChart-only marker components (docs/LOG.md D22) ----------------
// LiveLineChart is a NEW top-level component with its own dedicated
// extraction (live-line-chart.tsx `extractLiveLineChildren`, mirroring
// composed-chart.tsx's precedent of not using the generic `extractChildren`
// below) — these are appended here only so they live alongside the other
// role-carriers/share the CHART_ROLE convention; `extractChildren` itself
// does NOT collect them (its `ExtractedChildren` shape is unchanged).
export function LiveLine(_props: LiveLineConfig): null {
  return null;
}
(LiveLine as RoleCarrier)[CHART_ROLE] = "liveLine";

export function LiveXAxis(_props: LiveXAxisConfig): null {
  return null;
}
(LiveXAxis as RoleCarrier)[CHART_ROLE] = "liveXAxis";

export function LiveYAxis(_props: LiveYAxisConfig): null {
  return null;
}
(LiveYAxis as RoleCarrier)[CHART_ROLE] = "liveYAxis";

export function displayNameOf<T extends { displayName?: string }>(
  componentType: T | null | undefined,
): string | undefined {
  return componentType?.displayName;
}

export function extractChildren(children: React.ReactNode): ExtractedChildren {
  const out: ExtractedChildren = {
    lines: [],
    areas: [],
    scatters: [],
    bars: [],
    seriesBars: [],
    grid: null,
    xAxis: null,
    barXAxis: null,
    tooltip: null,
    candlestick: null,
    yAxis: null,
  };
  const visit = (node: React.ReactNode): void => {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement(child)) continue;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        continue;
      }
      const role = roleOf(child.type);
      const props = child.props as never;
      if (role === "line") out.lines.push(props);
      else if (role === "area") out.areas.push(props);
      else if (role === "scatter") out.scatters.push(props);
      else if (role === "bar") out.bars.push(props);
      else if (role === "seriesBar") out.seriesBars.push(props);
      else if (role === "grid") out.grid = props;
      else if (role === "xAxis") out.xAxis = props;
      else if (role === "barXAxis") out.barXAxis = props;
      else if (role === "tooltip") out.tooltip = { enabled: true, ...(props as ChartTooltipConfig) };
      else if (role === "candlestick") out.candlestick = { ...(props as CandlestickConfig) };
      else if (role === "yAxis") out.yAxis = { ...(props as YAxisConfig) };
    }
  };
  visit(children);
  return out;
}
