import { Fragment, memo } from "react";
import { heatmapLevelPatternId, heatmapLevelPatternRenderOptions, isHeatmapLevelPattern } from "./heatmap-colors";
import type { HeatmapLevelStyle, HeatmapLevelStyles } from "./heatmap-colors";
import { renderPatternPreset } from "./pattern-preset-render";

// Port of repos/bklit-ui/packages/ui/src/charts/heatmap/
// The heatmap-pattern-defs.tsx file renders the <pattern> defs backing pattern-mode
// Pattern-mode levelStyles (HM14): one deviation forced by the TanStack backend — bklit
// Paints cells inside `<g transform=translate(margin)>`, so its
// Tiles using userSpaceOnUse anchor at the plot origin; TanStack bakes margins into
// Rect coordinates, so each base pattern is wrapped in a phase-shifting
// Pattern (same trick as area-chart.tsx) to land the tile grid on the same
// Phase. Ids derive from bklit's `heatmap-level-N` names under a useId-
// Scoped prefix so multiple instances/legends on one page never collide.
const HeatmapPatternDefs = memo(({
  levelStyles,
  patternIdPrefix,
  phaseX,
  phaseY,
}: Readonly<{
  levelStyles: HeatmapLevelStyles;
  patternIdPrefix: string | undefined;
  phaseX: number;
  phaseY: number;
}>) => {
  const nodes = levelStyles.flatMap((style: Readonly<HeatmapLevelStyle>, level) => {
    if (!isHeatmapLevelPattern(style) || !style.pattern) {
      return [];
    }
    const id = heatmapLevelPatternId(level);
    const scopedId = patternIdPrefix ? `${patternIdPrefix}-${id}` : id;
    const node = renderPatternPreset(
      style.pattern,
      `${scopedId}-base`,
      heatmapLevelPatternRenderOptions(style),
    );
    if (!node) {return [];}
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
