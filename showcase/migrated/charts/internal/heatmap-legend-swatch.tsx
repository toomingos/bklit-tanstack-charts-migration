import { useId } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { heatmapLevelPatternId, heatmapLevelPatternRenderOptions, isHeatmapLevelPattern } from './heatmap-colors';
import type { HeatmapLevelStyle } from './heatmap-colors';
import { renderPatternPreset } from "./pattern-preset-render";

// Legend swatch, split out so heatmap-legend.tsx stays under the size limits.

// Static svg fill style for the pattern branch; hoisted so it keeps identity.
const SWATCH_SVG_STYLE = { display: "block", height: "100%", width: "100%" } as const;

// The base level has no pattern to draw, so it renders as a hairline swatch.
const BASE_HEATMAP_LEVEL = 0;

// A pattern without an explicit opacity renders fully opaque.
const FULL_PATTERN_OPACITY = 1;

interface HeatmapLegendSwatchProps {
  readonly level: number;
  readonly style: HeatmapLevelStyle;
  readonly cellSize: number;
  readonly cornerRadius: number;
}

interface PatternSwatchArgs {
  readonly style: HeatmapLevelStyle;
  readonly level: number;
  readonly reactId: string;
  readonly cellSize: number;
  readonly cornerRadius: number;
}

// Pattern shell style; hoisted so the swatch passes no fresh object to JSX.
const buildPatternShellStyle = (swatch: Readonly<PatternSwatchArgs>): CSSProperties => ({
  borderRadius: swatch.cornerRadius,
  height: swatch.cellSize,
  opacity: swatch.style.patternOpacity ?? FULL_PATTERN_OPACITY,
  overflow: "hidden",
  width: swatch.cellSize,
});

// Pattern branch of the legend swatch; undefined when the level is solid. Hoisted so the swatch stays short.
const renderPatternSwatch = (swatch: Readonly<PatternSwatchArgs>): ReactElement | undefined => {
  if (!isHeatmapLevelPattern(swatch.style) || !swatch.style.pattern) {return undefined;}
  // Ids are useId-scoped so multiple charts/legends on one page don't collide.
  const patternId = `${swatch.reactId}-${heatmapLevelPatternId(swatch.level)}`;
  const patternNode = renderPatternPreset(
    swatch.style.pattern,
    `${patternId}-base`,
    heatmapLevelPatternRenderOptions(swatch.style),
  );

  return (
    <span
      aria-hidden="true"
      className="ts-bkm-heatmap-legend-swatch ts-bkm-heatmap-legend-swatch--pattern"
      style={buildPatternShellStyle(swatch)}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${swatch.cellSize} ${swatch.cellSize}`} style={SWATCH_SVG_STYLE}>
        {patternNode !== undefined && patternNode !== null ? <defs>{patternNode}</defs> : undefined}
        <rect
          fill={patternNode !== undefined && patternNode !== null ? `url(#${patternId})` : swatch.style.color}
          height={swatch.cellSize}
          rx={swatch.cornerRadius}
          ry={swatch.cornerRadius}
          width={swatch.cellSize}
        />
      </svg>
    </span>
  );
};

interface SolidSwatchArgs {
  readonly style: HeatmapLevelStyle;
  readonly level: number;
  readonly cellSize: number;
  readonly cornerRadius: number;
}

// Solid swatch style; hoisted so the swatch stays short.
const buildSolidSwatchStyle = (swatch: Readonly<SolidSwatchArgs>): CSSProperties => {
  const solidStyle: CSSProperties = {
    backgroundColor: swatch.style.color,
    borderRadius: swatch.cornerRadius,
    boxSizing: "border-box",
    height: swatch.cellSize,
    width: swatch.cellSize,
  };
  if (swatch.level === BASE_HEATMAP_LEVEL) {
    solidStyle.border = `1px solid ${swatch.style.color}`;
  }
  return solidStyle;
};

const HeatmapLegendSwatch = ({ level, style, cellSize, cornerRadius }: Readonly<HeatmapLegendSwatchProps>): ReactElement => {
  // Unconditional (rules of hooks); consumed only by the pattern branch.
  const reactId = useId().replaceAll(':', "");
  const patternElement = renderPatternSwatch({ cellSize, cornerRadius, level, reactId, style });
  if (patternElement !== undefined) {return patternElement;}

  return (
    <span
      aria-hidden="true"
      className="ts-bkm-heatmap-legend-swatch"
      style={buildSolidSwatchStyle({ cellSize, cornerRadius, level, style })}
    />
  );
};

export type { HeatmapLegendSwatchProps };
export { HeatmapLegendSwatch };
