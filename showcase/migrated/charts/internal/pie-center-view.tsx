// PieCenter view: center-stat overlay for PieChart hover/total display.
// Split from pie-center so each module exports a uniform shape.
import type { ReactElement } from "react";
import { CenterShell, centerStatLabelClassName, centerStatValueClassName, useCenterStatHover } from "./center-stat";
import { CENTER_STAT_BOX_INSET_PX, defaultPieCenterFormat, resolvePieCenterClassName, resolvePieCenterContent } from "./pie-center-state";
import type { PieCenterProps } from "./pie-center";
import { usePieHoverCoordinator, usePieStable } from "./pie-center-hooks";

const PieCenter = ({
  defaultLabel = "Total",
  formatOptions = defaultPieCenterFormat,
  children,
  className,
  valueClassName = centerStatValueClassName,
  labelClassName = centerStatLabelClassName,
  prefix,
  suffix,
}: Readonly<PieCenterProps>): ReactElement | undefined => {
  const stable = usePieStable();
  const coordinator = usePieHoverCoordinator();
  const hoveredIndex = useCenterStatHover(coordinator);

  const { hoveredData, displayValue, displayLabel } = resolvePieCenterContent(stable, hoveredIndex, defaultLabel);
  const centerSize = stable.innerRadius * 2 - CENTER_STAT_BOX_INSET_PX;
  const containerClassName = resolvePieCenterClassName(className);

  // Per-part guard kept local: no inner radius ⇒ nothing to size the box to.
  if (stable.innerRadius <= 0) {return undefined;}

  return (
    <CenterShell
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

PieCenter.displayName = "PieCenter";

export { PieCenter };
export default PieCenter;
