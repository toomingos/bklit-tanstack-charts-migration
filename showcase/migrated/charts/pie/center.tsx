"use client";

// PieCenter and the standalone PieCenterShell; the stat itself is kit/polar/center-shell.tsx.
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { PolarCenter, defaultCenterStatFormat, useFlowValue } from "../kit/polar/center-shell";
import type { CenterStatFormat } from "../kit/polar/center-shell";
import { useScheduledHoverIndex } from "../kit/polar/polar-hover";
import type { HoverSource } from "../kit/polar/polar-hover";
import { PieHoverCoordinatorContext, PieStableContext, defaultPieColors, usePieHoverCoordinator, usePieStable } from "./model";
import type { PieArcData, PieData, PieStableValue } from "./model";

/** Values passed to the `children` render function of `PieCenter`. */
interface PieCenterRenderProps {
  /** Value of the hovered slice. */
  readonly value: number;
  /** Label of the hovered slice. */
  readonly label: string;
  /** Always `true` when the function is called. */
  readonly isHovered: boolean;
  /** The `PieData` item of the hovered slice. */
  readonly data: PieData;
}

/** Props for `PieCenter`. */
interface PieCenterProps {
  /**
   * Label shown under the total while no slice is hovered. A hovered slice shows its own label instead.
   * @default "Total"
   */
  readonly defaultLabel?: string;
  /**
   * Number format for the centre value, in `Intl.NumberFormat` terms (notation, currency, fraction digits and so on).
   * @default { maximumFractionDigits: 0, notation: "standard" }
   */
  readonly formatOptions?: CenterStatFormat;
  /**
   * Render function for custom centre content. It is called with `{ value, label, isHovered, data }` while a slice is hovered; when nothing is hovered the default total is shown.
   */
  readonly children?: (props: Readonly<PieCenterRenderProps>) => ReactNode;
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
 * Shows the total in the middle of a donut, and the hovered slice's value and label while a slice is hovered or keyboard-focused.
 * This is how a pie reports values instead of a tooltip. Customise the text with `defaultLabel`, `prefix`, `suffix` and `formatOptions`, or take over the hovered content with a `children` render function.
 * Renders nothing unless the chart has a positive `innerRadius`.
 */
const PieCenter = ({ defaultLabel = "Total", formatOptions = defaultCenterStatFormat, children, className, valueClassName, labelClassName, prefix, suffix }: Readonly<PieCenterProps>): ReactElement | null => {
  const stable = usePieStable();
  const hoveredIndex = useScheduledHoverIndex(usePieHoverCoordinator());
  // Scrub mode never shows hover state in the center.
  const hoveredData = stable.geometryScrubbing || hoveredIndex === null ? undefined : stable.data[hoveredIndex];
  // No inner radius: nothing to size the box to.
  if (stable.innerRadius <= 0) { return null; }
  return (
    <PolarCenter<PieData> className={className} valueClassName={valueClassName} labelClassName={labelClassName} prefix={prefix} suffix={suffix} defaultLabel={defaultLabel} formatOptions={formatOptions} hoveredData={hoveredData} innerRadius={stable.innerRadius} totalValue={stable.totalValue}>
      {children}
    </PolarCenter>
  );
};
PieCenter.displayName = "PieCenter";

/** Props for `PieCenterShell`. It accepts the `PieCenterProps` except `children`. */
type PieCenterShellProps = Omit<PieCenterProps, "children"> & {
  /** The value to show, in place of the total of a pie. */
  readonly centerValue: number;
  /** Square reference size in pixels, matching the `size` of the pie the centre is modelled on. */
  readonly contextSize: number;
  /** Inner radius in pixels. Must be greater than 0 for the value to render. */
  readonly innerRadiusPx: number;
  /**
   * Roll the number in from 0 on mount. Later changes to `centerValue` always animate.
   * @default true
   */
  readonly animateEntrance?: boolean;
};

const INERT_SOURCE: HoverSource = { getHovered: () => null, setHovered: () => undefined, subscribe: () => () => undefined };
const SHELL_HOVER_OFFSET = 10;
const CONTENTS_STYLE: CSSProperties = { display: "contents" };

/**
 * Standalone centre stat with the same layout as `PieCenter`, without slices. Use it inside other charts, for example a gauge, that want a donut-style centre value. It is never hovered.
 */
const PieCenterShell = ({ centerValue, contextSize, innerRadiusPx, animateEntrance = true, defaultLabel, formatOptions, className, valueClassName, labelClassName, prefix, suffix }: Readonly<PieCenterShellProps>): ReactElement => {
  const flowTotal = useFlowValue(centerValue, animateEntrance);
  const value = useMemo((): PieStableValue => {
    const data: PieData[] = [{ label: "_pieCenterShell", value: Math.max(flowTotal, 0) }];
    const arcs: PieArcData[] = [{ data: data[0], endAngle: (3 * Math.PI) / 2, index: 0, padAngle: 0, startAngle: -Math.PI / 2, value: Math.max(flowTotal, 0) }];
    const center = contextSize / 2;
    const getColor = (index: number): string => defaultPieColors[index % defaultPieColors.length];
    return {
      animationKey: 0, arcs, center, containerRef: { current: null }, cornerRadius: 0, data, enterStaggerScale: 1,
      geometryScrubbing: false, getColor, getFill: getColor, hoverOffset: SHELL_HOVER_OFFSET, innerRadius: innerRadiusPx,
      outerRadius: center - SHELL_HOVER_OFFSET, isLoaded: true, padAngle: 0, scrubSlicePaths: null, size: contextSize, totalValue: flowTotal,
    };
  }, [flowTotal, contextSize, innerRadiusPx]);
  return (
    <PieStableContext.Provider value={value}>
      <PieHoverCoordinatorContext.Provider value={INERT_SOURCE}>
        <div data-bkm-chart="pie" data-slot="chart" style={CONTENTS_STYLE}><PieCenter className={className} defaultLabel={defaultLabel} formatOptions={formatOptions} labelClassName={labelClassName} prefix={prefix} suffix={suffix} valueClassName={valueClassName} /></div>
      </PieHoverCoordinatorContext.Provider>
    </PieStableContext.Provider>
  );
};
PieCenterShell.displayName = "PieCenterShell";

export { PieCenter, PieCenterShell };
export type { PieCenterProps, PieCenterShellProps };
