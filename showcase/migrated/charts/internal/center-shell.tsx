// CenterShell: centered flex box hosting the default stat or hovered content in ring, pie, and gauge centers.
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { CenterStat } from "./center-stat-view";
import { defaultCenterStatFormat } from "./center-stat-format";
import type { CenterStatFormat } from "./center-stat-format";
import { centerStatContainerClassName, centerStatLabelClassName, centerStatValueClassName } from "./center-stat-classes";
import { useIntroFlowValue } from "./center-stat-hooks";

interface CenterShellRenderProps<Data> {
  readonly value: number;
  readonly label: string;
  readonly isHovered: boolean;
  readonly data: Data;
}

interface CenterShellProps<Data> {
  readonly value: number;
  readonly label: string;
  readonly centerSize: number;
  readonly hoveredData?: Data | null;
  readonly intro?: boolean;
  readonly formatOptions?: CenterStatFormat;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly className?: string;
  readonly valueClassName?: string;
  readonly labelClassName?: string;
  readonly children?: (props: Readonly<CenterShellRenderProps<Data>>) => ReactNode;
}

// Centered flex box. Hovered content lays out in a row.
// Default stat stacks value over label.
const centerShellStyle = (centerSize: number, isHovered: boolean): CSSProperties => {
  const style: CSSProperties = {
    alignItems: "center",
    display: "flex",
    height: centerSize,
    justifyContent: "center",
    width: centerSize,
  };
  if (!isHovered) {
    style.flexDirection = "column";
    style.textAlign = "center";
  }
  return style;
};

const CenterShell = <Data,>({
  value,
  label,
  centerSize,
  hoveredData,
  intro = false,
  formatOptions = defaultCenterStatFormat,
  prefix,
  suffix,
  className = centerStatContainerClassName,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  children,
}: Readonly<CenterShellProps<Data>>): ReactElement => {
  const flowValue = useIntroFlowValue(value, intro);

  if (children && hoveredData !== null && hoveredData !== undefined) {
    return (
      <div
        className={className}
        style={centerShellStyle(centerSize, true)}
      >
        {children({ data: hoveredData, isHovered: true, label, value })}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={centerShellStyle(centerSize, false)}
    >
      <CenterStat
        formatOptions={formatOptions}
        label={label}
        labelClassName={labelClassName}
        prefix={prefix}
        suffix={suffix}
        value={flowValue}
        valueClassName={valueClassName}
      />
    </div>
  );
}

CenterShell.displayName = "CenterShell";

export {
  CenterShell,
};
export type {
  CenterShellProps,
  CenterShellRenderProps,
};
