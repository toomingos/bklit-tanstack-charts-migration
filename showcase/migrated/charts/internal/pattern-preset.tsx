import type { ReactNode } from "react";

// ── visx pattern reimplementations (dependency-free) ──────────────────────
// visx pattern (v4.0.1-alpha.0) Pattern/Lines/Circles/Hexagons/Waves/Path
// components ported verbatim (esm/patterns/*.js), including their quirks:
// the base Pattern wraps in its own <defs>, so every call site's own
// `<defs>` wrapper nests as `<defs><defs><pattern>…` — do not flatten it.
// Hexagons ignores its `width` prop and overrides the tile to
// `width={size}`/`height={sqrt(size)}` while computing the hex path from
// the passed-in `height` — reproduced deliberately, it is public API.

function cx(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

interface PatternProps {
  id: string;
  width: number;
  height: number;
  children: ReactNode;
}

function Pattern({ id, width, height, children }: PatternProps) {
  return (
    <defs>
      <pattern
        id={id}
        width={width}
        height={height}
        patternUnits="userSpaceOnUse"
      >
        {children}
      </pattern>
    </defs>
  );
}

const PatternOrientation = {
  horizontal: "horizontal",
  vertical: "vertical",
  diagonal: "diagonal",
  diagonalRightToLeft: "diagonalRightToLeft",
} as const;

type PatternOrientationType =
  (typeof PatternOrientation)[keyof typeof PatternOrientation];

function pathForOrientation({
  height,
  orientation,
}: {
  height: number;
  orientation: PatternOrientationType;
}): string {
  switch (orientation) {
    case PatternOrientation.horizontal:
      return `M 0,${height / 2} l ${height},0`;
    case PatternOrientation.diagonal:
      return `M 0,${height} l ${height},${-height} M ${-height / 4},${height / 4} l ${height / 2},${-height / 2}
             M ${(3 / 4) * height},${(5 / 4) * height} l ${height / 2},${-height / 2}`;
    case PatternOrientation.diagonalRightToLeft:
      return `M 0,0 l ${height},${height}
        M ${-height / 4},${(3 / 4) * height} l ${height / 2},${height / 2}
        M ${(3 / 4) * height},${-height / 4} l ${height / 2},${height / 2}`;
    case PatternOrientation.vertical:
    default:
      return `M ${height / 2}, 0 l 0, ${height}`;
  }
}

interface PatternLinesProps {
  id: string;
  width: number;
  height: number;
  className?: string;
  background?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeDasharray?: string | number;
  strokeLinecap?: "square" | "butt" | "round" | "inherit";
  shapeRendering?: string | number;
  orientation?: PatternOrientationType[];
}

function LinesImpl({
  id,
  width,
  height,
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeLinecap = "square",
  shapeRendering = "auto",
  orientation = ["vertical"],
  background,
  className,
}: PatternLinesProps) {
  const orientations = Array.isArray(orientation) ? orientation : [orientation];
  return (
    <Pattern id={id} width={width} height={height}>
      {!!background && (
        <rect
          className={cx("visx-pattern-line-background")}
          width={width}
          height={height}
          fill={background}
        />
      )}
      {orientations.map((o, i) => (
        <path
          key={`visx-${id}-line-${o}-${i}`}
          className={cx("visx-pattern-line", className)}
          d={pathForOrientation({ orientation: o, height })}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap={strokeLinecap}
          shapeRendering={shapeRendering}
        />
      ))}
    </Pattern>
  );
}

interface PatternCirclesProps {
  id: string;
  width: number;
  height: number;
  radius?: number;
  fill?: string;
  className?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeDasharray?: number | string;
  complement?: boolean;
  background?: string;
}

function CirclesImpl({
  id,
  width,
  height,
  radius = 2,
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
  background,
  complement = false,
  className,
}: PatternCirclesProps) {
  let corners: Array<[number, number]> | undefined;
  if (complement) {
    corners = [
      [0, 0],
      [0, height],
      [width, 0],
      [width, height],
    ];
  }
  return (
    <Pattern id={id} width={width} height={height}>
      {!!background && <rect width={width} height={height} fill={background} />}
      <circle
        className={cx("visx-pattern-circle", className)}
        cx={width / 2}
        cy={height / 2}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
      />
      {corners?.map(([cornerX, cornerY]) => (
        <circle
          key={`${id}-complement-${cornerX}-${cornerY}`}
          className={cx(
            "visx-pattern-circle visx-pattern-circle-complement",
            className,
          )}
          cx={cornerX}
          cy={cornerY}
          r={radius}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
      ))}
    </Pattern>
  );
}

interface PatternPathProps {
  id: string;
  width: number;
  height: number;
  path?: string;
  fill?: string;
  className?: string;
  background?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeDasharray?: string | number;
  strokeLinecap?: "square" | "butt" | "round" | "inherit";
  shapeRendering?: string | number;
}

function PathImpl({
  id,
  width,
  height,
  path,
  fill = "transparent",
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeLinecap = "square",
  shapeRendering = "auto",
  background,
  className,
}: PatternPathProps) {
  return (
    <Pattern id={id} width={width} height={height}>
      {!!background && <rect width={width} height={height} fill={background} />}
      <path
        className={cx("visx-pattern-path", className)}
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeLinecap={strokeLinecap}
        shapeRendering={shapeRendering}
      />
    </Pattern>
  );
}

interface PatternHexagonsProps {
  id: string;
  height: number;
  size?: number;
  fill?: string;
  className?: string;
  background?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeDasharray?: string | number;
  strokeLinecap?: "square" | "butt" | "round" | "inherit";
  shapeRendering?: string | number;
}

function HexagonsImpl({
  id,
  height,
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeLinecap,
  shapeRendering,
  background,
  className,
  size = 3,
}: PatternHexagonsProps) {
  const sqrtSize = Math.sqrt(size);
  return (
    <PathImpl
      className={cx("visx-pattern-hexagon", className)}
      path={`M ${height},0 l ${height},0 l ${height / 2},${(height * sqrtSize) / 2} l ${-height / 2},${(height * sqrtSize) / 2} l ${-height},0 l ${-height / 2},${(-height * sqrtSize) / 2} Z M 0,${(height * sqrtSize) / 2} l ${height / 2},0 M ${3 * height},${(height * sqrtSize) / 2} l ${-height / 2},0`}
      id={id}
      width={size}
      height={sqrtSize}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      strokeLinecap={strokeLinecap}
      shapeRendering={shapeRendering}
      background={background}
    />
  );
}

interface PatternWavesProps {
  id: string;
  width: number;
  height: number;
  fill?: string;
  className?: string;
  background?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeDasharray?: string | number;
  strokeLinecap?: "square" | "butt" | "round" | "inherit";
  shapeRendering?: string | number;
}

function WavesImpl({
  id,
  width,
  height,
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeLinecap,
  shapeRendering,
  background,
  className,
}: PatternWavesProps) {
  return (
    <PathImpl
      className={cx("visx-pattern-wave", className)}
      path={`M 0 ${height / 2} c ${height / 8} ${-height / 4} , ${(height * 3) / 8} ${-height / 4} , ${height / 2} 0
             c ${height / 8} ${height / 4} , ${(height * 3) / 8} ${height / 4} , ${height / 2} 0 M ${-height / 2} ${height / 2}
             c ${height / 8} ${height / 4} , ${(height * 3) / 8} ${height / 4} , ${height / 2} 0 M ${height} ${height / 2}
             c ${height / 8} ${-height / 4} , ${(height * 3) / 8} ${-height / 4} , ${height / 2} 0`}
      id={id}
      width={width}
      height={height}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      strokeLinecap={strokeLinecap}
      shapeRendering={shapeRendering}
      background={background}
    />
  );
}

// ── visx pattern passthroughs (folded from ./visx-pattern-bridge) ────────

export function PatternLines(props: PatternLinesProps) {
  return <LinesImpl {...props} />;
}
PatternLines.displayName = "PatternLines";

export function PatternCircles(props: PatternCirclesProps) {
  return <CirclesImpl {...props} />;
}
PatternCircles.displayName = "PatternCircles";

export function PatternHexagons(props: PatternHexagonsProps) {
  return <HexagonsImpl {...props} />;
}
PatternHexagons.displayName = "PatternHexagons";

export function PatternWaves(props: PatternWavesProps) {
  return <WavesImpl {...props} />;
}
PatternWaves.displayName = "PatternWaves";

export const PATTERN_PRESET_IDS = [
  "none",
  "diagonal",
  "horizontal",
  "vertical",
  "cross",
  "dots",
  "circles",
  "accent",
] as const;

export type PatternPresetId = (typeof PATTERN_PRESET_IDS)[number];

export interface PatternPresetOptions {
  color?: string;
  scale?: number;
  strokeWidth?: number;
  radius?: number;
  complement?: boolean;
  fill?: string;
  dotFill?: boolean;
  tileBackground?: string;
}

export function isCirclePattern(preset: PatternPresetId): boolean {
  return preset === "circles" || preset === "dots";
}

export function isCirclesPattern(preset: PatternPresetId): boolean {
  return isCirclePattern(preset);
}

export function patternPresetTileSize(
  preset: PatternPresetId,
  scale = 1,
): { width: number; height: number; strokeWidth: number } {
  let base = { width: 6, height: 6, strokeWidth: 1 };
  if (preset === "dots") {
    base = { width: 10, height: 10, strokeWidth: 0 };
  } else if (preset === "cross") {
    base = { width: 8, height: 8, strokeWidth: 1 };
  } else if (preset === "circles") {
    base = { width: 6, height: 6, strokeWidth: 1 };
  }
  return {
    width: base.width * scale,
    height: base.height * scale,
    strokeWidth: base.strokeWidth * scale,
  };
}

function renderPatternCircles(
  preset: "dots" | "circles",
  _id: string,
  color: string,
  common: {
    id: string;
    height: number;
    width: number;
    strokeWidth: number;
    background?: string;
  },
  options: PatternPresetOptions,
  scale: number,
) {
  const isDotGrid = preset === "dots";
  const radius =
    options.radius ?? (isDotGrid ? Math.max(0.5, 1.5 * scale) : 2 * scale);
  const dotFillEnabled = options.dotFill !== false;

  if (isDotGrid) {
    const dotFill = dotFillEnabled ? options.fill || color : undefined;
    return (
      <PatternCircles
        {...common}
        complement={options.complement}
        fill={dotFill}
        radius={radius}
        stroke={dotFillEnabled && options.fill ? undefined : color}
        strokeWidth={
          dotFillEnabled && !options.fill
            ? (options.strokeWidth ?? 0)
            : (options.strokeWidth ?? 1)
        }
      />
    );
  }

  return (
    <PatternCircles
      {...common}
      complement={options.complement}
      fill={options.fill || undefined}
      radius={radius}
      stroke={color}
      strokeWidth={options.strokeWidth ?? common.strokeWidth}
    />
  );
}

export function renderPatternPreset(
  preset: PatternPresetId,
  id: string,
  options: PatternPresetOptions = {},
): ReactNode {
  if (preset === "none") {
    return null;
  }

  const color = options.color ?? "var(--chart-1)";
  const scale = options.scale ?? 1;
  const tile = patternPresetTileSize(preset, scale);
  const common = {
    id,
    height: tile.height,
    width: tile.width,
    strokeWidth: tile.strokeWidth,
    ...(options.tileBackground ? { background: options.tileBackground } : {}),
  };

  if (preset === "dots" || preset === "circles") {
    return renderPatternCircles(preset, id, color, common, options, scale);
  }

  const strokeWidth = options.strokeWidth ?? tile.strokeWidth;

  switch (preset) {
    case "diagonal":
      return (
        <PatternLines
          {...common}
          orientation={["diagonal"]}
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );
    case "horizontal":
      return (
        <PatternLines
          {...common}
          orientation={["horizontal"]}
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );
    case "vertical":
      return (
        <PatternLines
          {...common}
          orientation={["vertical"]}
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );
    case "cross":
      return (
        <PatternLines
          {...common}
          orientation={["diagonal", "diagonalRightToLeft"]}
          stroke={color}
          strokeWidth={strokeWidth}
        />
      );
    case "accent":
      return (
        <PatternLines
          {...common}
          orientation={["diagonal"]}
          stroke="#e879f9"
          strokeWidth={strokeWidth}
        />
      );
    default:
      return null;
  }
}
