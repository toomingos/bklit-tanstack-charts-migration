"use client";

import { useCallback } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from "@/lib/utils";
import { useLegend, useLegendItem } from './legend-context';

interface LegendItemProps {
  className?: string;
  children: ReactNode;
}

const LegendItem = ({ className = "", children }: Readonly<LegendItemProps>): ReactElement => {
  const { setHoveredIndex } = useLegend();
  const { index, isHovered } = useLegendItem();

  const handleMouseEnter = useCallback((): void => {
    setHoveredIndex(index);
  }, [index, setHoveredIndex]);
  const handleMouseLeave = useCallback((): void => {
    setHoveredIndex(null);
  }, [setHoveredIndex]);

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg px-2 py-1.5 transition-all duration-150 ease-out",
        isHovered && "bg-legend-muted",
        className
      )}
      data-hovered={isHovered ? "" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

LegendItem.displayName = "LegendItem";

export type { LegendItemProps };
export { LegendItem };
