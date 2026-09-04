import type { ReactNode, RefObject } from "react";
import { edgeFadeMaskStops } from "./fade-mask";
import { renderPatternPreset } from "./pattern-preset-render";
import type { PatternPresetId } from "./pattern-preset";
import type { ReferenceAreaRect } from "./reference-area-geometry";
import type { ReferenceAreaSpatial } from "./reference-area-scale";

const DEFAULT_FILL = "color-mix(in oklch, var(--chart-foreground-muted) 12%, transparent)";
const DEFAULT_FG_MUTED = "var(--chart-foreground-muted)";
const DEFAULT_FADE_EDGES_LENGTH = 10;
const DEFAULT_MARKER_SIZE = 6;

// Static group style for the reference-area figure; hoisted so it keeps identity.
const REFERENCE_AREA_GROUP_STYLE = { opacity: 0 } as const;

interface BracketMarkerOptions {
  readonly centerX: number;
  readonly edgeY: number;
  readonly size: number;
  readonly direction: "down" | "up";
}

const bracketMarkerPath = (options: Readonly<BracketMarkerOptions>): string => {
  const { centerX, edgeY, size, direction } = options;
  const half = size / 2;
  if (direction === "down") {return `M ${centerX - half} ${edgeY} L ${centerX + half} ${edgeY} L ${centerX} ${edgeY + size} Z`;}
  return `M ${centerX - half} ${edgeY} L ${centerX + half} ${edgeY} L ${centerX} ${edgeY - size} Z`;
}

interface ReferenceAreaStyleInput {
  readonly fill?: string;
  readonly fillOpacity?: number;
  readonly pattern?: PatternPresetId;
  readonly patternColor?: string;
  readonly patternScale?: number;
  readonly patternStrokeWidth?: number;
  readonly patternRadius?: number;
  readonly patternComplement?: boolean;
  readonly patternFill?: string;
  readonly patternDotFill?: boolean;
  readonly patternTileBackground?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly strokeStyle?: "solid" | "dashed";
  readonly strokeDasharray?: string;
  readonly fadeEdges?: boolean;
  readonly fadeEdgesLength?: number;
  readonly showMarkers?: boolean;
  readonly markerColor?: string;
  readonly markerSize?: number;
  readonly className?: string;
}

interface ResolvedReferenceAreaStyle {
  readonly fill: string;
  readonly fillOpacity: number;
  readonly pattern: PatternPresetId;
  readonly patternColor: string;
  readonly patternScale: number;
  readonly patternStrokeWidth: number | undefined;
  readonly patternRadius: number | undefined;
  readonly patternComplement: boolean | undefined;
  readonly patternFill: string | undefined;
  readonly patternDotFill: boolean | undefined;
  readonly patternTileBackground: string | undefined;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly strokeStyle: "solid" | "dashed";
  readonly strokeDasharray: string;
  readonly fadeEdges: boolean;
  readonly fadeEdgesLength: number;
  readonly showMarkers: boolean;
  readonly markerColor: string;
  readonly markerSize: number;
  readonly className: string | undefined;
}

const resolveReferenceAreaStyle = (input: Readonly<ReferenceAreaStyleInput>): ResolvedReferenceAreaStyle => ({
  className: input.className,
  fadeEdges: input.fadeEdges ?? true,
  fadeEdgesLength: input.fadeEdgesLength ?? DEFAULT_FADE_EDGES_LENGTH,
  fill: input.fill ?? DEFAULT_FILL,
  fillOpacity: input.fillOpacity ?? 1,
  markerColor: input.markerColor ?? "var(--chart-1)",
  markerSize: input.markerSize ?? DEFAULT_MARKER_SIZE,
  pattern: input.pattern ?? "none",
  patternColor: input.patternColor ?? DEFAULT_FG_MUTED,
  patternComplement: input.patternComplement,
  patternDotFill: input.patternDotFill,
  patternFill: input.patternFill,
  patternRadius: input.patternRadius,
  patternScale: input.patternScale ?? 1,
  patternStrokeWidth: input.patternStrokeWidth,
  patternTileBackground: input.patternTileBackground,
  showMarkers: input.showMarkers ?? false,
  stroke: input.stroke ?? DEFAULT_FG_MUTED,
  strokeDasharray: input.strokeDasharray ?? "4,4",
  strokeStyle: input.strokeStyle ?? "dashed",
  strokeWidth: input.strokeWidth ?? 1,
});

const resolveReferenceAreaPattern = (style: Readonly<ResolvedReferenceAreaStyle>, patternId: string): ReactNode => {
  if (style.pattern === "none") {return undefined;}
  return renderPatternPreset(style.pattern, patternId, {
    color: style.patternColor,
    complement: style.patternComplement,
    dotFill: style.patternDotFill,
    fill: style.patternFill,
    radius: style.patternRadius,
    scale: style.patternScale,
    strokeWidth: style.patternStrokeWidth,
    tileBackground: style.patternTileBackground,
  });
}

interface ReferenceAreaChrome {
  readonly edgeMask: string | undefined;
  readonly hasPatternFill: boolean;
  readonly lineDash: string | undefined;
}

const resolveReferenceAreaChrome = (style: Readonly<ResolvedReferenceAreaStyle>, patternNode: ReactNode, hMaskId: string): ReferenceAreaChrome => {
  const edgeMask = style.fadeEdges ? `url(#${hMaskId})` : undefined;
  const lineDash = style.strokeStyle === "dashed" ? style.strokeDasharray : undefined;
  const hasPatternFill = style.pattern !== "none" && patternNode !== undefined && patternNode !== null;
  return { edgeMask, hasPatternFill, lineDash };
}

interface FadeMaskGeom {
  readonly hGradientId: string;
  readonly hMaskId: string;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

const buildFadeMaskDefs = (edgeMask: string | undefined, style: Readonly<ResolvedReferenceAreaStyle>, geom: Readonly<FadeMaskGeom>): ReactNode => {
  if (edgeMask === undefined) {return undefined;}
  const stops = style.fadeEdges ? edgeFadeMaskStops(style.fadeEdgesLength) : [];
  const gradientStops = stops.map((stop: Readonly<{ offset: string; opacity: number }>) => (
    <stop key={stop.offset} offset={stop.offset} stopColor="white" stopOpacity={stop.opacity} />
  ));
  return (
    <defs>
      <linearGradient id={geom.hGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
        {gradientStops}
      </linearGradient>
      <mask id={geom.hMaskId}>
        <rect fill={`url(#${geom.hGradientId})`} height={geom.innerHeight} width={geom.innerWidth} x={0} y={0} />
      </mask>
    </defs>
  );
}

interface ReferenceAreaFigureOptions {
  readonly style: Readonly<ResolvedReferenceAreaStyle>;
  readonly spatial: Readonly<ReferenceAreaSpatial>;
  readonly patternNode: ReactNode;
  readonly figureRef: RefObject<SVGGElement | null>;
}

const buildReferenceAreaMarkers = (rect: Readonly<ReferenceAreaRect>, style: Readonly<ResolvedReferenceAreaStyle>): ReactNode => {
  if (!style.showMarkers) {return undefined;}
  const centerX = rect.x + rect.width / 2;
  const bottomEdgeY = rect.y + rect.height;
  return (
    <>
      <path d={bracketMarkerPath({ centerX, direction: "down", edgeY: rect.y, size: style.markerSize })} fill={style.markerColor} />
      <path d={bracketMarkerPath({ centerX, direction: "up", edgeY: bottomEdgeY, size: style.markerSize })} fill={style.markerColor} />
    </>
  );
}

const buildReferenceAreaFigure = (options: Readonly<ReferenceAreaFigureOptions>): ReactNode => {
  const { style, spatial, patternNode, figureRef } = options;
  const rect: ReferenceAreaRect | undefined = spatial.rect;
  if (rect === undefined) {return undefined;}
  const chrome = resolveReferenceAreaChrome(style, patternNode, spatial.hMaskId);
  const { x, y, width: rw, height: rh } = rect;
  const bottomEdgeY = y + rh;
  const edgeLines = (
    <g mask={chrome.edgeMask}>
      <line stroke={style.stroke} strokeDasharray={chrome.lineDash} strokeWidth={style.strokeWidth} x1={x} x2={x + rw} y1={y} y2={y} />
      <line stroke={style.stroke} strokeDasharray={chrome.lineDash} strokeWidth={style.strokeWidth} x1={x} x2={x + rw} y1={bottomEdgeY} y2={bottomEdgeY} />
    </g>
  );
  const markerPaths = buildReferenceAreaMarkers(rect, style);
  return (
    <svg
      aria-hidden="true"
      width={spatial.innerWidth}
      height={spatial.innerHeight}
      style={{ left: spatial.margin.left, overflow: "visible", pointerEvents: "none", position: "absolute", top: spatial.margin.top, zIndex: -1 }}
    >
      <g ref={figureRef} className={style.className ?? "chart-reference-area"} style={REFERENCE_AREA_GROUP_STYLE}>
        {buildFadeMaskDefs(chrome.edgeMask, style, spatial)}
        {chrome.hasPatternFill && <defs>{patternNode}</defs>}
        <rect fill={chrome.hasPatternFill ? `url(#${spatial.patternId})` : style.fill} fillOpacity={style.fillOpacity} height={rh} mask={chrome.edgeMask} width={rw} x={x} y={y} />
        {edgeLines}
        {markerPaths}
      </g>
    </svg>
  );
}

export { bracketMarkerPath, buildFadeMaskDefs, buildReferenceAreaFigure, buildReferenceAreaMarkers, resolveReferenceAreaChrome, resolveReferenceAreaPattern, resolveReferenceAreaStyle };
export type { BracketMarkerOptions, FadeMaskGeom, ReferenceAreaFigureOptions, ReferenceAreaChrome, ResolvedReferenceAreaStyle, ReferenceAreaStyleInput };
