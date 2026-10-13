// ReferenceArea pattern fills (bklit reference-area.tsx:152-168) in the hidden defs host (kit/resource-host), the Background's seam:
// the renderer emits no <pattern> resource (UPSTREAM-GAPS #6).
import type { ReactElement } from "react";
import type { ChartMargin } from "../theme";
import type { ChildTable } from "../read-children";
import { propsFor } from "../read-children";
import { ResourceHost, scopeResourceIds, translatePatterns } from "../resource-host";
import { renderPatternPreset } from "../pattern/pattern-preset-render";
import type { PatternPresetId } from "../pattern/pattern-preset-helpers";

export interface ReferencePatternProps {
  readonly pattern?: PatternPresetId;
  readonly patternColor?: string;
  readonly patternScale?: number;
  readonly patternStrokeWidth?: number;
  readonly patternRadius?: number;
  readonly patternComplement?: boolean;
  readonly patternFill?: string;
  readonly patternDotFill?: boolean;
  readonly patternTileBackground?: string;
}

/** The unscoped pattern id of the i-th ReferenceArea; the host scopes it to the chart (`scopeResourceIds`). */
export const referencePatternId = (index: number): string => `refarea-pattern-${index}`;

/** bklit `usesPattern` (reference-area.tsx:152): a pattern other than "none" replaces the solid fill. */
export const usesReferencePattern = (props: ReferencePatternProps): boolean => props.pattern !== undefined && props.pattern !== "none";

interface ReferenceAreaResourcesProps {
  readonly table: ChildTable;
  readonly uid: string;
  readonly margin: ChartMargin;
}

export const ReferenceAreaResources = ({ table, uid, margin }: Readonly<ReferenceAreaResourcesProps>): ReactElement | null => {
  const nodes = propsFor<ReferencePatternProps>(table, "referenceArea").flatMap((r, i) =>
    usesReferencePattern(r) && r.pattern !== undefined
      ? [renderPatternPreset(r.pattern, referencePatternId(i), {
          color: r.patternColor ?? "var(--chart-foreground-muted)",
          scale: r.patternScale ?? 1,
          strokeWidth: r.patternStrokeWidth,
          radius: r.patternRadius,
          complement: r.patternComplement,
          fill: r.patternFill,
          dotFill: r.patternDotFill,
          tileBackground: r.patternTileBackground,
        })]
      : [],
  );
  if (nodes.length === 0) {
    return null;
  }
  // bklit's tiles start at the plot origin (the pattern lives in the margin-translated plot group); the native rect is in svg space.
  return <ResourceHost idPrefix={uid} resources={scopeResourceIds(translatePatterns(nodes, margin.left, margin.top), uid)} />;
};
