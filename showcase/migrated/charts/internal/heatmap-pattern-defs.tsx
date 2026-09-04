import { Fragment, memo } from 'react';
import type { ReactElement } from 'react';
import { heatmapLevelPatternId, heatmapLevelPatternRenderOptions, isHeatmapLevelPattern } from './heatmap-colors';
import type { HeatmapLevelStyle, HeatmapLevelStyles } from './heatmap-colors';
import { renderPatternPreset } from "./pattern-preset-render";

interface HeatmapPatternDefsProps {
  levelStyles: HeatmapLevelStyles;
  patternIdPrefix: string | undefined;
  phaseX: number;
  phaseY: number;
}

// TanStack bakes margins into rect coords, so base patterns wrap in a phase-shifting
// Pattern matching bklit's plot-origin tile phase; ids are useId-scoped.
const HeatmapPatternDefs = memo(({
  levelStyles,
  patternIdPrefix,
  phaseX,
  phaseY,
}: Readonly<HeatmapPatternDefsProps>): ReactElement | undefined => {
  const nodes = levelStyles.flatMap((style: Readonly<HeatmapLevelStyle>, level: number) => {
    if (!isHeatmapLevelPattern(style) || !style.pattern) {
      return [];
    }
    const id = heatmapLevelPatternId(level);
    const scopedId = patternIdPrefix === undefined ? id : `${patternIdPrefix}-${id}`;
    const node = renderPatternPreset(
      style.pattern,
      `${scopedId}-base`,
      heatmapLevelPatternRenderOptions(style),
    );
    if (node === null) {return [];}
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
});

HeatmapPatternDefs.displayName = "HeatmapPatternDefs";

export { HeatmapPatternDefs };
