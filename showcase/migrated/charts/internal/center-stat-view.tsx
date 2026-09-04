// CenterStat island view (bklit ChartStatFlow port): animated value over a label, with an icon slot.
import NumberFlow from "@number-flow/react";
import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useNumberFlowElementReady } from "./center-stat-ready";
import { defaultCenterStatFormat } from "./center-stat-format";
import type { CenterStatFormat } from "./center-stat-format";
import { centerStatIconClassName, centerStatLabelClassName, centerStatValueClassName } from "./center-stat-classes";

interface FormatStatValueParams {
  readonly formatOptions: Readonly<CenterStatFormat>;
  readonly prefix: string | undefined;
  readonly suffix: string | undefined;
  readonly value: number;
}

const formatStatValue = (params: Readonly<FormatStatValueParams>): string => {
  const { formatOptions, prefix, suffix, value } = params;
  const formatted = new Intl.NumberFormat(
    undefined,
    formatOptions,
  ).format(value);
  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

interface CenterStatProps {
  readonly value: number;
  readonly label: string;
  readonly formatOptions?: CenterStatFormat;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly valueClassName?: string;
  readonly labelClassName?: string;
  readonly icon?: Readonly<ReactNode>;
}

const CenterStat = ({
  value,
  label,
  formatOptions = defaultCenterStatFormat,
  prefix,
  suffix,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  icon,
}: Readonly<CenterStatProps>): ReactElement => {
  const numberFlowReady = useNumberFlowElementReady();
  const hasIcon = Boolean(icon);
  const staticValue = useMemo(
    () => formatStatValue({ formatOptions, prefix, suffix, value }),
    [value, formatOptions, prefix, suffix],
  );

  return (
    <>
      {hasIcon ? <div className={centerStatIconClassName}>{icon}</div> : undefined}
      <span className={valueClassName}>
        {numberFlowReady ? (
          <NumberFlow
            format={formatOptions}
            isolate
            prefix={prefix}
            suffix={suffix}
            value={value}
            willChange
          />
        ) : (
          staticValue
        )}
      </span>
      <span className={labelClassName}>{label}</span>
    </>
  );
}

CenterStat.displayName = "CenterStat";

export {
  CenterStat,
};
export type {
  CenterStatProps,
};
