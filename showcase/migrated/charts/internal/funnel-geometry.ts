// Verbatim port of funnel-chart segment/ring formulas; percentage basis is data[0].value,
// Preserved by the caller, not this module.

const FUNNEL_HALF_EXTENT_FRACTION = 0.44;
const FUNNEL_CURVE_CONTROL_FRACTION = 0.55;
const FUNNEL_RING_EXTRA_SCALE = 0.12;

interface HSegmentPathParams {
  readonly normStart: number;
  readonly normEnd: number;
  readonly segW: number;
  readonly height: number;
  readonly layerScale: number;
  readonly straight?: boolean;
  readonly dx?: number;
  readonly dy?: number;
}

const hSegmentPath = (params: Readonly<HSegmentPathParams>): string => {
  const { normStart, normEnd, segW, height, layerScale, straight = false, dx = 0, dy = 0 } = params;
  const my = height / 2 + dy;
  const h0 = normStart * height * FUNNEL_HALF_EXTENT_FRACTION * layerScale;
  const h1 = normEnd * height * FUNNEL_HALF_EXTENT_FRACTION * layerScale;

  if (straight) {
    return `M ${dx} ${my - h0} L ${dx + segW} ${my - h1} L ${dx + segW} ${my + h1} L ${dx} ${my + h0} Z`;
  }

  const cx = segW * FUNNEL_CURVE_CONTROL_FRACTION;
  const top = `M ${dx} ${my - h0} C ${dx + cx} ${my - h0}, ${dx + segW - cx} ${my - h1}, ${dx + segW} ${my - h1}`;
  const bot = `L ${dx + segW} ${my + h1} C ${dx + segW - cx} ${my + h1}, ${dx + cx} ${my + h0}, ${dx} ${my + h0}`;
  return `${top} ${bot} Z`;
}

interface VSegmentPathParams {
  readonly normStart: number;
  readonly normEnd: number;
  readonly segH: number;
  readonly width: number;
  readonly layerScale: number;
  readonly straight?: boolean;
  readonly dx?: number;
  readonly dy?: number;
}

const vSegmentPath = (params: Readonly<VSegmentPathParams>): string => {
  const { normStart, normEnd, segH, width, layerScale, straight = false, dx = 0, dy = 0 } = params;
  const mx = width / 2 + dx;
  const w0 = normStart * width * FUNNEL_HALF_EXTENT_FRACTION * layerScale;
  const w1 = normEnd * width * FUNNEL_HALF_EXTENT_FRACTION * layerScale;

  if (straight) {
    return `M ${mx - w0} ${dy} L ${mx - w1} ${dy + segH} L ${mx + w1} ${dy + segH} L ${mx + w0} ${dy} Z`;
  }

  const cy = segH * FUNNEL_CURVE_CONTROL_FRACTION;
  const left = `M ${mx - w0} ${dy} C ${mx - w0} ${dy + cy}, ${mx - w1} ${dy + segH - cy}, ${mx - w1} ${dy + segH}`;
  const right = `L ${mx + w1} ${dy + segH} C ${mx + w1} ${dy + segH - cy}, ${mx + w0} ${dy + cy}, ${mx + w0} ${dy}`;
  return `${left} ${right} Z`;
}

type FunnelCorner = readonly [number, number];

interface FunnelTrapCornersParams {
  readonly normStart: number;
  readonly normEnd: number;
  readonly segLen: number;
  readonly crossLen: number;
  readonly layerScale: number;
  readonly isHorizontal: boolean;
  readonly dx: number;
  readonly dy: number;
}

// Trapezoid vertices for one ring: the SceneArea points the path morphs between.
const funnelTrapCorners = (params: Readonly<FunnelTrapCornersParams>): readonly [FunnelCorner, FunnelCorner, FunnelCorner, FunnelCorner] => {
  const { normStart, normEnd, segLen, crossLen, layerScale, isHorizontal, dx, dy } = params;
  if (isHorizontal) {
    const my = crossLen / 2 + dy;
    const h0 = normStart * crossLen * FUNNEL_HALF_EXTENT_FRACTION * layerScale;
    const h1 = normEnd * crossLen * FUNNEL_HALF_EXTENT_FRACTION * layerScale;
    const topLeft: FunnelCorner = [dx, my - h0];
    const topRight: FunnelCorner = [dx + segLen, my - h1];
    const bottomRight: FunnelCorner = [dx + segLen, my + h1];
    const bottomLeft: FunnelCorner = [dx, my + h0];
    return [topLeft, topRight, bottomRight, bottomLeft];
  }
  const mx = crossLen / 2 + dx;
  const w0 = normStart * crossLen * FUNNEL_HALF_EXTENT_FRACTION * layerScale;
  const w1 = normEnd * crossLen * FUNNEL_HALF_EXTENT_FRACTION * layerScale;
  const topLeft: FunnelCorner = [mx - w0, dy];
  const bottomLeft: FunnelCorner = [mx - w1, dy + segLen];
  const bottomRight: FunnelCorner = [mx + w1, dy + segLen];
  const topRight: FunnelCorner = [mx + w0, dy];
  return [topLeft, bottomLeft, bottomRight, topRight];
};

interface FunnelGridConfig {
  readonly enabled: boolean;
  readonly showBands: boolean;
  readonly bandColor: string;
  readonly showGridLines: boolean;
  readonly gridLineColor: string;
  readonly gridLineOpacity: number;
  readonly gridLineWidth: number;
}

interface FunnelGridOptions {
  readonly bands?: boolean;
  readonly bandColor?: string;
  readonly lines?: boolean;
  readonly lineColor?: string;
  readonly lineOpacity?: number;
  readonly lineWidth?: number;
}

type FunnelGridProp =
  | boolean
  | FunnelGridOptions
  | undefined;

const isFunnelGridOptions = (value: FunnelGridProp): value is FunnelGridOptions => typeof value === "object";

const resolveFunnelGrid = (gridProp: FunnelGridProp): FunnelGridConfig => {
  const enabled = gridProp !== false;
  const cfg: FunnelGridOptions = isFunnelGridOptions(gridProp) ? gridProp : {};
  return {
    bandColor: cfg.bandColor ?? "var(--color-muted)",
    enabled,
    gridLineColor: cfg.lineColor ?? "var(--chart-grid)",
    gridLineOpacity: cfg.lineOpacity ?? 1,
    gridLineWidth: cfg.lineWidth ?? 1,
    showBands: enabled && (cfg.bands ?? true),
    showGridLines: enabled && (cfg.lines ?? true),
  };
}

interface FunnelSegBox {
  readonly left: number;
  readonly top: number;
  width: number;
  height: number;
}

interface FunnelSegBoxParams {
  readonly segIndex: number;
  readonly horiz: boolean;
  readonly segW: number;
  readonly segH: number;
  readonly gap: number;
  readonly boxWidth: number;
  readonly boxHeight: number;
}

// Floor-tiled offsets; QA position probes target cell centers.
const funnelSegBox = (params: Readonly<FunnelSegBoxParams>): FunnelSegBox => {
  const { segIndex, horiz, segW, segH, gap, boxWidth, boxHeight } = params;
  if (horiz) {
    return { height: boxHeight, left: (segW + gap) * segIndex, top: 0, width: segW };
  }
  return { height: segH, left: 0, top: (segH + gap) * segIndex, width: boxWidth };
}

const funnelRingExtraScale = (ringIndex: number, totalRings: number): number => 1 + (ringIndex / Math.max(totalRings - 1, 1)) * FUNNEL_RING_EXTRA_SCALE;


export {
  funnelRingExtraScale,
  funnelSegBox,
  funnelTrapCorners,
  hSegmentPath,
  resolveFunnelGrid,
  vSegmentPath,
};
export type {
  FunnelCorner,
  FunnelGridConfig,
  FunnelGridOptions,
  FunnelGridProp,
  FunnelSegBox,
  FunnelSegBoxParams,
  FunnelTrapCornersParams,
  HSegmentPathParams,
  VSegmentPathParams,
};
