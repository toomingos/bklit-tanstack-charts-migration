// Pure notch model for the native gauge: angles/rects and fills, mirroring bklit's notch geometry.
const CHART_1 = "var(--chart-1)";
const DEFAULT_ACTIVE_GRADIENT: readonly [string, string] = [CHART_1, "var(--chart-5)"];
export const DEFAULT_INACTIVE_FILL_OPACITY = 0.8;
export const DEFAULT_ACTIVE_FILL_OPACITY = 1;
export const DEFAULT_LINEAR_HEIGHT = 24;

const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export interface GaugeNotchRow {
  readonly index: number;
  readonly active: boolean;
  /** D3 radians (0 = 12 o'clock, clockwise); arc only. */
  readonly startAngle: number;
  readonly endAngle: number;
  /** Pixel rect; linear only. */
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
  readonly activeFill: string;
  readonly trackFill: string;
}

export interface FillOptions {
  readonly total: number;
  readonly useGradient: boolean;
  readonly activeGradient?: readonly [string, string];
  readonly inactiveGradient?: readonly [string, string];
  readonly activeFill?: string;
  readonly inactiveFill?: string;
  readonly linear: boolean;
  /** Paint (`url(#id)`) of bklit's theme-palette gradient, used by every active notch when `useGradient` has no `activeGradient`. */
  readonly themeGradientPaint?: string;
}

const parseHex = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(hex.trim());
  if (!m) { return null; }
  const h = m[1].length === 3 ? m[1].replaceAll(/./gu, (c) => c + c) : m[1];
  return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
};

/** Interpolates two colours: hex pairs are lerped in sRGB, anything else (CSS vars) via color-mix. */
const mixColor = (a: string, b: string, t: number): string => {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (pa && pb) {
    return `rgb(${pa.map((c, i) => Math.round(c + (pb[i] - c) * t)).join(",")})`;
  }
  return `color-mix(in oklab, ${a} ${Math.round((1 - t) * 100)}%, ${b})`;
};

const nonEmpty = (v: string | undefined): v is string => v !== undefined && v !== "";

const activeColor = (o: FillOptions, ag: readonly [string, string], t: number): string => {
  if (nonEmpty(o.activeFill)) { return o.activeFill; }
  if (o.useGradient && o.activeGradient === undefined && nonEmpty(o.themeGradientPaint)) { return o.themeGradientPaint; }
  return o.useGradient ? mixColor(ag[0], ag[1], t) : CHART_1;
};

const trackColor = (o: FillOptions, ig: readonly [string, string], t: number): string => {
  if (nonEmpty(o.inactiveFill)) { return o.inactiveFill; }
  if (o.useGradient) {
    if (o.activeGradient !== undefined) { return mixColor(ig[0], ig[1], t); }
    if (o.linear) { return CHART_1; }
  }
  return o.linear ? "var(--chart-background)" : "var(--border)";
};

const fills = (index: number, o: FillOptions): Pick<GaugeNotchRow, "activeFill" | "trackFill"> => {
  const t = index / (o.total > 1 ? o.total - 1 : 1);
  const ag = o.activeGradient ?? DEFAULT_ACTIVE_GRADIENT;
  const ig = o.inactiveGradient ?? ag;
  return { activeFill: activeColor(o, ag, t), trackFill: trackColor(o, ig, t) };
};

interface ArcInput extends FillOptions {
  readonly value: number;
  readonly spacing: number;
  readonly startAngle: number;
  readonly endAngle: number;
}

const arcNotches = (o: ArcInput): GaugeNotchRow[] => {
  const totalAngle = o.endAngle - o.startAngle;
  const notchAngle = o.total > 0 ? (totalAngle * (1 - o.spacing / 100)) / o.total : 0;
  const gap = (totalAngle * (o.spacing / 100)) / (o.total - 1 > 0 ? o.total - 1 : 1);
  const activeCount = Math.round((o.value / 100) * o.total);
  return Array.from({ length: o.total }, (_, i) => {
    const center = o.startAngle + i * (notchAngle + gap) + notchAngle / 2;
    const half = (notchAngle * 0.8) / 2;
    return {
      active: i < activeCount,
      endAngle: (center + half + 90) * DEG,
      index: i,
      startAngle: (center - half + 90) * DEG,
      x1: 0, x2: 0, y1: 0, y2: 0,
      ...fills(i, o),
    };
  });
};

export interface LinearInput extends FillOptions {
  readonly value: number;
  readonly spacing: number;
  readonly width: number;
  readonly height: number;
  readonly notchWidthPercent: number;
  readonly notchLengthPercent: number;
}

export const linearNotches = (o: LinearInput): GaugeNotchRow[] => {
  const slot = o.total > 0 ? (o.width * (1 - o.spacing / 100)) / o.total : 0;
  const gap = (o.width * (o.spacing / 100)) / (o.total - 1 > 0 ? o.total - 1 : 1);
  const half = (slot * (clamp(o.notchWidthPercent, 10, 100) / 100)) / 2;
  const halfHeight = (o.height / 2) * (clamp(o.notchLengthPercent, 5, 100) / 100);
  const activeCount = Math.round((o.value / 100) * o.total);
  return Array.from({ length: o.total }, (_, i) => {
    const cx = i * (slot + gap) + slot / 2;
    return {
      active: i < activeCount,
      endAngle: 0,
      index: i,
      startAngle: 0,
      x1: cx - half, x2: cx + half,
      y1: o.height / 2 - halfHeight, y2: o.height / 2 + halfHeight,
      ...fills(i, o),
    };
  });
};

export const clampStagger = (scale: number): number => clamp(scale, 0.25, 2.5);

/** A polygon notch is the rows sharing an `index`, one per vertex in drawing order, carried as a point (x1 = x2, y1 = y2) on the notch row. */
const vertices = (row: GaugeNotchRow, points: readonly (readonly [number, number])[]): GaugeNotchRow[] =>
  points.map(([x, y]) => ({ ...row, x1: x, x2: x, y1: y, y2: y }));

/** bklit's tapered linear notch: the bottom edge is `ratio` (28/42) of the top edge's width, both centred on the notch. */
export const taperedLinearVertices = (rows: readonly GaugeNotchRow[], ratio: number): GaugeNotchRow[] =>
  rows.flatMap((r) => {
    const cx = (r.x1 + r.x2) / 2;
    const inner = ((r.x2 - r.x1) / 2) * ratio;
    return vertices(r, [[r.x1, r.y1], [r.x2, r.y1], [cx + inner, r.y2], [cx - inner, r.y2]]);
  });

/** Uniform linear notch as a polygon (bklit builds every notch with `createNotchPath`, so the rounded corners are quadratic cuts, not circular arcs). */
export const rectLinearVertices = (rows: readonly GaugeNotchRow[]): GaugeNotchRow[] =>
  rows.flatMap((r) => vertices(r, [[r.x1, r.y1], [r.x2, r.y1], [r.x2, r.y2], [r.x1, r.y2]]));

export interface ArcPolygonInput extends FillOptions {
  readonly value: number;
  readonly spacing: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly notchLengthPercent: number;
  /** Parallel sides (`uniformWidth`); otherwise the inner edge is a chord at the inner radius, as in bklit's default arc. */
  readonly uniform: boolean;
  /** Canvas in uniform units; the gauge is centred and sized by the shorter side. */
  readonly width: number;
  readonly height: number;
}

/** bklit's arc notch as a straight-sided polygon: outer edge a chord; inner edge a chord at the inner radius, or sides parallel to the centre line when `uniform`. */
export const arcPolygonVertices = (o: ArcPolygonInput): GaugeNotchRow[] => {
  const size = Math.min(o.width, o.height);
  const outer = size * 0.42;
  const length = (outer - size * 0.28) * (clamp(o.notchLengthPercent, 5, 100) / 100);
  return arcNotches(o).flatMap((r) => {
    const mid = ((r.startAngle + r.endAngle) / 2) - Math.PI / 2;
    const half = (r.endAngle - r.startAngle) / 2;
    const at = (a: number, radius = outer): [number, number] => [o.width / 2 + Math.cos(a) * radius, o.height / 2 + Math.sin(a) * radius];
    const [x1, y1] = at(mid - half);
    const [x2, y2] = at(mid + half);
    const px = Math.cos(mid) * length;
    const py = Math.sin(mid) * length;
    if (o.uniform) { return vertices(r, [[x1, y1], [x2, y2], [x2 - px, y2 - py], [x1 - px, y1 - py]]); }
    const [x3, y3] = at(mid + half, outer - length);
    const [x4, y4] = at(mid - half, outer - length);
    return vertices(r, [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]);
  });
};
