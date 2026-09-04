import type { ReactElement, ReactNode } from "react";
import { CenterShell, centerStatContainerClassName, centerStatLabelClassName, centerStatValueClassName, defaultCenterStatFormat, useCenterStatHover } from './center-stat';
import type { CenterStatFormat } from './center-stat';
import { useRingStable, useRingHoverCoordinator } from './ring-context';
import type { RingData } from './ring-context';

// Inset subtracted from the inner diameter so the center stat box clears the ring edge.
const CENTER_STAT_BOX_INSET_PX = 16;

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

const RingCenter = ({
  defaultLabel = "Total",
  formatOptions = defaultCenterStatFormat,
  children,
  className,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  prefix,
  suffix,
}: Readonly<RingCenterProps>): ReactElement => {
  const stable = useRingStable();
  const coordinator = useRingHoverCoordinator();
  const hoveredIndex = useCenterStatHover(coordinator);

  const hoveredData = hoveredIndex !== null ? (stable.data[hoveredIndex] ?? undefined) : undefined;
  const displayValue = hoveredData ? hoveredData.value : stable.totalValue;
  const displayLabel = hoveredData ? hoveredData.label : defaultLabel;

  // No <=0 guard on centerSize by design; do not add one.
  const centerSize = stable.baseInnerRadius * 2 - CENTER_STAT_BOX_INSET_PX;
  const containerClassName = (className?.length ?? 0) > 0 ? `${centerStatContainerClassName} ${className}` : centerStatContainerClassName;

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

export { RingCenter };
export type { RingCenterRenderProps, RingCenterProps };
