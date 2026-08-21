import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { PieEnterTransition } from "./pie-reveal";
import type { PieHoverCoordinator } from "./pie-hover-chrome";
import type { PieData, PieArcData } from "../pie-chart";
import {
  CenterStat,
  centerStatContainerClassName,
  centerStatLabelClassName,
  centerStatValueClassName,
  defaultCenterStatFormat,
  useCenterStatHover,
  type CenterStatFormat,
} from "./center-stat";

export interface PieStableValue {
  data: PieData[];
  arcs: PieArcData[];
  size: number;
  center: number;
  outerRadius: number;
  innerRadius: number;
  padAngle: number;
  cornerRadius: number;
  hoverOffset: number;
  enterTransition?: PieEnterTransition;
  enterStaggerScale: number;
  totalValue: number;
  getColor: (index: number) => string;
  getFill: (index: number) => string;
  geometryScrubbing: boolean;
  scrubSlicePaths: readonly string[] | null;
}

export const PieStableContext = createContext<PieStableValue | null>(null);
export const PieHoverCoordinatorContext = createContext<PieHoverCoordinator | null>(null);

export function usePieStable(): PieStableValue {
  const ctx = useContext(PieStableContext);
  if (!ctx) throw new Error("Pie components must be used within <PieChart>.");
  return ctx;
}

export function usePieHoverCoordinator(): PieHoverCoordinator {
  const ctx = useContext(PieHoverCoordinatorContext);
  if (!ctx) throw new Error("Pie components must be used within <PieChart>.");
  return ctx;
}

export type PieCenterFormat = CenterStatFormat;

export const defaultPieCenterFormat: CenterStatFormat = defaultCenterStatFormat;

export interface PieCenterRenderProps {
  value: number;
  label: string;
  isHovered: boolean;
  data: PieData;
}

export interface PieCenterProps {
  defaultLabel?: string;
  formatOptions?: PieCenterFormat;
  children?: (props: PieCenterRenderProps) => ReactNode;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
  prefix?: string;
  suffix?: string;
}

export function PieCenter({
  defaultLabel = "Total",
  formatOptions = defaultPieCenterFormat,
  children,
  className,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  prefix,
  suffix,
}: PieCenterProps) {
  const stable = usePieStable();
  const coordinator = usePieHoverCoordinator();
  const hoveredIndex = useCenterStatHover(coordinator as unknown as import("./center-stat").CenterStatHoverSource);

  const effectiveHoveredIndex = stable.geometryScrubbing ? null : hoveredIndex;
  const hoveredData = effectiveHoveredIndex === null ? null : (stable.data[effectiveHoveredIndex] ?? null);
  const displayValue = hoveredData ? hoveredData.value : stable.totalValue;
  const displayLabel = hoveredData ? hoveredData.label : defaultLabel;
  const centerSize = stable.innerRadius * 2 - 16;
  const containerClassName = className ? `${centerStatContainerClassName} ${className}` : centerStatContainerClassName;

  if (stable.innerRadius <= 0) return null;

  if (children && hoveredData) {
    return (
      <div className={containerClassName} style={{ width: centerSize, height: centerSize, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children({ value: displayValue, label: displayLabel, isHovered: effectiveHoveredIndex !== null, data: hoveredData })}
      </div>
    );
  }

  return (
    <div
      className={containerClassName}
      style={{
        width: centerSize, height: centerSize,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
      }}
    >
      <CenterStat
        formatOptions={formatOptions}
        label={displayLabel}
        labelClassName={labelClassName}
        prefix={prefix}
        suffix={suffix}
        value={displayValue}
        valueClassName={valueClassName}
      />
    </div>
  );
}

PieCenter.displayName = "PieCenter";
