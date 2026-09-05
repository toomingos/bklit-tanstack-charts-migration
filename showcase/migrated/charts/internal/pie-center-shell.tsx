"use client";

// PieCenter over a minimal pie context (no slices); two providers where legacy has one
// Because hover lives in PieHoverCoordinatorContext here (inert: never hovered).

import { useCallback, useMemo } from "react";
import type { ReactElement } from "react";
import { useIntroFlowValue } from "./center-stat";
import { PieHoverCoordinatorContext, PieStableContext } from './pie-center-context';
import { PieCenterShellCenter } from "./pie-center-shell-center";
import type { PieCenterProps, PieStableValue, PieData, PieArcData } from './pie-center';
import type { HoverSource } from "./hover-motion";
import { defaultPieColors } from './pie-default-colors';

const SHELL_HOVER_OFFSET = 10;

// Full-sweep arc end angle pairing with startAngle -π/2 (ported verbatim from legacy).
const PIE_SHELL_END_ANGLE_FACTOR = 3;
const PIE_SHELL_FULL_SWEEP_END_ANGLE = (PIE_SHELL_END_ANGLE_FACTOR * Math.PI) / 2;

// Frozen inert coordinator: identity never changes, so subscriptions never re-fire.
const inertUnsubscribe = (): void => {
  /* No-op: shell center is never hovered */
};

const INERT_HOVER_COORDINATOR: HoverSource = {
  getHovered: () => null,
  setHovered: () => {inertUnsubscribe();},
  subscribe: () => inertUnsubscribe,
};

type PieCenterShellProps = Omit<PieCenterProps, "children"> & {
  centerValue: number;
  contextSize: number;
  /** Inner radius in px — must be > 0 so `PieCenter` renders */
  innerRadiusPx: number;
// First paint uses 0 so NumberFlow runs an entrance transition.
  animateEntrance?: boolean;
};

// PieCenter with a minimal pie context, sans slices or full PieChart.
interface ShellPieModel {
  readonly arcs: readonly PieArcData[];
  readonly data: PieData[];
}

// Single datum collapses both legacy branches to one full-sweep arc.
const buildShellArcs = (data: readonly PieData[]): PieArcData[] => {
  if (data.length === 0) {return [];}
  const [d0] = data;
  return [
    {
      data: d0,
      endAngle: PIE_SHELL_FULL_SWEEP_END_ANGLE,
      index: 0,
      padAngle: 0,
      startAngle: -Math.PI / 2,
      value: d0.value > 0 ? d0.value : 0,
    },
  ];
};

// Single-datum pie model behind the shell.
// Placeholder datum carries the entrance-animated total, plus its full-sweep arc.
const useShellPieModel = (flowTotal: number): ShellPieModel => {
  const data: PieData[] = useMemo(
    () => [{ label: "_pieCenterShell", value: Math.max(flowTotal, 0) }],
    [flowTotal],
  );
  const arcs = useMemo((): PieArcData[] => buildShellArcs(data), [data]);
  return { arcs, data };
};

const resolveShellFill = (data: readonly PieData[], index: number, getColor: (colorIndex: number) => string): string => {
  const item = data.at(index);
  const fill = item?.fill ?? "";
  if (fill !== "") {return fill;}
  return getColor(index);
};

interface ShellContextBaseParams {
  readonly contextSize: number;
  readonly getColor: (colorIndex: number) => string;
  readonly getFill: (fillIndex: number) => string;
  readonly innerRadiusPx: number;
  readonly totalValue: number;
}

// Arrays stay mutable here because PieStableValue requires mutable arrays.
const buildShellContextBase = (params: Readonly<ShellContextBaseParams>): Omit<PieStableValue, "arcs" | "data"> => {
  const { contextSize, getColor, getFill, innerRadiusPx, totalValue } = params;
  const center = contextSize / 2;
  const outerRadius = center - SHELL_HOVER_OFFSET;
  return {
    center,
    cornerRadius: 0,
    enterStaggerScale: 1,
    geometryScrubbing: false,
    getColor,
    getFill,
    hoverOffset: SHELL_HOVER_OFFSET,
    innerRadius: innerRadiusPx,
    outerRadius,
    padAngle: 0,
    scrubSlicePaths: null,
    size: contextSize,
    totalValue,
  };
};

// PieCenter with a minimal pie context, sans slices or full PieChart.
const useShellContextValue = (flowTotal: number, contextSize: number, innerRadiusPx: number): PieStableValue => {
  const { arcs, data } = useShellPieModel(flowTotal);

  const getColor = useCallback((index: number): string => defaultPieColors[index % defaultPieColors.length]
  , []);

  const getFill = useCallback(
    (index: number): string => resolveShellFill(data, index, getColor),
    [data, getColor],
  );

  return useMemo(
    () => ({
      ...buildShellContextBase({ contextSize, getColor, getFill, innerRadiusPx, totalValue: flowTotal }),
      arcs,
      data,
    }),
    [
      data,
      arcs,
      contextSize,
      flowTotal,
      innerRadiusPx,
      getColor,
      getFill,
    ],
  );
};

// PieCenter with a minimal pie context, sans slices or full PieChart.
const PieCenterShell = ({
  centerValue,
  contextSize,
  innerRadiusPx,
  animateEntrance = true,
  className,
  defaultLabel,
  formatOptions,
  labelClassName,
  prefix,
  suffix,
  valueClassName,
}: Readonly<PieCenterShellProps>): ReactElement => {
// Entrance state machine centralized in center-stat's useIntroFlowValue; reused here.
  const flowTotal = useIntroFlowValue(centerValue, animateEntrance);
  const contextValue = useShellContextValue(flowTotal, contextSize, innerRadiusPx);

// Data-bkm-chart wrapper is load-bearing: center typography is scoped under it;
// Display:contents keeps it out of layout.
  const innerNode = (
    <PieHoverCoordinatorContext.Provider value={INERT_HOVER_COORDINATOR}>
      <PieCenterShellCenter
        className={className}
        defaultLabel={defaultLabel}
        formatOptions={formatOptions}
        labelClassName={labelClassName}
        prefix={prefix}
        suffix={suffix}
        valueClassName={valueClassName}
      />
    </PieHoverCoordinatorContext.Provider>
  );

  return (
    <PieStableContext.Provider value={contextValue}>
      {innerNode}
    </PieStableContext.Provider>
  );
}

PieCenterShell.displayName = "PieCenterShell";

export { PieCenterShell };
export type { PieCenterShellProps };
