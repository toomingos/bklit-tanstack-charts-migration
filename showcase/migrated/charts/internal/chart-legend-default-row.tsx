// Default legend row: stable hover handlers per row so the parent map never
// Allocates inline closures during render.
import { useCallback } from "react";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { ProgressItem } from "./chart-legend-progress-item";
import { SimpleItem } from "./chart-legend-simple-item";
import type { ChartLegendProps, LegendItem } from "./chart-legend";

// A missing or zero maximum means the item has no progress scale to draw.
const EMPTY_PROGRESS_MAXIMUM = 0;

interface DefaultLegendRowProps {
  readonly displayPercentage: boolean;
  readonly formatValue: (value: number) => string;
  readonly index: number;
  readonly isFaded: boolean;
  readonly isHovered: boolean;
  readonly item: LegendItem;
  readonly itemClassName: string;
  readonly labelClassName: string;
  readonly onHover: ChartLegendProps["onHover"];
  readonly showMarker: boolean;
  readonly showProgress: boolean;
  readonly showValue: boolean;
  readonly valueClassName: string;
}

interface DefaultLegendBodyOptions {
  readonly displayPercentage: boolean;
  readonly formatValue: (value: number) => string;
  readonly item: LegendItem;
  readonly labelClassName: string;
  readonly showMarker: boolean;
  readonly showProgress: boolean;
  readonly showValue: boolean;
  readonly valueClassName: string;
}

const renderDefaultLegendBody = (options: Readonly<DefaultLegendBodyOptions>): ReactElement => {
  const { displayPercentage, formatValue, item, labelClassName, showMarker, showProgress, showValue, valueClassName } = options;
  if (showProgress && (item.maxValue ?? EMPTY_PROGRESS_MAXIMUM) !== EMPTY_PROGRESS_MAXIMUM) {
    return (
      <ProgressItem
        formatValue={formatValue}
        item={item}
        labelClassName={labelClassName}
        showMarker={showMarker}
        showPercentage={displayPercentage}
        showValue={showValue}
        valueClassName={valueClassName}
      />
    );
  }
  return (
    <SimpleItem
      formatValue={formatValue}
      item={item}
      labelClassName={labelClassName}
      showMarker={showMarker}
      showValue={showValue}
      valueClassName={valueClassName}
    />
  );
};

const DefaultLegendRow = ({
  displayPercentage,
  formatValue,
  index,
  isFaded,
  isHovered,
  item,
  itemClassName,
  labelClassName,
  onHover,
  showMarker,
  showProgress,
  showValue,
  valueClassName,
}: Readonly<DefaultLegendRowProps>): ReactElement => {
  const handleMouseEnter = useCallback((): void => {
    onHover?.(index);
  }, [index, onHover]);
  const handleMouseLeave = useCallback((): void => {
    onHover?.(null);
  }, [onHover]);
  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg px-2 py-1.5 transition-all duration-150 ease-out",
        isHovered && "bg-legend-muted",
        isFaded && "opacity-40",
        itemClassName
      )}
      data-hovered={isHovered ? "" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderDefaultLegendBody({
        displayPercentage,
        formatValue,
        item,
        labelClassName,
        showMarker,
        showProgress,
        showValue,
        valueClassName,
      })}
    </div>
  );
};

export { DefaultLegendRow };
export type { DefaultLegendRowProps };
