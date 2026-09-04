"use client";

import { isValidElement, useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { cn } from "@/lib/utils";
import { LegendItemProvider, LegendProvider } from './legend-context';
import type { LegendItemData } from './legend-context';

// Scale factor converting a 0–1 value ratio into a 0–100 percentage.
const PERCENT_SCALE = 100;

interface LegendProps {
  readonly items: readonly LegendItemData[];
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  title?: string;
  titleClassName?: string;
  className?: string;
  children: ReactElement;
}

const legendItemPercentage = (item: Readonly<LegendItemData>): number => {
  const maxValue = item.maxValue ?? 0;
  if (maxValue === 0) {return 0;}
  return (item.value / maxValue) * PERCENT_SCALE;
}

interface RenderLegendRowParams {
  readonly item: Readonly<LegendItemData>;
  readonly index: number;
  readonly hoveredIndex: number | null | undefined;
  readonly children: ReactElement;
}

const renderLegendRow = (params: Readonly<RenderLegendRowParams>): ReactElement | undefined => {
  const { item, index, hoveredIndex, children: rowChildren } = params;
  const isHovered = hoveredIndex === index;
  const isFaded = hoveredIndex !== null && hoveredIndex !== index;
  const itemContext = {
    index,
    isFaded,
    isHovered,
    item,
    percentage: legendItemPercentage(item),
  };
  if (!isValidElement(rowChildren)) {return undefined;}
  return (
    <LegendItemProvider key={item.label} value={itemContext}>
      {rowChildren}
    </LegendItemProvider>
  );
}

const Legend = ({
  items,
  hoveredIndex: controlledHoveredIndex,
  onHoverChange,
  title,
  titleClassName = "text-sm font-semibold",
  className = "",
  children,
}: Readonly<LegendProps>): ReactElement => {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<
    number | null
  >(null);

  const isControlled = controlledHoveredIndex !== undefined;
  const hoveredIndex = isControlled
    ? controlledHoveredIndex
    : internalHoveredIndex;
  const setHoveredIndex = useCallback((index: number | null): void => {
    if (isControlled) {
      onHoverChange?.(index);
    } else {
      setInternalHoveredIndex(index);
    }
  }, [isControlled, onHoverChange]);

  const contextValue = useMemo(() => ({
    hoveredIndex,
    items,
    setHoveredIndex,
  }), [hoveredIndex, items, setHoveredIndex]);

  return (
    <LegendProvider value={contextValue}>
      <div className={cn("legend-container flex flex-col gap-2", className)}>
        {(title ?? "").length > 0 && (
          <h3 className={cn("mb-1 text-legend-foreground", titleClassName)}>
            {title}
          </h3>
        )}
        {items.map((item: Readonly<LegendItemData>, index: number) =>
          renderLegendRow({ children, hoveredIndex, index, item }),
        )}
      </div>
    </LegendProvider>
  );
};

Legend.displayName = "Legend";

// Subcomponents live in sibling files (one component per file); re-exported
// here unchanged so existing importers keep working.
export { LegendItem } from './legend-item';
export { LegendMarker } from './legend-marker';
export { LegendLabel } from './legend-label';
export { LegendValue } from './legend-value';
export { LegendProgress } from './legend-progress';
export type { LegendItemProps } from './legend-item';
export type { LegendMarkerProps } from './legend-marker';
export type { LegendLabelProps } from './legend-label';
export type { LegendValueProps } from './legend-value';
export type { LegendProgressProps } from './legend-progress';

export type {
  LegendProps,
};
export {
  Legend,
};
