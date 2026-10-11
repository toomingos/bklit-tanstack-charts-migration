"use client";

// bklit composable legend (legend/*.tsx): <Legend items> maps ONE <LegendItem> child per item, with
// LegendMarker / LegendLabel / LegendValue / LegendProgress reading item context. Plain HTML by design.
import { Progress } from "@base-ui/react/progress";
import { createContext, isValidElement, useCallback, useContext, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { cn } from "../cn";
import { intFmt } from "../format";

export const legendCssVars = {
  background: "var(--legend)",
  foreground: "var(--legend-foreground)",
  muted: "var(--legend-muted)",
  mutedForeground: "var(--legend-muted-foreground)",
  track: "var(--legend-track)",
};

export interface LegendItemData {
  label: string;
  value: number;
  maxValue?: number;
  color: string;
}

export interface LegendContextValue {
  items: LegendItemData[];
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}

export interface LegendItemContextValue {
  item: LegendItemData;
  index: number;
  isHovered: boolean;
  isFaded: boolean;
  percentage: number;
}

const LegendContext = createContext<LegendContextValue | null>(null);
const LegendItemContext = createContext<LegendItemContextValue | null>(null);

export const useLegend = (): LegendContextValue => {
  const context = useContext(LegendContext);
  if (!context) {
    throw new Error("useLegend must be used within a <Legend> component.");
  }
  return context;
};

export const useLegendItem = (): LegendItemContextValue => {
  const context = useContext(LegendItemContext);
  if (!context) {
    throw new Error("useLegendItem must be used within a <LegendItem> component.");
  }
  return context;
};

/** bklit's truthiness test on `maxValue`: set, non-zero and not NaN. */
const hasMax = (maxValue: number | undefined): maxValue is number => maxValue !== undefined && maxValue !== 0 && !Number.isNaN(maxValue);

export interface LegendProps {
  items: LegendItemData[];
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  title?: string;
  titleClassName?: string;
  className?: string;
  children: ReactElement;
}

export const Legend = ({
  items,
  hoveredIndex: controlledHoveredIndex,
  onHoverChange,
  title,
  titleClassName = "text-sm font-semibold",
  className = "",
  children,
}: LegendProps): ReactElement => {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const isControlled = controlledHoveredIndex !== undefined;
  const hoveredIndex = isControlled ? controlledHoveredIndex : internalHoveredIndex;
  const setHoveredIndex = useCallback(
    (index: number | null): void => {
      if (isControlled) {
        onHoverChange?.(index);
      } else {
        setInternalHoveredIndex(index);
      }
    },
    [isControlled, onHoverChange],
  );
  const contextValue = useMemo<LegendContextValue>(() => ({ items, hoveredIndex, setHoveredIndex }), [items, hoveredIndex, setHoveredIndex]);
  const itemContexts = useMemo<LegendItemContextValue[]>(
    () =>
      items.map((item, index) => ({
        item,
        index,
        isHovered: hoveredIndex === index,
        isFaded: hoveredIndex !== null && hoveredIndex !== index,
        percentage: hasMax(item.maxValue) ? (item.value / item.maxValue) * 100 : 0,
      })),
    [items, hoveredIndex],
  );

  return (
    <LegendContext.Provider value={contextValue}>
      <div className={cn("legend-container flex flex-col gap-2", className)} data-hovered-any={hoveredIndex === null ? undefined : ""}>
        {title !== undefined && title !== "" && <h3 className={cn("mb-1 text-legend-foreground", titleClassName)}>{title}</h3>}
        {items.map((item, index) =>
          isValidElement(children) ? (
            <LegendItemContext.Provider key={item.label} value={itemContexts[index]}>
              {children}
            </LegendItemContext.Provider>
          ) : null,
        )}
      </div>
    </LegendContext.Provider>
  );
};
Legend.displayName = "Legend";

export interface LegendItemProps {
  className?: string;
  children: ReactNode;
}

export const LegendItemComponent = ({ className = "", children }: LegendItemProps): ReactElement => {
  const { setHoveredIndex } = useLegend();
  const { index, isHovered } = useLegendItem();
  const onEnter = useCallback((): void => {
    setHoveredIndex(index);
  }, [setHoveredIndex, index]);
  const onLeave = useCallback((): void => {
    setHoveredIndex(null);
  }, [setHoveredIndex]);
  return (
    <div
      className={cn("cursor-pointer rounded-lg px-2 py-1.5 transition-all duration-150 ease-out", isHovered && "bg-legend-muted", className)}
      data-hovered={isHovered ? "" : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
    </div>
  );
};
LegendItemComponent.displayName = "LegendItem";

export interface LegendMarkerProps {
  className?: string;
}

export const LegendMarker = ({ className = "h-2.5 w-2.5" }: LegendMarkerProps): ReactElement => {
  const { item } = useLegendItem();
  const style = useMemo<CSSProperties>(() => ({ backgroundColor: item.color }), [item.color]);
  return <div className={cn("shrink-0 rounded-full", className)} style={style} />;
};
LegendMarker.displayName = "LegendMarker";

export interface LegendLabelProps {
  className?: string;
}

export const LegendLabel = ({ className = "text-sm font-medium" }: LegendLabelProps): ReactElement => {
  const { item } = useLegendItem();
  return <span className={cn("text-legend-foreground", className)}>{item.label}</span>;
};
LegendLabel.displayName = "LegendLabel";

export interface LegendValueProps {
  className?: string;
  showPercentage?: boolean;
  percentageClassName?: string;
  formatValue?: (value: number) => string;
  formatPercentage?: (percentage: number) => string;
}

const formatWholePercent = (p: number): string => `${p.toFixed(0)}%`;

export const LegendValue = ({
  className = "text-sm tabular-nums",
  showPercentage = false,
  percentageClassName = "text-xs tabular-nums",
  formatValue = intFmt,
  formatPercentage = formatWholePercent,
}: LegendValueProps): ReactElement => {
  const { item, percentage } = useLegendItem();
  return (
    <span className={cn("flex items-center gap-2 text-legend-muted-foreground", className)}>
      <span>{formatValue(item.value)}</span>
      {showPercentage && hasMax(item.maxValue) && <span className={percentageClassName}>{formatPercentage(percentage)}</span>}
    </span>
  );
};
LegendValue.displayName = "LegendValue";

export interface LegendProgressProps {
  trackClassName?: string;
  indicatorClassName?: string;
  height?: string;
}

export const LegendProgress = ({ trackClassName = "", indicatorClassName = "", height = "h-1.5" }: LegendProgressProps): ReactElement | null => {
  const { item } = useLegendItem();
  const indicatorStyle = useMemo<CSSProperties>(() => ({ backgroundColor: item.color }), [item.color]);
  if (!hasMax(item.maxValue)) {
    return null;
  }
  return (
    <Progress.Root max={item.maxValue} value={item.value}>
      <Progress.Track className={cn("w-full overflow-hidden rounded-full bg-legend-track", height, trackClassName)}>
        <Progress.Indicator className={cn("h-full rounded-full transition-all duration-500", indicatorClassName)} style={indicatorStyle} />
      </Progress.Track>
    </Progress.Root>
  );
};
LegendProgress.displayName = "LegendProgress";
