"use client";

// PieCenter and the standalone PieCenterShell; the stat itself is kit/polar/center-shell.tsx.
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { PolarCenter, defaultCenterStatFormat, useFlowValue } from "../kit/polar/center-shell";
import type { CenterStatFormat } from "../kit/polar/center-shell";
import { useHoverIndex } from "../kit/polar/polar-hover";
import type { HoverSource } from "../kit/polar/polar-hover";
import { PieHoverCoordinatorContext, PieStableContext, defaultPieColors, usePieHoverCoordinator, usePieStable } from "./model";
import type { PieArcData, PieData, PieStableValue } from "./model";

interface PieCenterRenderProps {
  readonly value: number;
  readonly label: string;
  readonly isHovered: boolean;
  readonly data: PieData;
}

interface PieCenterProps {
  readonly defaultLabel?: string;
  readonly formatOptions?: CenterStatFormat;
  readonly children?: (props: Readonly<PieCenterRenderProps>) => ReactNode;
  readonly className?: string;
  readonly valueClassName?: string;
  readonly labelClassName?: string;
  readonly prefix?: string;
  readonly suffix?: string;
}

const PieCenter = ({ defaultLabel = "Total", formatOptions = defaultCenterStatFormat, children, className, valueClassName, labelClassName, prefix, suffix }: Readonly<PieCenterProps>): ReactElement | null => {
  const stable = usePieStable();
  const hoveredIndex = useHoverIndex(usePieHoverCoordinator());
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

type PieCenterShellProps = Omit<PieCenterProps, "children"> & {
  readonly centerValue: number;
  readonly contextSize: number;
  /** Inner radius in px; must be > 0 so the stat renders. */
  readonly innerRadiusPx: number;
  readonly animateEntrance?: boolean;
};

const INERT_SOURCE: HoverSource = { getHovered: () => null, setHovered: () => undefined, subscribe: () => () => undefined };
const SHELL_HOVER_OFFSET = 10;
const CONTENTS_STYLE: CSSProperties = { display: "contents" };

/** Standalone center (e.g. inside a gauge): PieCenter over a one-slice synthetic context, never hovered. */
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
