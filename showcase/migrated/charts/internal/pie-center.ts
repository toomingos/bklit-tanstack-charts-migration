import type { ReactNode } from 'react';
import type { PieEnterTransition } from "./enter-transition";
import type { PieData, PieArcData } from "../pie-chart";
import type { CenterStatFormat } from './center-stat';

interface PieStableValue {
  readonly data: PieData[];
  readonly arcs: PieArcData[];
  readonly size: number;
  readonly center: number;
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly padAngle: number;
  readonly cornerRadius: number;
  readonly hoverOffset: number;
  readonly enterTransition?: PieEnterTransition;
  readonly enterStaggerScale: number;
  readonly totalValue: number;
  readonly getColor: (index: number) => string;
  readonly getFill: (index: number) => string;
  readonly geometryScrubbing: boolean;
  readonly scrubSlicePaths: readonly string[] | null;
}

interface PieCenterContent {
  readonly hoveredData: PieData | undefined;
  readonly displayValue: number;
  readonly displayLabel: string;
}

interface PieCenterContentSource {
  readonly data: readonly PieData[];
  readonly totalValue: number;
  readonly geometryScrubbing: boolean;
}

type PieCenterFormat = CenterStatFormat;

interface PieCenterRenderProps {
  readonly value: number;
  readonly label: string;
  readonly isHovered: boolean;
  readonly data: PieData;
}

interface PieCenterProps {
  readonly defaultLabel?: string;
  readonly formatOptions?: PieCenterFormat;
  readonly children?: (props: Readonly<PieCenterRenderProps>) => ReactNode;
  readonly className?: string;
  readonly valueClassName?: string;
  readonly labelClassName?: string;
  readonly prefix?: string;
  readonly suffix?: string;
}

export type {
  PieStableValue,
  PieCenterContent,
  PieCenterContentSource,
  PieCenterFormat,
  PieCenterRenderProps,
  PieCenterProps,
};
