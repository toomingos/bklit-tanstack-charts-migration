import type { ReactNode } from "react";

interface PatternPresetOptions {
  color?: string;
  scale?: number;
  strokeWidth?: number;
  radius?: number;
  complement?: boolean;
  fill?: string;
  dotFill?: boolean;
  tileBackground?: string;
}

interface ChartBrushSelection {
  start: Date;
  end: Date;
}

type BrushSelection = ChartBrushSelection;

interface ChartBrushLayoutState {
  xDomain: [Date, Date] | undefined;
  xDomainSlotCount: number | undefined;
  brushSelection: ChartBrushSelection | null;
  onBrushSelectionChange: (selection: ChartBrushSelection | null) => void;
}

interface ChartBrushLayoutProps {
  data: Record<string, unknown>[];
  xDataKey?: string;
  xExtentMax?: Date;
  enabled: boolean;
  height: number;
  fitMainContent?: boolean;
  className?: string;
  children: (layout: ChartBrushLayoutState) => ReactNode;
  brushStrip?: (layout: ChartBrushLayoutState) => ReactNode;
}

type ChartBrushPatternPreset =
  | "none"
  | "diagonal"
  | "horizontal"
  | "vertical"
  | "cross"
  | "dots"
  | "circles"
  | "accent";

interface ChartBrushSelectionPattern extends PatternPresetOptions {
  preset: ChartBrushPatternPreset;
  color: string;
  opacity?: number;
}

interface ChartBrushSelectionOverlayProps {
  innerWidth: number;
  innerHeight: number;
  selectionX0: number;
  selectionX1: number;
  pattern?: ChartBrushSelectionPattern;
}

interface ChartBrushTrackOverlayStyle {
  blurPx?: number;
  fadeOuterEdges?: boolean;
}

interface ChartBrushTrackOverlayProps extends ChartBrushTrackOverlayStyle {
  innerWidth: number;
  innerHeight: number;
  selectionX0: number;
  selectionX1: number;
}

export type {
  BrushSelection,
  ChartBrushLayoutProps,
  ChartBrushLayoutState,
  ChartBrushPatternPreset,
  ChartBrushSelection,
  ChartBrushSelectionOverlayProps,
  ChartBrushSelectionPattern,
  ChartBrushTrackOverlayProps,
  ChartBrushTrackOverlayStyle,
};
