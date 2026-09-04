// Pie center state helpers: content resolution and shared format defaults.
// Split from pie-center so each module exports a uniform shape.
import { centerStatContainerClassName, defaultCenterStatFormat } from "./center-stat";
import type { CenterStatFormat } from "./center-stat";
import type { PieCenterContent, PieCenterContentSource } from "./pie-center";

// Inset subtracted from the inner diameter so the center stat box clears the ring edge.
const CENTER_STAT_BOX_INSET_PX = 16;

const defaultPieCenterFormat: CenterStatFormat = defaultCenterStatFormat;

const resolvePieCenterContent = (stable: Readonly<PieCenterContentSource>, hoveredIndex: number | null | undefined, defaultLabel: string): PieCenterContent => {
// Scrub mode never shows hover state in the center.
  const effectiveHoveredIndex = stable.geometryScrubbing ? undefined : hoveredIndex;
  const hoveredData = effectiveHoveredIndex === null || effectiveHoveredIndex === undefined ? undefined : stable.data[effectiveHoveredIndex];
  return {
    displayLabel: hoveredData ? hoveredData.label : defaultLabel,
    displayValue: hoveredData ? hoveredData.value : stable.totalValue,
    hoveredData,
  };
}

const resolvePieCenterClassName = (className: string | undefined): string =>
  (className?.length ?? 0) > 0 ? `${centerStatContainerClassName} ${className}` : centerStatContainerClassName;

export {
  CENTER_STAT_BOX_INSET_PX,
  defaultPieCenterFormat,
  resolvePieCenterContent,
  resolvePieCenterClassName,
};
