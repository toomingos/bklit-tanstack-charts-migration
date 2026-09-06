"use client";

// Scoped center node behind PieCenterShell: data-scoped wrapper plus the center stat.
// Extracted from pie-center-shell so provider nesting stays within the depth budget.

import type { ReactElement } from "react";
import { PieCenter } from "./pie-center-view";
import type { PieCenterProps } from "./pie-center";

// Static wrapper style: keeps the data-bkm-chart scoping div out of layout.
const SHELL_WRAPPER_STYLE = { display: "contents" } as const;

type PieCenterShellCenterProps = Omit<PieCenterProps, "children">;

// Scoped center stat: typography hooks under data-bkm-chart, layout-free wrapper.
const PieCenterShellCenter = ({
  className,
  defaultLabel,
  formatOptions,
  labelClassName,
  prefix,
  suffix,
  valueClassName,
}: Readonly<PieCenterShellCenterProps>): ReactElement => (
  <div data-bkm-chart="pie" data-slot="chart" style={SHELL_WRAPPER_STYLE}>
    <PieCenter
      className={className}
      defaultLabel={defaultLabel}
      formatOptions={formatOptions}
      labelClassName={labelClassName}
      prefix={prefix}
      suffix={suffix}
      valueClassName={valueClassName}
    />
  </div>
);

PieCenterShellCenter.displayName = "PieCenterShellCenter";

export { PieCenterShellCenter };
export type { PieCenterShellCenterProps };
