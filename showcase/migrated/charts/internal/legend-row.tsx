"use client";

import { isValidElement, useMemo } from "react";
import type { ReactElement } from "react";
import { LegendItemProvider } from "./legend-context";
import type { LegendItemContextValue, LegendItemData } from "./legend-context";

// Scale factor converting a 0–1 value ratio into a 0–100 percentage.
const PERCENT_SCALE = 100;

interface LegendRowProps {
  readonly children: ReactElement;
  readonly hoveredIndex: number | null | undefined;
  readonly index: number;
  readonly item: LegendItemData;
}

// One legend row: memoizes its item context so rows whose hover inputs are
// Unchanged keep a stable value identity across parent re-renders.
const LegendRow = ({
  children: rowChildren,
  hoveredIndex,
  index,
  item,
}: Readonly<LegendRowProps>): ReactElement | undefined => {
  const isHovered = hoveredIndex === index;
  const isFaded = hoveredIndex !== null && hoveredIndex !== index;
  const maxValue = item.maxValue ?? 0;
  const percentage = maxValue === 0 ? 0 : (item.value / maxValue) * PERCENT_SCALE;
  const itemContext = useMemo<LegendItemContextValue>((): LegendItemContextValue => ({
    index,
    isFaded,
    isHovered,
    item,
    percentage,
  }), [index, isFaded, isHovered, item, percentage]);
  if (!isValidElement(rowChildren)) {return undefined;}
  return (
    <LegendItemProvider value={itemContext}>
      {rowChildren}
    </LegendItemProvider>
  );
};

LegendRow.displayName = "LegendRow";

export { LegendRow };
export type { LegendRowProps };
