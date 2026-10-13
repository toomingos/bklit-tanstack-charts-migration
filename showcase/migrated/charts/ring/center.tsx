"use client";

// RingCenter: the NumberFlow stat inside the innermost ring (kit/polar/center-shell.tsx).
import type { ReactElement, ReactNode } from "react";
import { PolarCenter, defaultCenterStatFormat } from "../kit/polar/center-shell";
import type { CenterStatFormat } from "../kit/polar/center-shell";
import { useScheduledHoverIndex } from "../kit/polar/polar-hover";
import { useRingHoverCoordinator, useRingStable } from "./model";
import type { RingData } from "./model";

/** Values passed to the `children` render function of `RingCenter`. */
interface RingCenterRenderProps {
  /** Value of the hovered ring. */
  readonly value: number;
  /** Label of the hovered ring. */
  readonly label: string;
  /** Always `true` when the function is called. */
  readonly isHovered: boolean;
  /** The `RingData` item of the hovered ring. */
  readonly data: RingData;
}

/** Props for `RingCenter`. */
interface RingCenterProps {
  /**
   * Label shown under the total while no ring is hovered. A hovered ring shows its own label instead.
   * @default "Total"
   */
  readonly defaultLabel?: string;
  /**
   * Number format for the centre value, in `Intl.NumberFormat` terms (notation, currency, fraction digits and so on).
   * @default { maximumFractionDigits: 0, notation: "standard" }
   */
  readonly formatOptions?: CenterStatFormat;
  /**
   * Render function for custom centre content. It is called with `{ value, label, isHovered, data }` while a ring is hovered; when nothing is hovered the default total is shown.
   */
  readonly children?: (props: Readonly<RingCenterRenderProps>) => ReactNode;
  /** Extra class name for the centre container. */
  readonly className?: string;
  /** Class name for the value text. */
  readonly valueClassName?: string;
  /** Class name for the label text. */
  readonly labelClassName?: string;
  /** Text shown before the value, for example `"$"`. */
  readonly prefix?: string;
  /** Text shown after the value, for example `"%"`. */
  readonly suffix?: string;
}

/**
 * Shows the sum of all ring values in the middle of the rings, and the hovered ring's value and label while a ring is hovered or keyboard-focused. This is how rings report values instead of a tooltip.
 * Customise the text with `defaultLabel`, `prefix`, `suffix` and `formatOptions`, or take over the hovered content with a `children` render function.
 */
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
