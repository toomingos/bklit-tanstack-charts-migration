// Pattern-preset renderer: builds the tile node for a preset id.
// Split from the pattern-preset barrel so that barrel re-exports components only.
import type { ReactElement, ReactNode } from "react";
import {
  CIRCLE_RADIUS_SCALE_FACTOR,
  DEFAULT_PATTERN_SCALE,
  DEFAULT_PATTERN_STROKE_WIDTH,
  DOT_RADIUS_MIN,
  DOT_RADIUS_SCALE_FACTOR,
  DOTS_STROKE_WIDTH,
} from "./pattern-geometry";
import {
  CROSS_ORIENTATION,
  DIAGONAL_ORIENTATION,
  HORIZONTAL_ORIENTATION,
  PatternLines,
  VERTICAL_ORIENTATION,
} from "./pattern-lines";
import { PatternCircles } from "./pattern-shapes";
import type { PatternOrientationType } from "./pattern-lines";
import { patternPresetTileSize } from "./pattern-preset-helpers";
import type { PatternPresetId, PatternPresetOptions, PatternTileCommon } from "./pattern-preset-helpers";

interface PatternCirclesRenderArgs {
  readonly preset: "dots" | "circles";
  readonly color: string;
  readonly common: Readonly<PatternTileCommon>;
  readonly options: Readonly<PatternPresetOptions>;
  readonly scale: number;
}

// Dot-grid branch of the circle patterns; hoisted so renderPatternCircles stays short.
const renderDotsPattern = (dotsArgs: Readonly<PatternCirclesRenderArgs>): ReactElement => {
  const radius = dotsArgs.options.radius ?? Math.max(DOT_RADIUS_MIN, DOT_RADIUS_SCALE_FACTOR * dotsArgs.scale);
  const dotFillEnabled = dotsArgs.options.dotFill !== false;
  const fallbackFill = dotsArgs.options.fill !== undefined && dotsArgs.options.fill !== "" ? dotsArgs.options.fill : dotsArgs.color;
  const dotFill = dotFillEnabled ? fallbackFill : undefined;
  const dotStrokeWidth = dotsArgs.options.strokeWidth ?? DOTS_STROKE_WIDTH;
  const ringStrokeWidth = dotsArgs.options.strokeWidth ?? DEFAULT_PATTERN_STROKE_WIDTH;
  const strokeWidth = dotFillEnabled && (dotsArgs.options.fill === undefined || dotsArgs.options.fill === "")
    ? dotStrokeWidth
    : ringStrokeWidth;
  return (
    <PatternCircles
      id={dotsArgs.common.id}
      width={dotsArgs.common.width}
      height={dotsArgs.common.height}
      background={dotsArgs.common.background}
      complement={dotsArgs.options.complement}
      fill={dotFill}
      radius={radius}
      stroke={dotFillEnabled && dotsArgs.options.fill !== undefined && dotsArgs.options.fill !== "" ? undefined : dotsArgs.color}
      strokeWidth={strokeWidth}
    />
  );
};

const renderPatternCircles = (circleArgs: Readonly<PatternCirclesRenderArgs>): ReactElement => {
  if (circleArgs.preset !== "dots") {
    const radius = circleArgs.options.radius ?? CIRCLE_RADIUS_SCALE_FACTOR * circleArgs.scale;
    return (
      <PatternCircles
        id={circleArgs.common.id}
        width={circleArgs.common.width}
        height={circleArgs.common.height}
        background={circleArgs.common.background}
        complement={circleArgs.options.complement}
        fill={circleArgs.options.fill !== undefined && circleArgs.options.fill !== "" ? circleArgs.options.fill : undefined}
        radius={radius}
        stroke={circleArgs.color}
        strokeWidth={circleArgs.options.strokeWidth ?? circleArgs.common.strokeWidth}
      />
    );
  }
  return renderDotsPattern(circleArgs);
};

interface PatternLineRenderArgs {
  readonly common: Readonly<PatternTileCommon>;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly orientation: readonly PatternOrientationType[];
}

// One oriented line pattern; hoisted so the preset switch stays short.
const renderOrientedLinePattern = (lineArgs: Readonly<PatternLineRenderArgs>): ReactElement => (
  <PatternLines
    id={lineArgs.common.id}
    width={lineArgs.common.width}
    height={lineArgs.common.height}
    background={lineArgs.common.background}
    orientation={lineArgs.orientation}
    stroke={lineArgs.stroke}
    strokeWidth={lineArgs.strokeWidth}
  />
);

interface LinePatternPresetArgs {
  readonly preset: PatternPresetId;
  readonly common: Readonly<PatternTileCommon>;
  readonly color: string;
  readonly strokeWidth: number;
}

// Line-preset branch of the dispatcher; hoisted so renderPatternPreset stays short.
const renderLinePatternPreset = (linePreset: Readonly<LinePatternPresetArgs>): ReactNode => {
  switch (linePreset.preset) {
    case "diagonal": {
      return renderOrientedLinePattern({ common: linePreset.common, orientation: DIAGONAL_ORIENTATION, stroke: linePreset.color, strokeWidth: linePreset.strokeWidth });
    }
    case "horizontal": {
      return renderOrientedLinePattern({ common: linePreset.common, orientation: HORIZONTAL_ORIENTATION, stroke: linePreset.color, strokeWidth: linePreset.strokeWidth });
    }
    case "vertical": {
      return renderOrientedLinePattern({ common: linePreset.common, orientation: VERTICAL_ORIENTATION, stroke: linePreset.color, strokeWidth: linePreset.strokeWidth });
    }
    case "cross": {
      return renderOrientedLinePattern({ common: linePreset.common, orientation: CROSS_ORIENTATION, stroke: linePreset.color, strokeWidth: linePreset.strokeWidth });
    }
    case "accent": {
      return renderOrientedLinePattern({ common: linePreset.common, orientation: DIAGONAL_ORIENTATION, stroke: "#e879f9", strokeWidth: linePreset.strokeWidth });
    }
    case "dots":
    case "circles":
    case "none": {
      return undefined;
    }
    default: {
      return undefined;
    }
  }
};

const renderPatternPreset = (preset: PatternPresetId, id: string, options: Readonly<PatternPresetOptions> = {}): ReactNode => {
  if (preset === "none") {
    return undefined;
  }

  const color = options.color ?? "var(--chart-1)";
  const scale = options.scale ?? DEFAULT_PATTERN_SCALE;
  const tile = patternPresetTileSize(preset, scale);
  const tileBackground = options.tileBackground !== undefined && options.tileBackground !== ""
    ? { background: options.tileBackground }
    : undefined;
  const common: PatternTileCommon = {
    height: tile.height,
    id,
    strokeWidth: tile.strokeWidth,
    width: tile.width,
    ...tileBackground,
  };

  if (preset === "dots" || preset === "circles") {
    return renderPatternCircles({ color, common, options, preset, scale });
  }

  const strokeWidth = options.strokeWidth ?? tile.strokeWidth;
  return renderLinePatternPreset({ color, common, preset, strokeWidth });
}

export { renderPatternPreset };
