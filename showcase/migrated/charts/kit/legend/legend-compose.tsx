"use client";

// bklit composable legend (legend/*.tsx): <Legend items> maps ONE <LegendItem> child per item, with
// LegendMarker / LegendLabel / LegendValue / LegendProgress reading item context. Plain HTML by design.
import { Progress } from "@base-ui/react/progress";
import { createContext, isValidElement, useCallback, useContext, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { cn } from "../cn";
import { intFmt } from "../format";

/** @internal */
export const legendCssVars = {
  background: "var(--legend)",
  foreground: "var(--legend-foreground)",
  muted: "var(--legend-muted)",
  mutedForeground: "var(--legend-muted-foreground)",
  track: "var(--legend-track)",
};

/** One entry of a `Legend`. */
export interface LegendItemData {
  /** Name shown for the item. */
  label: string;
  /** Current value of the item. */
  value: number;
  /** Value that counts as 100%. Drives the percentage and `LegendProgress`; both are hidden when it is missing or zero. */
  maxValue?: number;
  /** Color of the marker and the progress bar. */
  color: string;
}

/** What `useLegend()` returns inside a `Legend`. */
export interface LegendContextValue {
  /** The items of the legend. */
  items: LegendItemData[];
  /** Index of the hovered item, or `null`. */
  hoveredIndex: number | null;
  /** Sets the hovered item. In a controlled legend it calls `onHoverChange` instead. */
  setHoveredIndex: (index: number | null) => void;
}

/** What `useLegendItem()` returns inside a `Legend` item. */
export interface LegendItemContextValue {
  /** The item being rendered. */
  item: LegendItemData;
  /** Position of the item. */
  index: number;
  /** Whether this item is hovered. */
  isHovered: boolean;
  /** Whether another item is hovered, so this one should be dimmed. */
  isFaded: boolean;
  /** `value / maxValue * 100`, or `0` when the item has no `maxValue`. */
  percentage: number;
}

const LegendContext = createContext<LegendContextValue | null>(null);
const LegendItemContext = createContext<LegendItemContextValue | null>(null);

/** Reads the legend state (items and hovered index). Throws outside a `Legend`. */
export const useLegend = (): LegendContextValue => {
  const context = useContext(LegendContext);
  if (!context) {
    throw new Error("useLegend must be used within a <Legend> component.");
  }
  return context;
};

/** Reads the state of the legend item being rendered. Throws outside a `Legend` item. */
export const useLegendItem = (): LegendItemContextValue => {
  const context = useContext(LegendItemContext);
  if (!context) {
    throw new Error("useLegendItem must be used within a <LegendItem> component.");
  }
  return context;
};

/** bklit's truthiness test on `maxValue`: set, non-zero and not NaN. */
const hasMax = (maxValue: number | undefined): maxValue is number => maxValue !== undefined && maxValue !== 0 && !Number.isNaN(maxValue);

/** Props of `Legend`. */
export interface LegendProps {
  /** The items to list. */
  items: LegendItemData[];
  /** Controlled hovered item index (`null` for none). The legend manages hover itself when this is left `undefined`. */
  hoveredIndex?: number | null;
  /** Called with the hovered item index, or `null` when the pointer leaves. Only used when `hoveredIndex` is controlled. */
  onHoverChange?: (index: number | null) => void;
  /** Heading shown above the items. */
  title?: string;
  /** Class names added to the title, on top of the default title style. */
  titleClassName?: string;
  /** Class names added to the legend container. */
  className?: string;
  /** A single element rendered once per item, usually a `LegendItemComponent`. */
  children: ReactElement;
}

/**
 * A composable legend. Pass `items` and one child, a `LegendItemComponent`; the child is rendered once per item with its marker, label, value and progress bar.
 */
export const Legend = ({
  items,
  hoveredIndex: controlledHoveredIndex,
  onHoverChange,
  title,
  titleClassName = "bk-text-sm bk-font-semibold",
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
      <div className={cn("legend-container bk-legend", className)} data-hovered-any={hoveredIndex === null ? undefined : ""}>
        {title !== undefined && title !== "" && <h3 className={cn("bk-legend-title", titleClassName)}>{title}</h3>}
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

/** Props of `LegendItemComponent`. */
export interface LegendItemProps {
  /** Class names added to the row, on top of the default row style. */
  className?: string;
  /** Row content, for example `LegendMarker`, `LegendLabel`, `LegendValue` and `LegendProgress`. */
  children: ReactNode;
}

/**
 * One legend row. It sets the hovered item when the pointer enters it and highlights itself while hovered. Use it as the single child of `Legend`.
 */
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
      className={cn("bk-legend-item", isHovered && "bk-legend-item-hovered", className)}
      data-hovered={isHovered ? "" : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
    </div>
  );
};
LegendItemComponent.displayName = "LegendItem";

/** Props of `LegendMarker`. */
export interface LegendMarkerProps {
  /** Class names that replace the default marker size. */
  className?: string;
}

/** A colored dot in the item's color. */
export const LegendMarker = ({ className = "bk-marker-size" }: LegendMarkerProps): ReactElement => {
  const { item } = useLegendItem();
  const style = useMemo<CSSProperties>(() => ({ backgroundColor: item.color }), [item.color]);
  return <div className={cn("bk-legend-marker", className)} style={style} />;
};
LegendMarker.displayName = "LegendMarker";

/** Props of `LegendLabel`. */
export interface LegendLabelProps {
  /** Class names that replace the default label text style. */
  className?: string;
}

/** The item's label text. */
export const LegendLabel = ({ className = "bk-text-sm bk-font-medium" }: LegendLabelProps): ReactElement => {
  const { item } = useLegendItem();
  return <span className={cn("bk-legend-fg", className)}>{item.label}</span>;
};
LegendLabel.displayName = "LegendLabel";

/** Props of `LegendValue`. */
export interface LegendValueProps {
  /** Class names that replace the default value text style. */
  className?: string;
  /**
   * Show the percentage of `maxValue` next to the value. Nothing is shown for items without a `maxValue`.
   * @default false
   */
  showPercentage?: boolean;
  /** Class names that replace the default percentage text style. */
  percentageClassName?: string;
  /**
   * Formats the value.
   * @default en-US number format, for example "1,234"
   */
  formatValue?: (value: number) => string;
  /**
   * Formats the percentage (a number from 0 to 100).
   * @default percentage rounded to a whole number followed by %
   */
  formatPercentage?: (percentage: number) => string;
}

const formatWholePercent = (p: number): string => `${p.toFixed(0)}%`;

/** The item's value, optionally followed by its percentage of `maxValue`. */
export const LegendValue = ({
  className = "bk-text-sm bk-tabular-nums",
  showPercentage = false,
  percentageClassName = "bk-text-xs bk-tabular-nums",
  formatValue = intFmt,
  formatPercentage = formatWholePercent,
}: LegendValueProps): ReactElement => {
  const { item, percentage } = useLegendItem();
  return (
    <span className={cn("bk-legend-value", className)}>
      <span>{formatValue(item.value)}</span>
      {showPercentage && hasMax(item.maxValue) && <span className={percentageClassName}>{formatPercentage(percentage)}</span>}
    </span>
  );
};
LegendValue.displayName = "LegendValue";

/** Props of `LegendProgress`. */
export interface LegendProgressProps {
  /** Class names added to the progress track. */
  trackClassName?: string;
  /** Class names added to the filled bar. */
  indicatorClassName?: string;
  /** Height of the progress track. Defaults to a thin bar. */
  height?: string;
}

/** A progress bar filled to `value / maxValue` in the item's color. Renders nothing when the item has no `maxValue`. */
export const LegendProgress = ({ trackClassName = "", indicatorClassName = "", height = "bk-h-1-5" }: LegendProgressProps): ReactElement | null => {
  const { item } = useLegendItem();
  const indicatorStyle = useMemo<CSSProperties>(() => ({ backgroundColor: item.color }), [item.color]);
  if (!hasMax(item.maxValue)) {
    return null;
  }
  return (
    <Progress.Root max={item.maxValue} value={item.value}>
      <Progress.Track className={cn("bk-legend-track", height, trackClassName)}>
        <Progress.Indicator className={cn("bk-legend-indicator", indicatorClassName)} style={indicatorStyle} />
      </Progress.Track>
    </Progress.Root>
  );
};
LegendProgress.displayName = "LegendProgress";
