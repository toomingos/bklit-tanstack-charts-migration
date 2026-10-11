// The native gauge definition: notches are `areaX` polygon marks (arc, tapered or rounded linear) or `rect` marks (plain linear).
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { defineChart } from "@tanstack/charts/scene";
import { rect } from "@tanstack/charts";
import { areaX } from "@tanstack/charts/area-x";
import type { ChartMotionContext, DomChartDefinition } from "@tanstack/charts";
import { motion } from "@tanstack/charts/motion";
import { arcPolygonVertices, linearNotches, rectLinearVertices, taperedLinearVertices } from "./notches";
import type { FillOptions, GaugeNotchRow } from "./notches";
import { notchPolygonCurve } from "./notch-path";
import { GAUGE_NOTCH_UPDATE_SPRING } from "../kit/motion/springs";

// The enter is CSS (enter-css.ts), so the native first render skips the motion enter pass (animateSvg over every notch).
export const gaugeMotion = motion({ initial: false, respectReducedMotion: true });
export const ARC_ASPECT = 21 / 16;
// Linear notches are laid out in normalized x units so no pixel measurement is needed.
const LINEAR_UNITS = 1000;
const UNIT = 1000;
// bklit's tapered linear notch: the inner (bottom) edge is 28/42 of the outer.
const TAPER_RATIO = 28 / 42;
const TIGHT_UPDATE = { transition: { ...GAUGE_NOTCH_UPDATE_SPRING, type: "spring" as const } };

// The enter is a fixed CSS scale + fade per notch (gauge/enter-css.ts), so the native renderer places notches without motion;
// a notch that stops being active is removed at once (bklit unmounts it), so only updates morph natively.
const notchMotion = (animate: boolean): ((ctx: Readonly<ChartMotionContext<GaugeNotchRow>>) => false | typeof TIGHT_UPDATE) | false => animate
  ? (ctx) => ctx.phase === "enter" || ctx.phase === "exit" ? false : TIGHT_UPDATE
  : false;

// Every notch's fill goes through the chart's native colour scale (key -> fill), so the track and the active notches are one mark each.
const bgKey = (row: GaugeNotchRow): string => `b${row.index}`;
const activeKey = (row: GaugeNotchRow): string => `a${row.index}`;
interface ColorScaleSpec {
  readonly domain: readonly string[];
  readonly range: readonly string[];
}
const fillScale = (rows: readonly GaugeNotchRow[]): ColorScaleSpec => ({
  domain: [...rows.map(bgKey), ...rows.map(activeKey)],
  range: [...rows.map((r) => r.trackFill), ...rows.map((r) => r.activeFill)],
});
const vertexFillScale = (rows: readonly GaugeNotchRow[]): ColorScaleSpec =>
  fillScale(rows.filter((r, i) => i === 0 || rows[i - 1].index !== r.index));

export interface GaugeDefinitionInput {
  readonly linear: boolean;
  readonly polygon: boolean;
  /** Pixel size of a fixed-size arc; absent when the arc fills its container. */
  readonly fixedArc: { readonly width: number; readonly height: number } | undefined;
  readonly uniformWidth: boolean | undefined;
  readonly trackHeight: number;
  readonly value: number;
  readonly spacing: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly notchCornerRadius: number;
  readonly notchLengthPercent: number;
  readonly notchWidthPercent: number;
  readonly inactiveFillOpacity: number;
  readonly activeFillOpacity: number;
  readonly animate: boolean;
  readonly fill: Omit<FillOptions, "linear">;
}

const axes = (unitsW: number, unitsH: number) => ({
  x: { axis: false, scale: scaleLinear().domain([0, unitsW]) },
  y: { axis: false, scale: scaleLinear().domain([unitsH, 0]) },
}) as const;

const linearRows = (i: GaugeDefinitionInput): GaugeNotchRow[] =>
  linearNotches({ ...i.fill, height: i.trackHeight, linear: true, notchLengthPercent: i.notchLengthPercent, notchWidthPercent: i.notchWidthPercent, spacing: i.spacing, value: i.value, width: LINEAR_UNITS });

const polygonRows = (i: GaugeDefinitionInput, unitsW: number, unitsH: number): GaugeNotchRow[] => {
  if (i.linear) {
    const rows = linearRows(i);
    return i.uniformWidth === false ? taperedLinearVertices(rows, TAPER_RATIO) : rectLinearVertices(rows);
  }
  return arcPolygonVertices({ ...i.fill, endAngle: i.endAngle, height: unitsH, linear: false, notchLengthPercent: i.notchLengthPercent, spacing: i.spacing, startAngle: i.startAngle, uniform: i.uniformWidth === true, value: i.value, width: unitsW });
};

// One areaX per notch group (z), one row per vertex with x1 = x2, so the curve receives the four pixel vertices and writes the
// (optionally corner-cut) path. Arc uses uniform units with the canvas aspect.
const polygonDefinition = (i: GaugeDefinitionInput): DomChartDefinition<GaugeNotchRow, number, number> => {
  const unitsW = i.linear ? LINEAR_UNITS : (i.fixedArc?.width ?? UNIT * ARC_ASPECT);
  const unitsH = i.linear ? i.trackHeight : (i.fixedArc?.height ?? UNIT);
  const rows = polygonRows(i, unitsW, unitsH);
  const common = { curve: notchPolygonCurve(i.notchCornerRadius, !i.linear), key: (r: GaugeNotchRow, m: { readonly index: number }) => `${r.index}:${m.index}`, x1: (r: GaugeNotchRow) => r.x1, x2: (r: GaugeNotchRow) => r.x1, y: (r: GaugeNotchRow) => r.y1, z: (r: GaugeNotchRow) => r.index } as const;
  return defineChart({
    color: vertexFillScale(rows), focusRing: false, keyboard: false, margin: 0, pointer: false,
    marks: [
      areaX(rows, { ...common, color: bgKey, fillOpacity: i.inactiveFillOpacity, id: "gauge:bg", motion: notchMotion(i.animate) }),
      areaX(rows.filter((r) => r.active), { ...common, color: activeKey, fillOpacity: i.activeFillOpacity, id: "gauge:active", motion: notchMotion(i.animate) }),
    ],
    scales: axes(unitsW, unitsH),
    tooltip: false,
  });
};

const rectDefinition = (i: GaugeDefinitionInput): DomChartDefinition<GaugeNotchRow, number, number> => {
  const rows = linearRows(i);
  const common = { x1: (r: GaugeNotchRow) => r.x1, x2: (r: GaugeNotchRow) => r.x2, y1: (r: GaugeNotchRow) => r.y1, y2: (r: GaugeNotchRow) => r.y2, inset: 0, key: (r: GaugeNotchRow) => r.index, radius: i.notchCornerRadius } as const;
  return defineChart({
    color: fillScale(rows), focusRing: false, keyboard: false, margin: 0, pointer: false,
    marks: [
      rect(rows, { ...common, color: bgKey, fillOpacity: i.inactiveFillOpacity, id: "gauge:bg", motion: notchMotion(i.animate) }),
      rect(rows.filter((r) => r.active), { ...common, color: activeKey, fillOpacity: i.activeFillOpacity, id: "gauge:active", motion: notchMotion(i.animate) }),
    ],
    scales: axes(LINEAR_UNITS, i.trackHeight),
    tooltip: false,
  });
};

export const buildGaugeDefinition = (input: GaugeDefinitionInput): DomChartDefinition<GaugeNotchRow, number, number> =>
  input.polygon ? polygonDefinition(input) : rectDefinition(input);
