import type { CSSProperties, ReactNode } from "react";

/*
 * Split out so brush-chrome.tsx stays under size limits; renderTrackSide is a plain
 * function so the portal element tree is unchanged.
 */

interface BrushChromePattern {
  readonly preset: "none" | "diagonal" | "horizontal" | "vertical" | "cross" | "dots" | "accent";
  readonly color?: string;
  readonly opacity?: number;
  readonly scale?: number;
  readonly strokeWidth?: number;
  readonly radius?: number;
  readonly complement?: boolean;
  readonly fill?: string;
  readonly tileBackground?: string;
  readonly dotFill?: boolean;
}

const BRUSH_TRACK_OUTER_FADE = 0.15;
// Fraction-to-percentage scale for gradient fade stops.
const FRACTION_TO_PERCENT = 100;

interface PixelExtent {
  x0: number;
  x1: number;
}

// Clamps a raw pixel extent into [0, innerWidth] and orders it; hoisted so selectionToPixelExtent stays short.
const normalizePixelExtent = (x0Raw: number, x1Raw: number, innerWidth: number): PixelExtent => {
  const x0 = Math.max(0, Math.min(innerWidth, x0Raw));
  const x1 = Math.max(0, Math.min(innerWidth, x1Raw));
  return { x0: Math.min(x0, x1), x1: Math.max(x0, x1) };
};

interface RawPixelExtent {
  x0Raw: number;
  x1Raw: number;
}

interface RawPixelExtentArgs {
  readonly selection: { readonly start: Readonly<Date>; readonly end: Readonly<Date> };
  readonly trackExtent: readonly [Readonly<Date>, Readonly<Date>];
  readonly innerWidth: number;
}

// Unclamped selection projection; undefined when the extent is degenerate. Hoisted so selectionToPixelExtent stays short.
const toRawPixelExtent = (extentArgs: Readonly<RawPixelExtentArgs>): RawPixelExtent | undefined => {
  if (extentArgs.innerWidth <= 0) {return undefined;}
  const span = extentArgs.trackExtent[1].getTime() - extentArgs.trackExtent[0].getTime();
  if (span === 0) {return undefined;}
  const sMs = extentArgs.selection.start.getTime();
  const eMs = extentArgs.selection.end.getTime();
  return {
    x0Raw: ((sMs - extentArgs.trackExtent[0].getTime()) / span) * extentArgs.innerWidth,
    x1Raw: ((eMs - extentArgs.trackExtent[0].getTime()) / span) * extentArgs.innerWidth,
  };
};

// X0/x1 are plot-local pixels (0..innerWidth) over the stable trackExtent, independent of the chart's x scale.
const selectionToPixelExtent = (selection: { readonly start: Readonly<Date>; readonly end: Readonly<Date> }, trackExtent: readonly [Readonly<Date>, Readonly<Date>], innerWidth: number): { x0: number; x1: number } | undefined => {
  const raw = toRawPixelExtent({ innerWidth, selection, trackExtent });
  if (raw === undefined) {return undefined;}
  return normalizePixelExtent(raw.x0Raw, raw.x1Raw, innerWidth);
};

interface TrackWidths {
  leftWidth: number;
  rightWidth: number;
}

// Dimmed widths flanking the selection; hoisted so BrushTrackChrome stays short.
const resolveTrackWidths = (x0: number, x1: number, innerWidth: number): TrackWidths => ({
  leftWidth: Math.max(0, Math.min(x0, x1)),
  rightWidth: Math.max(0, innerWidth - Math.max(x0, x1)),
});

interface TrackEdgeMasks {
  leftMask: string | undefined;
  rightMask: string | undefined;
}

// Fade masks at the outer track ends only; hoisted so BrushTrackChrome stays short.
const buildTrackEdgeMasks = (fadeOuterEdges: boolean): TrackEdgeMasks => {
  if (!fadeOuterEdges) {return { leftMask: undefined, rightMask: undefined };}
  const fadeStop = `${BRUSH_TRACK_OUTER_FADE * FRACTION_TO_PERCENT}%`;
  return {
    leftMask: `linear-gradient(to right, transparent 0%, black ${fadeStop}, black 100%)`,
    rightMask: `linear-gradient(to left, transparent 0%, black ${fadeStop}, black 100%)`,
  };
};

interface TrackSideStyle {
  readonly clampedBlur: number;
  readonly mask: string | undefined;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

// One dimmed flank panel style; hoisted so BrushTrackChrome stays short.
const buildTrackSideStyle = (side: Readonly<TrackSideStyle>): CSSProperties => ({
  WebkitBackdropFilter: side.clampedBlur > 0 ? `blur(${side.clampedBlur}px)` : undefined,
  WebkitMaskImage: side.mask,
  backdropFilter: side.clampedBlur > 0 ? `blur(${side.clampedBlur}px)` : undefined,
  height: side.height,
  left: side.left,
  maskImage: side.mask,
  pointerEvents: "none",
  top: side.top,
  width: side.width,
});

// One dimmed flank panel; plain function (not a component) so the element tree is unchanged.
const renderTrackSide = (side: Readonly<TrackSideStyle>): ReactNode => {
  if (side.width <= 0) {return undefined;}
  return (
    <div
      className="absolute"
      style={buildTrackSideStyle(side)}
    />
  );
};

interface SelectionBounds {
  left: number;
  width: number;
}

// Ordered selection bounds; undefined when the selection is empty. Shared by the pattern and border chrome.
const resolveSelectionBounds = (x0: number, x1: number): SelectionBounds | undefined => {
  const left = Math.min(x0, x1);
  const width = Math.max(0, Math.max(x0, x1) - left);
  if (width <= 0) {return undefined;}
  return { left, width };
};

interface SelectionPatternOptions {
  color: string | undefined;
  complement: boolean | undefined;
  dotFill: boolean | undefined;
  fill: string | undefined;
  radius: number | undefined;
  scale: number | undefined;
  strokeWidth: number | undefined;
  tileBackground: string | undefined;
}

// Pattern tile options for the selection overlay; hoisted so the pattern chrome stays short.
const buildSelectionPatternOptions = (selectionPattern: Readonly<BrushChromePattern>): SelectionPatternOptions => ({
  color: selectionPattern.color,
  complement: selectionPattern.complement,
  dotFill: selectionPattern.dotFill,
  fill: selectionPattern.fill,
  radius: selectionPattern.radius,
  scale: selectionPattern.scale,
  strokeWidth: selectionPattern.strokeWidth,
  tileBackground: selectionPattern.tileBackground,
});

interface ActivePatternBounds {
  pattern: BrushChromePattern;
  bounds: SelectionBounds;
  container: HTMLElement;
}

interface ActivePatternBoundsArgs {
  readonly mounted: boolean;
  readonly container: HTMLElement | null;
  readonly selectionPattern: BrushChromePattern | undefined;
  readonly x0: number;
  readonly x1: number;
}

// Active pattern plus its bounds; undefined when the overlay must not paint. Hoisted so the pattern chrome stays short.
const resolveActivePatternBounds = (patternArgs: Readonly<ActivePatternBoundsArgs>): ActivePatternBounds | undefined => {
  const { container } = patternArgs;
  if (!(patternArgs.mounted && container && patternArgs.selectionPattern?.preset && patternArgs.selectionPattern.preset !== "none")) {return undefined;}
  const bounds = resolveSelectionBounds(patternArgs.x0, patternArgs.x1);
  if (bounds === undefined) {return undefined;}
  return { bounds, container, pattern: patternArgs.selectionPattern };
};

export type {
  ActivePatternBounds,
  ActivePatternBoundsArgs,
  BrushChromePattern,
  PixelExtent,
  RawPixelExtent,
  RawPixelExtentArgs,
  SelectionBounds,
  SelectionPatternOptions,
  TrackEdgeMasks,
  TrackSideStyle,
  TrackWidths,
};
export {
  buildSelectionPatternOptions,
  buildTrackEdgeMasks,
  buildTrackSideStyle,
  normalizePixelExtent,
  renderTrackSide,
  resolveActivePatternBounds,
  resolveSelectionBounds,
  resolveTrackWidths,
  selectionToPixelExtent,
  toRawPixelExtent,
};
