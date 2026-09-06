"use client";

import { useCallback } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cn } from "./cn";
import { useLegend, useLegendItem } from './legend-context';

// Button reset (inline): only the UA chrome the div never had; padding/cursor come from classes.
const LEGEND_BUTTON_RESET: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "inherit",
  display: "block",
  font: "inherit",
  margin: 0,
  textAlign: "left",
  width: "100%",
};

interface LegendItemProps {
  readonly className?: string;
  readonly children: ReactNode;
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
  const handleFocus = useCallback((): void => {
    setHoveredIndex(index);
  }, [index, setHoveredIndex]);
  const handleBlur = useCallback((): void => {
    setHoveredIndex(null);
  }, [setHoveredIndex]);

  return (
    <button
      className={cn(
        "cursor-pointer rounded-lg px-2 py-1.5 transition-all duration-150 ease-out",
        isHovered && "bg-legend-muted",
        className
      )}
      data-hovered={isHovered ? "" : undefined}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={LEGEND_BUTTON_RESET}
      type="button"
    >
      {children}
    </button>
  );
}

LegendItem.displayName = "LegendItem";

export type { LegendItemProps };
export { LegendItem };
