"use client";

import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { edgeFadeMaskStops } from "./fade-mask";
import { renderPatternPreset, type PatternPresetId, type PatternPresetOptions } from "./pattern-preset";
import {
  computeReferenceAreaRect,
  type ReferenceAreaIfOverflow,
  type ReferenceAreaRect,
} from "./reference-area-geometry";
import type { ChartMargin } from "./use-chart-margin";

const DEFAULT_FILL = "color-mix(in oklch, var(--chart-foreground-muted) 12%, transparent)";
const DEFAULT_FG_MUTED = "var(--chart-foreground-muted)";
const REFERENCE_AREA_ENTER_MS = 420;

export interface ReferenceAreaLayerProps {
  y1?: number;
  y2?: number;
  x1?: Date | number;
  x2?: Date | number;
  yAxisId?: string | number;
  fill?: string;
  fillOpacity?: number;
  pattern?: PatternPresetId;
  patternColor?: string;
  patternScale?: number;
  patternStrokeWidth?: number;
  patternRadius?: number;
  patternComplement?: boolean;
  patternFill?: string;
  patternDotFill?: boolean;
  patternTileBackground?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed";
  strokeDasharray?: string;
  fadeEdges?: boolean;
  fadeEdgesLength?: number;
  showMarkers?: boolean;
  markerColor?: string;
  markerSize?: number;
  ifOverflow?: ReferenceAreaIfOverflow;
  width: number;
  height: number;
  margin: ChartMargin;
  yDomain: [number, number];
  xDomain?: [number, number] | [Date, Date];
  xDataKey?: string;
  isTimeScale?: boolean;
  barScale?: { (v: string): number | undefined; bandwidth: () => number; domain: () => string[] } | null;
  isBarChart?: boolean;
  bandWidth?: number;
  xRangePadding?: number;
  isCandlestickXScale?: boolean;
  phase?: string;
  isLoaded?: boolean;
}

function bracketMarkerPath(centerX: number, edgeY: number, size: number, direction: "down" | "up"): string {
  const half = size / 2;
  if (direction === "down") return `M ${centerX - half} ${edgeY} L ${centerX + half} ${edgeY} L ${centerX} ${edgeY + size} Z`;
  return `M ${centerX - half} ${edgeY} L ${centerX + half} ${edgeY} L ${centerX} ${edgeY - size} Z`;
}

function isReferenceAreaVisiblePhase(phase: string | undefined): boolean {
  if (phase === undefined) return true;
  return phase === "ready" || phase === "revealing" || phase === "gridTweenReady";
}

export function ReferenceAreaLayer(props: ReferenceAreaLayerProps) {
  const {
    y1, y2, x1, x2,
    fill = DEFAULT_FILL,
    fillOpacity = 1,
    pattern = "none",
    patternColor = DEFAULT_FG_MUTED,
    patternScale = 1,
    patternStrokeWidth,
    patternRadius,
    patternComplement,
    patternFill,
    patternDotFill,
    patternTileBackground,
    stroke = DEFAULT_FG_MUTED,
    strokeWidth = 1,
    strokeStyle = "dashed",
    strokeDasharray = "4,4",
    fadeEdges = true,
    fadeEdgesLength = 10,
    showMarkers = false,
    markerColor = "var(--chart-1)",
    markerSize = 6,
    ifOverflow = "hidden",
    width, height, margin, yDomain, xDomain, xDataKey: _xDataKey, isTimeScale, barScale, isBarChart, xRangePadding, isCandlestickXScale,
    phase, isLoaded,
  } = props;

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const patternId = `bkm-ref-pattern-${uid}`;
  const hMaskId = `bkm-ref-fade-${uid}`;
  const hGradientId = `${hMaskId}-grad`;

  const yScale = React.useMemo(
    () => scaleLinear().domain(yDomain).range([innerHeight, 0]),
    [yDomain, innerHeight],
  );

  const xScale: (v: Date) => number = React.useMemo(() => {
    if (isBarChart && barScale) {
      const band = barScale as unknown as { (v: string): number | undefined; bandwidth: () => number };
      return (d: Date) => {
        const raw = String(d instanceof Date ? d.toISOString() : String(d));
        const n = band(raw);
        if (typeof n === "number") return n + band.bandwidth() / 2;
        return 0;
      };
    }
    if (xDomain) {
      const d0 = xDomain[0];
      const d1 = xDomain[1];
      const t0 = d0 instanceof Date ? d0.getTime() : (typeof d0 === "number" ? d0 : 0);
      const t1 = d1 instanceof Date ? d1.getTime() : (typeof d1 === "number" ? d1 : 0);
      if (isTimeScale || d0 instanceof Date) {
        if (typeof xRangePadding === "number" && xRangePadding > 0) {
          const insetLo = xRangePadding;
          const insetHi = innerWidth - xRangePadding;
          const insetScale = scaleUtc().domain([t0, t1]).range([insetLo, insetHi]);
          return (d: Date) => insetScale(d) ?? 0;
        }
        if (isCandlestickXScale) {
          const s = scaleUtc().domain([t0, t1]).range([0, innerWidth]);
          return (d: Date) => s(d) ?? 0;
        }
        const s = scaleUtc().domain([t0, t1]).range([0, innerWidth]);
        return (d: Date) => s(d) ?? 0;
      }
      const s = scaleLinear().domain([t0, t1]).range([0, innerWidth]);
      return (d: Date) => s(d.getTime()) ?? 0;
    }
    return () => 0;
  }, [xDomain, isTimeScale, isBarChart, barScale, isCandlestickXScale, innerWidth, xRangePadding]);

  const rect: ReferenceAreaRect | null = React.useMemo(() => {
    if (innerWidth <= 0 || innerHeight <= 0) return null;
    if (isBarChart && barScale) {
      const band = barScale as unknown as { (v: string): number | undefined; bandwidth: () => number };
      const resolveBarX = (v: Date | number | string | undefined, fallback: number): number => {
        if (v == null) return fallback;
        if (v instanceof Date) {
          const n = band(v.toISOString());
          return typeof n === "number" ? n + band.bandwidth() / 2 : fallback;
        }
        if (typeof v === "number") {
          const n = band(String(v));
          if (typeof n === "number") return n + band.bandwidth() / 2;
          return fallback;
        }
        const n = band(String(v));
        return typeof n === "number" ? n + band.bandwidth() / 2 : fallback;
      };
      const left = resolveBarX(x1 as string | undefined, 0);
      const right = resolveBarX(x2 as string | undefined, innerWidth);
      const top = yScale(y1 as number) ?? 0;
      const bottom = yScale(y2 as number) ?? innerHeight;
      const hasY1 = y1 != null;
      const hasY2 = y2 != null;
      const topPx = hasY1 ? top : 0;
      const bottomPx = hasY2 ? bottom : innerHeight;
      const x = Math.min(left, right);
      const y = Math.min(topPx, bottomPx);
      const w = Math.abs(right - left);
      const h = Math.abs(bottomPx - topPx);
      if (w <= 0 || h <= 0) return null;
      const r: ReferenceAreaRect = { x, y, width: w, height: h };
      if (ifOverflow === "visible") return r;
      if (ifOverflow === "discard") {
        const inside = r.x >= 0 && r.y >= 0 && r.x + r.width <= innerWidth && r.y + r.height <= innerHeight;
        return inside ? r : null;
      }
      const cx1 = Math.max(0, r.x);
      const cy1 = Math.max(0, r.y);
      const cx2 = Math.min(innerWidth, r.x + r.width);
      const cy2 = Math.min(innerHeight, r.y + r.height);
      const cw = cx2 - cx1;
      const ch = cy2 - cy1;
      if (cw <= 0 || ch <= 0) return null;
      return { x: cx1, y: cy1, width: cw, height: ch };
    }
    return computeReferenceAreaRect({ innerWidth, innerHeight, x1: x1 as Date | number | undefined, x2: x2 as Date | number | undefined, y1, y2, ifOverflow, xScale, yScale });
  }, [innerWidth, innerHeight, x1, x2, y1, y2, ifOverflow, xScale, yScale, isBarChart, barScale]);

  const usesPattern = pattern !== "none";
  const patternNode = React.useMemo(() => {
    if (!usesPattern) return null;
    return renderPatternPreset(pattern as PatternPresetId, patternId, {
      color: patternColor,
      scale: patternScale,
      strokeWidth: patternStrokeWidth,
      radius: patternRadius,
      complement: patternComplement,
      fill: patternFill,
      dotFill: patternDotFill,
      tileBackground: patternTileBackground,
    } as PatternPresetOptions);
  }, [usesPattern, pattern, patternId, patternColor, patternScale, patternStrokeWidth, patternRadius, patternComplement, patternFill, patternDotFill, patternTileBackground]);

  const edgeMask = fadeEdges ? `url(#${hMaskId})` : undefined;
  const lineDash = strokeStyle === "dashed" ? strokeDasharray : undefined;

  const visible = isReferenceAreaVisiblePhase(phase);
  const prefersReducedRef = React.useRef(false);
  React.useEffect(() => {
    prefersReducedRef.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const gRef = React.useRef<SVGGElement | null>(null);
  React.useLayoutEffect(() => {
    const g = gRef.current;
    if (!g) return;
    if (prefersReducedRef.current) {
      g.style.opacity = visible ? "1" : "0";
      return;
    }
    if (isLoaded === false) {
      g.style.opacity = "0";
      return;
    }
    if (visible) {
      g.style.transition = `opacity ${REFERENCE_AREA_ENTER_MS}ms ease-out`;
      requestAnimationFrame(() => { g.style.opacity = "1"; });
    } else {
      g.style.opacity = "0";
    }
  }, [visible, isLoaded]);

  if (!rect) return null;
  const { x, y, width: rw, height: rh } = rect;
  const topEdgeY = y;
  const bottomEdgeY = y + rh;
  const centerX = x + rw / 2;

  const stops = fadeEdges ? edgeFadeMaskStops(fadeEdgesLength) : [];

  return (
    <svg
      aria-hidden="true"
      width={innerWidth}
      height={innerHeight}
      style={{ position: "absolute", left: margin.left, top: margin.top, overflow: "visible", pointerEvents: "none", zIndex: -1 }}
    >
      <g ref={gRef} style={{ opacity: 0 }}>
        {edgeMask ? (
          <defs>
            <linearGradient id={hGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
              {stops.map((s) => (
                <stop key={s.offset} offset={s.offset} stopColor="white" stopOpacity={s.opacity} />
              ))}
            </linearGradient>
            <mask id={hMaskId}>
              <rect fill={`url(#${hGradientId})`} height={innerHeight} width={innerWidth} x={0} y={0} />
            </mask>
          </defs>
        ) : null}
        {patternNode ? <defs>{patternNode}</defs> : null}
        <rect fill={usesPattern && patternNode ? `url(#${patternId})` : fill} fillOpacity={fillOpacity} height={rh} mask={edgeMask} width={rw} x={x} y={y} />
        <g mask={edgeMask}>
          <line stroke={stroke} strokeDasharray={lineDash} strokeWidth={strokeWidth} x1={x} x2={x + rw} y1={topEdgeY} y2={topEdgeY} />
          <line stroke={stroke} strokeDasharray={lineDash} strokeWidth={strokeWidth} x1={x} x2={x + rw} y1={bottomEdgeY} y2={bottomEdgeY} />
        </g>
        {showMarkers ? (
          <>
            <path d={bracketMarkerPath(centerX, topEdgeY, markerSize, "down")} fill={markerColor} />
            <path d={bracketMarkerPath(centerX, bottomEdgeY, markerSize, "up")} fill={markerColor} />
          </>
        ) : null}
      </g>
    </svg>
  );
}

export interface ReferenceAreaLayersGeom {
  width: number;
  height: number;
  margin: ChartMargin;
  yDomain: [number, number];
  xDomain?: [number, number] | [Date, Date];
  xDataKey?: string;
  isTimeScale?: boolean;
  barScale?: { (v: string): number | undefined; bandwidth: () => number; domain: () => string[] } | null;
  isBarChart?: boolean;
  xRangePadding?: number;
  isCandlestickXScale?: boolean;
  phase?: string;
  isLoaded?: boolean;
}

export function ReferenceAreaLayers({
  configs,
  geom,
}: {
  configs: Array<Record<string, unknown>>;
  geom: ReferenceAreaLayersGeom;
}) {
  if (configs.length === 0) return null;
  return (
    <>
      {configs.map((p, i) => (
        <ReferenceAreaLayer
          key={`ref-${i}`}
          y1={p.y1 as number | undefined}
          y2={p.y2 as number | undefined}
          x1={p.x1 as Date | number | undefined}
          x2={p.x2 as Date | number | undefined}
          yAxisId={p.yAxisId as string | number | undefined}
          fill={p.fill as string | undefined}
          fillOpacity={p.fillOpacity as number | undefined}
          pattern={p.pattern as PatternPresetId | undefined}
          patternColor={p.patternColor as string | undefined}
          patternScale={p.patternScale as number | undefined}
          patternStrokeWidth={p.patternStrokeWidth as number | undefined}
          patternRadius={p.patternRadius as number | undefined}
          patternComplement={p.patternComplement as boolean | undefined}
          patternFill={p.patternFill as string | undefined}
          patternDotFill={p.patternDotFill as boolean | undefined}
          patternTileBackground={p.patternTileBackground as string | undefined}
          stroke={p.stroke as string | undefined}
          strokeWidth={p.strokeWidth as number | undefined}
          strokeStyle={p.strokeStyle as "solid" | "dashed" | undefined}
          strokeDasharray={p.strokeDasharray as string | undefined}
          fadeEdges={p.fadeEdges as boolean | undefined}
          fadeEdgesLength={p.fadeEdgesLength as number | undefined}
          showMarkers={p.showMarkers as boolean | undefined}
          markerColor={p.markerColor as string | undefined}
          markerSize={p.markerSize as number | undefined}
          ifOverflow={p.ifOverflow as ReferenceAreaIfOverflow | undefined}
          width={geom.width}
          height={geom.height}
          margin={geom.margin}
          yDomain={geom.yDomain}
          xDomain={geom.xDomain}
          xDataKey={geom.xDataKey}
          isTimeScale={geom.isTimeScale}
          barScale={geom.barScale}
          isBarChart={geom.isBarChart}
          xRangePadding={geom.xRangePadding}
          isCandlestickXScale={geom.isCandlestickXScale}
          phase={geom.phase}
          isLoaded={geom.isLoaded}
        />
      ))}
    </>
  );
}
