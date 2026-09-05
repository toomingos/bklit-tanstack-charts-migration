// V1.3 HOC fixture: wrapped carriers resolve via the scan.
// Lone carriers throw; unknown divs are ignored.
import { createElement, memo } from "react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { AreaChart } from "@/migrated/charts/area-chart";
import { Area } from "@/migrated/charts/internal/area-child";
import { Grid } from "@/migrated/charts/internal/grid-child";
import { extractChildren } from "@/migrated/charts/internal/children-extract";
import type { AreaConfig, ChartDatum } from "@/migrated/charts/internal/types";

const DAY_ONE_MS = 86_400_000;
const DAY_TWO_MS = 172_800_000;
const DAY_THREE_MS = 259_200_000;
const LESS_THAN_CODE = 60;

const HOC_ROWS: ChartDatum[] = [
  { date: new Date(DAY_ONE_MS), seriesA: 1, seriesB: 2 },
  { date: new Date(DAY_TWO_MS), seriesA: 2, seriesB: 1 },
  { date: new Date(DAY_THREE_MS), seriesA: 3, seriesB: 3 },
];

// Memoised carrier: unwraps to the inner marker.
const MemoArea = memo(Area);

// HOC with the legacy displayName: resolves via the name fallback.
const HocArea = (props: AreaConfig): ReactElement => createElement(Area, props);
HocArea.displayName = "Area";

// Plain wrapper: ignored by the scan, picked up via the registry union.
const PlainHocArea = (properties: AreaConfig): ReactElement =>
  createElement(Area, properties);

// Full chart: memo plus HOC areas paint; the div is ignored.
const renderHocAreaHtml = (): string =>
  renderToString(
    <AreaChart ariaLabel="HOC fixture" data={HOC_ROWS}>
      <MemoArea dataKey="seriesA" strokeWidth={2.5} fillOpacity={0.4} />
      <HocArea dataKey="seriesB" strokeWidth={2} fillOpacity={0.3} />
      <div data-testid="unknown-child" />
    </AreaChart>,
  );

// Scan level: memo plus displayName HOC resolve; the plain wrapper does not.
const scanHocAreas = (): number =>
  extractChildren(
    <>
      <MemoArea dataKey="seriesA" />
      <HocArea dataKey="seriesB" />
      <PlainHocArea dataKey="seriesC" />
      <div data-testid="unknown-child" />
    </>,
  ).areas.length;

// Union level: a rendered plain wrapper merges; a re-seen object dedupes.
interface RegistryUnionCounts {
  readonly deduped: number;
  readonly merged: number;
}

const mergeRegistryAreas = (): RegistryUnionCounts => {
  const scanned = createElement(Area, { dataKey: "seriesA" });
  const merged = extractChildren(scanned, [
    { key: null, props: { dataKey: "seriesC" }, role: "area" },
  ]).areas.length;
  const deduped = extractChildren(scanned, [
    { key: null, props: scanned.props, role: "area" },
  ]).areas.length;
  return { deduped, merged };
};

// Failure mode: a carrier with no chart above throws the legacy message.
const captureStandaloneGridThrow = (): string => {
  try {
    renderToString(<Grid />);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "NO_THROW";
};

// Unknown children carry no config and never throw.
interface DivProbeResult {
  readonly areas: number;
  readonly gridNull: boolean;
  readonly lines: number;
}

const divProbe = (): DivProbeResult => {
  const found = extractChildren(<div data-testid="unknown-child" />);
  return {
    areas: found.areas.length,
    gridNull: found.grid === null,
    lines: found.lines.length,
  };
};

// Single summary for the check script: primitives only, no casts needed.
interface HocFixtureSummary {
  readonly areaPathPresent: boolean;
  readonly deduped: number;
  readonly divAreas: number;
  readonly divGridNull: boolean;
  readonly divLines: number;
  readonly htmlLength: number;
  readonly scanned: number;
  readonly standaloneMessage: string;
  readonly unionMerged: number;
}

const checkHoc = (): HocFixtureSummary => {
  const svgNeedle = `${String.fromCodePoint(LESS_THAN_CODE)}svg`;
  const pathNeedle = `${String.fromCodePoint(LESS_THAN_CODE)}path`;
  const html = renderHocAreaHtml();
  const scanned = scanHocAreas();
  const union = mergeRegistryAreas();
  const standaloneMessage = captureStandaloneGridThrow();
  const div = divProbe();
  return {
    areaPathPresent: html.includes(svgNeedle) && html.includes(pathNeedle),
    deduped: union.deduped,
    divAreas: div.areas,
    divGridNull: div.gridNull,
    divLines: div.lines,
    htmlLength: html.length,
    scanned,
    standaloneMessage,
    unionMerged: union.merged,
  };
};

export {
  captureStandaloneGridThrow,
  checkHoc,
  divProbe,
  mergeRegistryAreas,
  renderHocAreaHtml,
  scanHocAreas,
};
