"use client";

// RingCenter: the NumberFlow stat inside the innermost ring (kit/polar/center-shell.tsx).
import type { ReactElement, ReactNode } from "react";
import { PolarCenter, defaultCenterStatFormat } from "../kit/polar/center-shell";
import type { CenterStatFormat } from "../kit/polar/center-shell";
import { useScheduledHoverIndex } from "../kit/polar/polar-hover";
import { useRingHoverCoordinator, useRingStable } from "./model";
import type { RingData } from "./model";

interface RingCenterRenderProps {
  readonly value: number;
  readonly label: string;
  readonly isHovered: boolean;
  readonly data: RingData;
}

interface RingCenterProps {
  readonly defaultLabel?: string;
  readonly formatOptions?: CenterStatFormat;
  readonly children?: (props: Readonly<RingCenterRenderProps>) => ReactNode;
  readonly className?: string;
  readonly valueClassName?: string;
  readonly labelClassName?: string;
  readonly prefix?: string;
  readonly suffix?: string;
}

const RingCenter = ({ defaultLabel = "Total", formatOptions = defaultCenterStatFormat, children, className, valueClassName, labelClassName, prefix, suffix }: Readonly<RingCenterProps>): ReactElement => {
  const stable = useRingStable();
  const hoveredIndex = useScheduledHoverIndex(useRingHoverCoordinator());
  const hoveredData = hoveredIndex === null ? undefined : stable.data[hoveredIndex];
  return (
    <PolarCenter<RingData> className={className} valueClassName={valueClassName} labelClassName={labelClassName} prefix={prefix} suffix={suffix} defaultLabel={defaultLabel} formatOptions={formatOptions} hoveredData={hoveredData} innerRadius={stable.baseInnerRadius} totalValue={stable.totalValue}>
      {children}
    </PolarCenter>
  );
};
RingCenter.displayName = "RingCenter";

export { RingCenter };
export type { RingCenterProps };
