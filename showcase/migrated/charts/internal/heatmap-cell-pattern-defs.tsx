import { Fragment, memo } from "react";
import type { ReactElement } from "react";
import { heatmapLevelPatternId, heatmapLevelPatternRenderOptions, isHeatmapLevelPattern } from "./heatmap-colors";
import type { HeatmapLevelStyle, HeatmapLevelStyles } from "./heatmap-colors";
import { renderPatternPreset } from "./pattern-preset-render";

/*
 * TanStack bakes margins into rect coordinates while bklit translates a group, so each base
 * pattern is wrapped in a phase-shifting pattern to land the tile grid on the same phase.
 */
const renderHeatmapCellPatternDefs = ({
  levelStyles,
  patternIdPrefix,
  phaseX,
  phaseY,
}: Readonly<{
  levelStyles: HeatmapLevelStyles;
  patternIdPrefix: string | undefined;
  phaseX: number;
  phaseY: number;
}>) : ReactElement | undefined => {
  const nodes = levelStyles.flatMap((style: Readonly<HeatmapLevelStyle>, level) => {
    if (!isHeatmapLevelPattern(style) || !style.pattern) {
      return [];
    }
    const id = heatmapLevelPatternId(level);
    const scopedId = patternIdPrefix !== undefined && patternIdPrefix !== "" ? `${patternIdPrefix}-${id}` : id;
    const node = renderPatternPreset(
      style.pattern,
      `${scopedId}-base`,
      heatmapLevelPatternRenderOptions(style),
    );
    if (node === undefined || node === null) {return [];}
    return [
      <Fragment key={scopedId}>
        {node}
        <pattern
          id={scopedId}
          href={`#${scopedId}-base`}
          xlinkHref={`#${scopedId}-base`}
          patternTransform={`translate(${phaseX} ${phaseY})`}
        />
      </Fragment>,
    ];
  });
  if (nodes.length === 0) {return undefined;}
  return <defs>{nodes}</defs>;
};

const HeatmapPatternDefs = memo(renderHeatmapCellPatternDefs);

HeatmapPatternDefs.displayName = "HeatmapPatternDefs";

export { HeatmapPatternDefs };
