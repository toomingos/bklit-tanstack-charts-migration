// Funnel stage label overlay: HTML value/pct/label slots over the package surface.
// Graphic, hover and reveal motion live in the funnel mark module.
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { FADE_OPACITY } from './hover-motion';
import type { FunnelSegBox } from './funnel-geometry';

// Edge-block share of a spread label cell (value/label bands vs the center pct band).
const FUNNEL_SPREAD_EDGE_SIZE = "16%";
// Shared flex-alignment keywords reused across spread/grouped label styles.
const FLEX_START = "flex-start";
const FLEX_END = "flex-end";

type FunnelLabelOrientation = "vertical" | "horizontal";
type FunnelLabelAlign = "center" | "start" | "end";


// Grouped-label flex alignment lookup by labelAlign.
const FUNNEL_GROUPED_ALIGN_MAP = { center: "center", end: FLEX_END, start: FLEX_START } as const;

// Static spread-label cell styles (hoisted so every render reuses one identity).
const SPREAD_HORIZONTAL_VALUE_STYLE: CSSProperties = { alignItems: FLEX_END, display: "flex", height: FUNNEL_SPREAD_EDGE_SIZE, justifyContent: "center", paddingBottom: 4 };
const SPREAD_PCT_STYLE: CSSProperties = { alignItems: "center", display: "flex", flex: 1, justifyContent: "center" };
const SPREAD_HORIZONTAL_LABEL_STYLE: CSSProperties = { alignItems: FLEX_START, display: "flex", height: FUNNEL_SPREAD_EDGE_SIZE, justifyContent: "center", paddingTop: 4 };
const SPREAD_VERTICAL_VALUE_STYLE: CSSProperties = { alignItems: "center", display: "flex", justifyContent: FLEX_END, paddingRight: 8, width: FUNNEL_SPREAD_EDGE_SIZE };
const SPREAD_VERTICAL_LABEL_STYLE: CSSProperties = { alignItems: "center", display: "flex", justifyContent: FLEX_START, paddingLeft: 8, width: FUNNEL_SPREAD_EDGE_SIZE };

// Grouped-label container style as a function of its two computed inputs.
const buildGroupedLabelStyle = (groupedVertical: boolean, groupedAlign: FunnelLabelAlign): CSSProperties => ({
  alignItems: groupedVertical ? FUNNEL_GROUPED_ALIGN_MAP[groupedAlign] : FUNNEL_GROUPED_ALIGN_MAP.center,
  display: "flex",
  flexDirection: groupedVertical ? "column" : "row",
  gap: 6,
});

// Overlay frame style as a function of the segment box.
const buildSegmentOverlayStyle = (box: Readonly<FunnelSegBox>): CSSProperties => ({
  cursor: "pointer",
  height: box.height,
  left: box.left,
  position: "absolute",
  top: box.top,
  width: box.width,
  zIndex: 20,
});

// Overlay frame plus hover dim as a function of the segment box.
const buildStageLabelOverlayStyle = (box: Readonly<FunnelSegBox>, dimmed: boolean): CSSProperties => ({
  ...buildSegmentOverlayStyle(box),
  opacity: dimmed ? FADE_OPACITY : 1,
});

interface FunnelLabelSlots {
  readonly valueEl: ReactNode;
  readonly pctEl: ReactNode;
  readonly labelEl: ReactNode;
}

interface GroupedLabelOptions extends FunnelLabelSlots {
  readonly isHorizontal: boolean;
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly labelAlign: FunnelLabelAlign;
}

interface OuterLabelStyleOptions {
  readonly labelLayout: "spread" | "grouped";
  readonly isHorizontal: boolean;
  readonly labelAlign: FunnelLabelAlign;
}

const buildSpreadLabelContent = (isHorizontal: boolean, slots: Readonly<FunnelLabelSlots>): ReactElement => {
  const { valueEl, pctEl, labelEl } = slots;
  if (isHorizontal) {
    return (
      <>
        <div style={SPREAD_HORIZONTAL_VALUE_STYLE}>
          {valueEl}
        </div>
        <div style={SPREAD_PCT_STYLE}>{pctEl}</div>
        <div style={SPREAD_HORIZONTAL_LABEL_STYLE}>
          {labelEl}
        </div>
      </>
    );
  }
  return (
    <>
      <div style={SPREAD_VERTICAL_VALUE_STYLE}>
        {valueEl}
      </div>
      <div style={SPREAD_PCT_STYLE}>{pctEl}</div>
      <div style={SPREAD_VERTICAL_LABEL_STYLE}>
        {labelEl}
      </div>
    </>
  );
}

const buildGroupedLabelContent = (options: Readonly<GroupedLabelOptions>): ReactElement => {
  const { isHorizontal, labelOrientation, labelAlign, valueEl, pctEl, labelEl } = options;
  const groupedOrientation = labelOrientation ?? (isHorizontal ? "vertical" : "horizontal");
  const groupedVertical = groupedOrientation === "vertical";
  const groupedAlign = isHorizontal ? "center" : labelAlign;
  return (
    <div
      style={buildGroupedLabelStyle(groupedVertical, groupedAlign)}
    >
      {valueEl}
      {pctEl}
      {labelEl}
    </div>
  );
}

const buildOuterLabelStyle = (options: Readonly<OuterLabelStyleOptions>): CSSProperties => {
  const { labelLayout, isHorizontal, labelAlign } = options;
  if (labelLayout === "spread") {
    return {
      alignItems: "center",
      display: "flex",
      flexDirection: isHorizontal ? "column" : "row",
      inset: 0,
      position: "absolute",
    };
  }
  return {
    alignItems: "center",
    display: "flex",
    flexDirection: isHorizontal ? "column" : "row",
    inset: 0,
    justifyContent: { center: "center", end: FLEX_END, start: FLEX_START }[labelAlign],
    padding: isHorizontal ? "8% 0" : "0 8%",
    position: "absolute",
  };
}

interface FunnelLabelFrame {
  readonly labelContent: ReactNode;
  readonly outerLabelStyle: CSSProperties;
}

const computeFunnelLabelLayout = (params: {
  labelLayout: "spread" | "grouped";
  isHorizontal: boolean;
  labelOrientation?: FunnelLabelOrientation;
  labelAlign: FunnelLabelAlign;
  valueEl: ReactNode;
  pctEl: ReactNode;
  labelEl: ReactNode;
}): FunnelLabelFrame => {
  const { labelLayout, isHorizontal, labelOrientation, labelAlign, valueEl, pctEl, labelEl } = params;
  const slots: FunnelLabelSlots = { labelEl, pctEl, valueEl };
  const labelContent: ReactNode = labelLayout === "spread"
    ? buildSpreadLabelContent(isHorizontal, slots)
    : buildGroupedLabelContent({ isHorizontal, labelAlign, labelEl, labelOrientation, pctEl, valueEl });
  const outerLabelStyle = buildOuterLabelStyle({ isHorizontal, labelAlign, labelLayout });
  return { labelContent, outerLabelStyle };
}


interface FunnelGradientStop {
  readonly offset: string | number;
  readonly color: string;
}

interface FunnelStage {
  readonly label: string;
  readonly value: number;
  readonly displayValue?: string;
  readonly color?: string;
  /** Linear gradient stops for this segment (priority over color); halos use the first stop. */
  readonly gradient?: FunnelGradientStop[];
}

interface SegmentLabelOptions {
  readonly stage: FunnelStage;
  readonly pct: number;
  readonly showValues: boolean;
  readonly showPercentage: boolean;
  readonly showLabels: boolean;
  readonly formatValue: (stageValue: number) => string;
  readonly formatPercentage: (pctValue: number) => string;
  readonly labelLayout: "spread" | "grouped";
  readonly isHorizontal: boolean;
  readonly labelOrientation?: FunnelLabelOrientation;
  readonly labelAlign: FunnelLabelAlign;
}

const resolveSegmentLabels = (options: Readonly<SegmentLabelOptions>): FunnelLabelFrame => {
  const { stage, pct, showValues, showPercentage, showLabels, formatValue, formatPercentage, labelLayout, isHorizontal, labelOrientation, labelAlign } = options;
  const display = stage.displayValue ?? formatValue(stage.value);
  const valueEl = showValues && <span className="ts-bkm-funnel-value">{display}</span>;
  const pctEl = showPercentage && <span className="ts-bkm-funnel-pct">{formatPercentage(pct)}</span>;
  const labelEl = showLabels && <span className="ts-bkm-funnel-label">{stage.label}</span>;
  return computeFunnelLabelLayout({ isHorizontal, labelAlign, labelEl, labelLayout, labelOrientation, pctEl, valueEl });
};

interface FunnelStageLabelProps extends SegmentLabelOptions {
  readonly box: Readonly<FunnelSegBox>;
  readonly dimmed: boolean;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
}

// Keep cursor-pointer: the QA harness discovers hover cells via #chart-root .cursor-pointer.
const FunnelStageLabel = (props: Readonly<FunnelStageLabelProps>): ReactElement => {
  const { box, dimmed, onPointerEnter, onPointerLeave } = props;
  const { labelContent, outerLabelStyle } = resolveSegmentLabels(props);
  return (
    <div
      className="cursor-pointer"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={buildStageLabelOverlayStyle(box, dimmed)}
    >
      <div style={outerLabelStyle}>
        {labelContent}
      </div>
    </div>
  );
};

export { FunnelStageLabel };
export type { FunnelGradientStop, FunnelLabelAlign, FunnelLabelOrientation, FunnelStage, FunnelStageLabelProps };
