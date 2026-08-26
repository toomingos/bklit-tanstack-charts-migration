// RingCenter — unchanged from D51. The ONLY React-rendered child in this
// architecture. Reads hover state via `useCenterStatHover` (useSyncExternalStore
// on the coordinator) and renders `<NumberFlow>` digit-roll via `CenterStat`.

import { type ReactNode } from "react";
import {
  type RingData,
  useRingStable,
  useRingHoverCoordinator,
} from "../ring-chart";
import {
  CenterShell,
  centerStatContainerClassName,
  centerStatLabelClassName,
  centerStatValueClassName,
  defaultCenterStatFormat,
  useCenterStatHover,
  type CenterStatFormat,
} from "./center-stat";

export interface RingCenterRenderProps {
  value: number;
  label: string;
  isHovered: boolean;
  data: RingData;
}

export interface RingCenterProps {
  defaultLabel?: string;
  formatOptions?: CenterStatFormat;
  children?: (props: RingCenterRenderProps) => ReactNode;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
  prefix?: string;
  suffix?: string;
}

export function RingCenter({
  defaultLabel = "Total",
  formatOptions = defaultCenterStatFormat,
  children,
  className,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  prefix,
  suffix,
}: RingCenterProps) {
  const stable = useRingStable();
  const coordinator = useRingHoverCoordinator();
  const hoveredIndex = useCenterStatHover(coordinator);

  const hoveredData = hoveredIndex === null ? null : (stable.data[hoveredIndex] ?? null);
  const displayValue = hoveredData ? hoveredData.value : stable.totalValue;
  const displayLabel = hoveredData ? hoveredData.label : defaultLabel;

  // Ring's own formula + no innerRadius<=0 guard (centralize row 7 "stays
  // per-part" — RingCenter has never had one; do not "fix").
  const centerSize = stable.baseInnerRadius * 2 - 16;
  const containerClassName = className ? `${centerStatContainerClassName} ${className}` : centerStatContainerClassName;

  return (
    <CenterShell<RingData>
      centerSize={centerSize}
      className={containerClassName}
      formatOptions={formatOptions}
      hoveredData={hoveredData}
      label={displayLabel}
      labelClassName={labelClassName}
      prefix={prefix}
      suffix={suffix}
      value={displayValue}
      valueClassName={valueClassName}
    >
      {children}
    </CenterShell>
  );
}

RingCenter.displayName = "RingCenter";

// Legacy parity: bklit `ring-center.tsx` ships `export default RingCenter;` (T-E2).
export default RingCenter;
