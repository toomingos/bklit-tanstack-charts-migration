"use client";

import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { cn } from "./cn";
import { LegendProvider } from './legend-context';
import type { LegendItemData } from './legend-context';
import { LegendRow } from "./legend-row";

interface LegendProps {
  readonly items: LegendItemData[];
  hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly title?: string;
  readonly titleClassName?: string;
  readonly className?: string;
  readonly children: ReactElement;
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
        {items.map((item: Readonly<LegendItemData>, index: number) => (
          <LegendRow hoveredIndex={hoveredIndex} index={index} item={item} key={item.label}>
            {children}
          </LegendRow>
        ))}
      </div>
    </LegendProvider>
  );
};

Legend.displayName = "Legend";

// Subcomponents live in sibling files (one component per file).
// Re-exported here so existing importers keep working.
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
