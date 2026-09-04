// Verbatim port of funnel-chart segment/ring formulas; percentage basis is data[0].value,
// Preserved by the caller, not this module.

const FUNNEL_HALF_EXTENT_FRACTION = 0.44;
const FUNNEL_CURVE_CONTROL_FRACTION = 0.55;
const FUNNEL_RING_SCALE_SHRINK = 0.35;
const FUNNEL_RING_BASE_OPACITY = 0.18;
const FUNNEL_RING_OPACITY_RANGE = 0.65;
const FUNNEL_RING_EXTRA_SCALE = 0.12;
const FUNNEL_RING_BASE_DAMPING = 24;
const FUNNEL_RING_DAMPING_STEP = 3;
const FUNNEL_RING_BASE_STIFFNESS = 300;
const FUNNEL_RING_STIFFNESS_STEP = 60;

interface HSegmentPathParams {
  readonly normStart: number;
  readonly normEnd: number;
  readonly segW: number;
  readonly height: number;
  readonly layerScale: number;
  readonly straight?: boolean;
}

const hSegmentPath = (params: Readonly<HSegmentPathParams>): string => {
  const { normStart, normEnd, segW, height, layerScale, straight = false } = params;
  const my = height / 2;
  const h0 = normStart * height * FUNNEL_HALF_EXTENT_FRACTION * layerScale;
  const h1 = normEnd * height * FUNNEL_HALF_EXTENT_FRACTION * layerScale;

  if (straight) {
    return `M 0 ${my - h0} L ${segW} ${my - h1} L ${segW} ${my + h1} L 0 ${my + h0} Z`;
  }

  const cx = segW * FUNNEL_CURVE_CONTROL_FRACTION;
  const top = `M 0 ${my - h0} C ${cx} ${my - h0}, ${segW - cx} ${my - h1}, ${segW} ${my - h1}`;
  const bot = `L ${segW} ${my + h1} C ${segW - cx} ${my + h1}, ${cx} ${my + h0}, 0 ${my + h0}`;
  return `${top} ${bot} Z`;
}

interface VSegmentPathParams {
  readonly normStart: number;
  readonly normEnd: number;
  readonly segH: number;
  readonly width: number;
  readonly layerScale: number;
  readonly straight?: boolean;
}

const vSegmentPath = (params: Readonly<VSegmentPathParams>): string => {
  const { normStart, normEnd, segH, width, layerScale, straight = false } = params;
  const mx = width / 2;
  const w0 = normStart * width * FUNNEL_HALF_EXTENT_FRACTION * layerScale;
  const w1 = normEnd * width * FUNNEL_HALF_EXTENT_FRACTION * layerScale;

  if (straight) {
    return `M ${mx - w0} 0 L ${mx - w1} ${segH} L ${mx + w1} ${segH} L ${mx + w0} 0 Z`;
  }

  const cy = segH * FUNNEL_CURVE_CONTROL_FRACTION;
  const left = `M ${mx - w0} 0 C ${mx - w0} ${cy}, ${mx - w1} ${segH - cy}, ${mx - w1} ${segH}`;
  const right = `L ${mx + w1} ${segH} C ${mx + w1} ${segH - cy}, ${mx + w0} ${cy}, ${mx + w0} 0`;
  return `${left} ${right} Z`;
}

interface FunnelRingGeometry {
  /** Ring layer index, 0 = outermost halo, `layers-1` = innermost. */
  ringIndex: number;
  path: string;
  opacity: number;
}

const computeFunnelRings = (layers: number, pathFor: (layerScale: number) => string): FunnelRingGeometry[] => Array.from({ length: layers }, (_unused, layer) => {
    const scale = 1 - (layer / layers) * FUNNEL_RING_SCALE_SHRINK;
    const opacity = FUNNEL_RING_BASE_OPACITY + (layer / (layers - 1 || 1)) * FUNNEL_RING_OPACITY_RANGE;
    return { opacity, path: pathFor(scale), ringIndex: layer };
  });


const funnelRingExtraScale = (ringIndex: number, totalRings: number): number => 1 + (ringIndex / Math.max(totalRings - 1, 1)) * FUNNEL_RING_EXTRA_SCALE;


interface FunnelRingSpring {
  readonly damping: number;
  readonly stiffness: number;
}

const funnelRingSpringParams = (ringIndex: number): FunnelRingSpring => (
  { damping: FUNNEL_RING_BASE_DAMPING - ringIndex * FUNNEL_RING_DAMPING_STEP, stiffness: FUNNEL_RING_BASE_STIFFNESS - ringIndex * FUNNEL_RING_STIFFNESS_STEP }
);

interface FunnelGridConfig {
  enabled: boolean;
  showBands: boolean;
  bandColor: string;
  showGridLines: boolean;
  gridLineColor: string;
  gridLineOpacity: number;
  gridLineWidth: number;
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
  left: number;
  top: number;
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


export {
  computeFunnelRings,
  funnelRingExtraScale,
  funnelRingSpringParams,
  funnelSegBox,
  hSegmentPath,
  resolveFunnelGrid,
  vSegmentPath,
};
export type {
  FunnelGridConfig,
  FunnelGridOptions,
  FunnelGridProp,
  FunnelRingGeometry,
  FunnelRingSpring,
  FunnelSegBox,
  FunnelSegBoxParams,
  HSegmentPathParams,
  VSegmentPathParams,
};
