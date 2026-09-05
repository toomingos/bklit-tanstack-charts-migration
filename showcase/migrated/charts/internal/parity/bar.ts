type PatternPresetId =
  | "none"
  | "diagonal"
  | "horizontal"
  | "vertical"
  | "cross"
  | "dots"
  | "circles"
  | "accent";

type BarAnimationType = "grow" | "fade";
type BarLineCap = "round" | "butt" | number;

interface BarDepthEntry {
  label: string;
  dataIndex: number;
  datum: Record<string, unknown>;
  isActive: boolean;
  isNegative: boolean;
  baselineY: number;
  bandX: number;
  bandWidth: number;
  topY: number;
  bottomY: number;
  barHeight: number;
  naturalHeight: number;
  topYTrim: number;
  depth: number;
  perspectiveRise: number;
  isRightOfCenter: boolean;
}

interface BarDepthSegment {
  value: number;
  color: string;
}

interface BarDepthBackProps {
  dataKey: string;
  color?: string;
  colorAccessor?: (datum: Record<string, unknown>, index: number) => string;
}

interface BarDepthFrontProps {
  dataKey: string;
}

interface BarPulseProps {
  dataKey: string;
  activeIndex?: number;
  pulsePaused?: boolean;
}

interface BarSquaresProps {
  dataKey: string;
  yAxisId?: string | number;
  fill?: string;
  stroke?: string;
  squareGap?: number;
  squareRadius?: number;
  squareFit?: boolean;
  useGradient?: boolean;
  gradientStops?: { offset: number; color: string }[];
  patternPreset?: PatternPresetId;
  animate?: boolean;
  fadedOpacity?: number;
  staggerDelay?: number;
  groupGap?: number;
}

interface BarColumnTrackProps {
  fill?: string;
  opacity?: number;
  squareGap?: number;
  squareRadius?: number;
  groupGap?: number;
  squareFit?: boolean;
  staggerDelay?: number;
}

export type {
  BarAnimationType,
  BarColumnTrackProps,
  BarDepthBackProps,
  BarDepthEntry,
  BarDepthFrontProps,
  BarDepthSegment,
  BarLineCap,
  BarPulseProps,
  BarSquaresProps,
};
