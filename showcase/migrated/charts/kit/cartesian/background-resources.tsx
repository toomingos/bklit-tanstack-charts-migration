// The Background preset's <pattern> in a hidden defs host (kit/resource-host), the same seam funnel and heatmap use.
import type { ReactElement } from "react";
import type { ChildTable } from "../read-children";
import { ResourceHost, scopeResourceIds } from "../resource-host";
import { renderPatternPreset } from "../pattern/pattern-preset-render";
import { activeBackground, BACKGROUND_PATTERN_ID } from "./background";

interface BackgroundResourcesProps {
  readonly table: ChildTable;
  readonly uid: string;
}

/** bklit background.tsx:91-100: the preset rendered with the Background's own color, scale and tile options. */
export const BackgroundResources = ({ table, uid }: Readonly<BackgroundResourcesProps>): ReactElement | null => {
  const props = activeBackground(table);
  if (!props) {
    return null;
  }
  const { color = "var(--chart-grid)", complement, dotFill, fill, pattern = "diagonal", radius, scale = 1, strokeWidth, tileBackground } = props;
  const node = renderPatternPreset(pattern, BACKGROUND_PATTERN_ID, { color, complement, dotFill, fill, radius, scale, strokeWidth, tileBackground });
  return <ResourceHost idPrefix={uid} resources={scopeResourceIds(node, uid)} />;
};
