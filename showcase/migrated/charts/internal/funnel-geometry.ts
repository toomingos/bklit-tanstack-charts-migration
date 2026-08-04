// Geometry helpers for FunnelChart (both orientations), ported VERBATIM from
// repos/bklit-ui/packages/ui/src/charts/funnel-chart.tsx's `hSegmentPath`/
// `vSegmentPath` module-scope functions, plus the per-ring scale/opacity and
// hover-extra-scale/spring-param formulas that were inline arithmetic inside
// bklit's `HSegment`/`VSegment`/`HRing`/`VRing` components. Pure functions,
// no React/DOM/animation dependencies — shared by funnel-chart.tsx and
// funnel-hover-chrome.ts.
//
// docs/LOG.md D30: percentage/height basis is `data[0].value` (norms =
// data.map(d => d.value / data[0].value)), NOT the max of the whole series —
// preserved by the caller (funnel-chart.tsx), not this module.

/**
 * bklit funnel-chart.tsx `hSegmentPath` verbatim (horizontal orientation:
 * segment spans local x in [0, segW], vertical midline at H/2, half-height
 * capped at 0.44*H per side).
 */
export function hSegmentPath(
  normStart: number,
  normEnd: number,
  segW: number,
  H: number,
  layerScale: number,
  straight = false,
): string {
  const my = H / 2;
  const h0 = normStart * H * 0.44 * layerScale;
  const h1 = normEnd * H * 0.44 * layerScale;

  if (straight) {
    return `M 0 ${my - h0} L ${segW} ${my - h1} L ${segW} ${my + h1} L 0 ${my + h0} Z`;
  }

  const cx = segW * 0.55;
  const top = `M 0 ${my - h0} C ${cx} ${my - h0}, ${segW - cx} ${my - h1}, ${segW} ${my - h1}`;
  const bot = `L ${segW} ${my + h1} C ${segW - cx} ${my + h1}, ${cx} ${my + h0}, 0 ${my + h0}`;
  return `${top} ${bot} Z`;
}

/**
 * bklit funnel-chart.tsx `vSegmentPath` verbatim (vertical orientation:
 * segment spans local y in [0, segH], horizontal midline at W/2).
 */
export function vSegmentPath(
  normStart: number,
  normEnd: number,
  segH: number,
  W: number,
  layerScale: number,
  straight = false,
): string {
  const mx = W / 2;
  const w0 = normStart * W * 0.44 * layerScale;
  const w1 = normEnd * W * 0.44 * layerScale;

  if (straight) {
    return `M ${mx - w0} 0 L ${mx - w1} ${segH} L ${mx + w1} ${segH} L ${mx + w0} 0 Z`;
  }

  const cy = segH * 0.55;
  const left = `M ${mx - w0} 0 C ${mx - w0} ${cy}, ${mx - w1} ${segH - cy}, ${mx - w1} ${segH}`;
  const right = `L ${mx + w1} ${segH} C ${mx + w1} ${segH - cy}, ${mx + w0} ${cy}, ${mx + w0} 0`;
  return `${left} ${right} Z`;
}

export interface FunnelRingGeometry {
  /** Ring layer index, 0 = outermost halo, `layers-1` = innermost. */
  ringIndex: number;
  d: string;
  opacity: number;
}

/**
 * bklit `HSegment`/`VSegment`'s inline `rings` builder, verbatim formula:
 * `scale = 1 - (l/layers)*0.35`, `opacity = 0.18 + (l/(layers-1||1))*0.65`.
 * `pathFor(scale)` is the caller's `hSegmentPath`/`vSegmentPath` partial
 * application (orientation-specific args already bound).
 */
export function computeFunnelRings(
  layers: number,
  pathFor: (layerScale: number) => string,
): FunnelRingGeometry[] {
  return Array.from({ length: layers }, (_, l) => {
    const scale = 1 - (l / layers) * 0.35;
    const opacity = 0.18 + (l / (layers - 1 || 1)) * 0.65;
    return { ringIndex: l, d: pathFor(scale), opacity };
  });
}

/** bklit `HRing`/`VRing`'s `extraScale` verbatim. */
export function funnelRingExtraScale(ringIndex: number, totalRings: number): number {
  return 1 + (ringIndex / Math.max(totalRings - 1, 1)) * 0.12;
}

/** bklit `HRing`/`VRing`'s per-ring spring params verbatim
    (`stiffness: 300 - ringIndex*60, damping: 24 - ringIndex*3`). */
export function funnelRingSpringParams(ringIndex: number): { stiffness: number; damping: number } {
  return { stiffness: 300 - ringIndex * 60, damping: 24 - ringIndex * 3 };
}

export interface FunnelGridConfig {
  enabled: boolean;
  showBands: boolean;
  bandColor: string;
  showGridLines: boolean;
  gridLineColor: string;
  gridLineOpacity: number;
  gridLineWidth: number;
}

export type FunnelGridProp =
  | boolean
  | {
      bands?: boolean;
      bandColor?: string;
      lines?: boolean;
      lineColor?: string;
      lineOpacity?: number;
      lineWidth?: number;
    }
  | undefined;

/** bklit FunnelChart's grid-config resolution block, verbatim defaults. */
export function resolveFunnelGrid(gridProp: FunnelGridProp): FunnelGridConfig {
  const enabled = gridProp !== false;
  const cfg = typeof gridProp === "object" ? gridProp : {};
  return {
    enabled,
    showBands: enabled && (cfg.bands ?? true),
    bandColor: cfg.bandColor ?? "var(--color-muted)",
    showGridLines: enabled && (cfg.lines ?? true),
    gridLineColor: cfg.lineColor ?? "var(--chart-grid)",
    gridLineOpacity: cfg.lineOpacity ?? 1,
    gridLineWidth: cfg.lineWidth ?? 1,
  };
}

export interface FunnelSegBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** bklit FunnelChart's per-segment `posStyle` computation verbatim
    (`(segW+gap)*i` horizontal / `(segH+gap)*i` vertical floor-tiling —
    matches qa/screenshot.mjs's D39 cell-center probe convention). */
export function funnelSegBox(
  i: number,
  horiz: boolean,
  segW: number,
  segH: number,
  gap: number,
  W: number,
  H: number,
): FunnelSegBox {
  return horiz
    ? { left: (segW + gap) * i, top: 0, width: segW, height: H }
    : { left: 0, top: (segH + gap) * i, width: W, height: segH };
}
