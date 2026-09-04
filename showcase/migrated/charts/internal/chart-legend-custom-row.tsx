// Custom legend row: stable hover handlers per row so the parent map never
// Allocates inline closures during render.
import { useCallback } from "react";
import type { ReactElement } from "react";
import type { ChartLegendProps, LegendItem } from "./chart-legend";

interface CustomLegendRowProps {
  readonly index: number;
  readonly isFaded: boolean;
  readonly isHovered: boolean;
  readonly item: LegendItem;
  readonly onHover: ChartLegendProps["onHover"];
  readonly percentage: number;
  readonly renderItem: NonNullable<ChartLegendProps["renderItem"]>;
}

const CustomLegendRow = ({
  index,
  isFaded,
  isHovered,
  item,
  onHover,
  percentage,
  renderItem,
}: Readonly<CustomLegendRowProps>): ReactElement => {
  const handleMouseEnter = useCallback((): void => {
    onHover?.(index);
  }, [index, onHover]);
  const handleMouseLeave = useCallback((): void => {
    onHover?.(null);
  }, [onHover]);
  return (
    <div
      data-hovered={isHovered ? "" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderItem({ index, isFaded, isHovered, item, percentage })}
    </div>
  );
};

export { CustomLegendRow };
export type { CustomLegendRowProps };
