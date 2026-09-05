// Bklit Gauge (arc + linear) on TanStack polar marks; linear notches bypass scales (no data domain).
// UniformWidth notches use custom quads: pie slices can't express the perpendicular inner edge.
import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ChartHost, HOST_INITIAL_WIDTH, adoptHostWidth } from "./internal/chart-host";
import { createMark } from '@tanstack/charts';
import type { ChartMark, SceneNode, DomChartDefinition, MarkScene } from '@tanstack/charts';
import { defineChart } from "@tanstack/charts/scene";
import { focusDisabled } from "@tanstack/charts/focus/disabled";
import { polar } from '@tanstack/charts/polar';
import type { PolarMark } from '@tanstack/charts/polar';
import { collectGaugeDefsElements, computeLinearNotches, DEFAULT_ACTIVE_FILL_OPACITY, DEFAULT_ACTIVE_GRADIENT, DEFAULT_INACTIVE_FILL_OPACITY, DEFAULT_LINEAR_GAUGE_HEIGHT, resolveGaugeActiveFill, resolveGaugeBgFill } from './internal/gauge-notch';
import type { ComputedNotch } from './internal/gauge-notch';
import type { GaugeEnterTransition } from './internal/gauge-reveal';
import {
  GAUGE_ACTIVE_GROUP_KEY,
  GAUGE_ACTIVE_GROUP_PREFIX,
  GAUGE_ACTIVE_SOLID_FILL,
  GAUGE_ARC_MARK_CLASS,
  GAUGE_ARC_TRACK_FILL,
  GAUGE_BG_GROUP_KEY,
  PERCENT_MULTIPLIER,
  buildArcRows,
  buildGaugeThemeGradients,
  buildLinearNotchNodes,
  buildTaperedArcMarks,
  buildUniformArcQuadMark,
  collectUniformArcRows,
  computeUniformArcGeometry,
  createArcNotchMotion,
  resolveArcAngles,
  resolveArcRadii,
  resolveGaugeNotchTiming,
} from './internal/gauge-geometry';
import type { GaugeArcRow, UniformArcRow } from './internal/gauge-geometry';
import { GaugeCenterOverlay, GaugeLabelLayout, GaugeLabelStat } from './internal/gauge-center';
import type { GaugeLabelAlign, GaugeLabelPlacement } from './internal/gauge-center';
import { defaultCenterStatFormat } from './internal/center-stat';
import type { CenterStatFormat } from './internal/center-stat';
import { chartMotionRenderer } from "./internal/motion-renderer";
import "./styles.css";

const ARC_ASPECT_WIDTH = 21;
const ARC_ASPECT_HEIGHT = 16;
const ARC_ASPECT_RATIO = ARC_ASPECT_WIDTH / ARC_ASPECT_HEIGHT;
const ARC_MAX_WIDTH = 560;
// Responsive-layout minimum-width fallbacks (px).
const GAUGE_ARC_MIN_WIDTH_PX = 300;
const GAUGE_LINEAR_MIN_WIDTH_PX = 200;
// Default prop fallbacks for gauge geometry (bklit defaults).
const GAUGE_DEFAULT_END_ANGLE = 405;
const GAUGE_DEFAULT_START_ANGLE = 135;
const GAUGE_DEFAULT_NOTCH_LENGTH_PERCENT = 100;
const GAUGE_DEFAULT_NOTCH_WIDTH_PERCENT = 80;
const GAUGE_DEFAULT_SPACING = 25;
const GAUGE_DEFAULT_TOTAL_NOTCHES = 40;
// Fraction of the gauge size used as top padding for the center overlay label.
const GAUGE_CENTER_TOP_PADDING_FRACTION = 0.08;
// Zero-size overlay svg for custom defs: absolutely positioned so it never affects layout.
const GAUGE_DEFS_SVG_STYLE = { position: "absolute" } as const;
// Responsive arc sizer: fixed aspect-ratio box centered at a capped width.
const GAUGE_ARC_SIZER_STYLE = { aspectRatio: String(ARC_ASPECT_RATIO), margin: "0 auto", maxWidth: ARC_MAX_WIDTH, width: "100%" } as const;

type GaugeOrientation = "arc" | "linear";

interface GaugeProps {
  readonly orientation?: GaugeOrientation;
  readonly value: number;
  readonly totalNotches?: number;
  readonly spacing?: number;
  readonly notchCornerRadius?: number;
  /** `true` = rectangular notches; `false` = tapered toward center / midline */
  readonly uniformWidth?: boolean;
  readonly startAngle?: number;
  readonly endAngle?: number;
  readonly useGradient?: boolean;
  readonly activeGradient?: readonly [string, string];
  readonly inactiveGradient?: readonly [string, string];
  readonly centerValue?: number;
  readonly defaultLabel?: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly formatOptions?: CenterStatFormat;
  readonly labelPlacement?: GaugeLabelPlacement;
  readonly labelAlign?: GaugeLabelAlign;
  readonly inactiveFill?: string;
  readonly activeFill?: string;
  readonly inactiveFillOpacity?: number;
  readonly activeFillOpacity?: number;
  /** Custom gradient/pattern defs (children-as-defs escape hatch, both orientations). */
  readonly children?: ReactNode;
  readonly className?: string;
  readonly width?: number;
  readonly height?: number;
  readonly minWidth?: number;
  readonly notchLengthPercent?: number;
  readonly notchWidthPercent?: number;
  readonly linearHeight?: number;
  readonly enterTransition?: GaugeEnterTransition;
  readonly enterStaggerScale?: number;
  readonly geometryScrubbing?: boolean;
  /** Extra vs bklit: style, forwarded to the outer wrapper div. */
  readonly style?: Readonly<CSSProperties>;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

interface GaugeFillStateInput {
  readonly useGradient?: boolean;
  readonly activeGradient?: readonly [string, string];
  readonly inactiveGradient?: readonly [string, string];
  readonly inactiveFill?: string;
  readonly activeFill?: string;
  readonly inactiveFillOpacity?: number;
  readonly activeFillOpacity?: number;
  readonly children?: ReactNode;
  readonly totalNotches?: number;
}

interface GaugeFillState {
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly defsChildren: readonly Readonly<ReactElement>[];
  readonly hasCustomActive: boolean;
  readonly hasCustomInactive: boolean;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly resolvedActiveFillOpacity: number;
  readonly resolvedInactiveFillOpacity: number;
  readonly themeActiveGradientId: string;
  readonly totalNotches: number;
  readonly useThemePaletteGradient: boolean;
}

interface GaugeGradientInputs {
  readonly activeGradient?: readonly [string, string];
  readonly inactiveGradient?: readonly [string, string];
  readonly useGradient: boolean;
}

interface ResolvedGaugeGradients {
  readonly activeGrad0: string;
  readonly activeGrad1: string;
  readonly inactiveGrad0: string;
  readonly inactiveGrad1: string;
  readonly useThemePaletteGradient: boolean;
}

const resolveGaugeGradients = (inputs: Readonly<GaugeGradientInputs>): ResolvedGaugeGradients => {
  const { activeGradient, inactiveGradient, useGradient } = inputs;
  const activeGrad0 = activeGradient?.[0] ?? DEFAULT_ACTIVE_GRADIENT[0];
  const activeGrad1 = activeGradient?.[1] ?? DEFAULT_ACTIVE_GRADIENT[1];
  return {
    activeGrad0,
    activeGrad1,
    inactiveGrad0: inactiveGradient?.[0] ?? activeGrad0,
    inactiveGrad1: inactiveGradient?.[1] ?? activeGrad1,
    useThemePaletteGradient: useGradient && activeGradient === undefined,
  };
};

const useGaugeFillState = (props: Readonly<GaugeFillStateInput>): GaugeFillState => {
  const {
    useGradient = false,
    activeGradient,
    inactiveGradient,
    inactiveFill,
    activeFill,
    inactiveFillOpacity,
    activeFillOpacity,
    children,
    totalNotches = 40,
  } = props;

  const themeActiveGradientId = `gauge-theme-active-${useId().replaceAll(':', "")}`;
  const defsChildren = useMemo(() => collectGaugeDefsElements(children), [children]);

  const hasCustomInactive = inactiveFill !== undefined && inactiveFill.length > 0;
  const hasCustomActive = activeFill !== undefined && activeFill.length > 0;

  const { activeGrad0, activeGrad1, inactiveGrad0, inactiveGrad1, useThemePaletteGradient } = resolveGaugeGradients({ activeGradient, inactiveGradient, useGradient });

  return {
    activeGrad0,
    activeGrad1,
    defsChildren,
    hasCustomActive,
    hasCustomInactive,
    inactiveGrad0,
    inactiveGrad1,
    resolvedActiveFillOpacity: activeFillOpacity ?? DEFAULT_ACTIVE_FILL_OPACITY,
    resolvedInactiveFillOpacity: inactiveFillOpacity ?? DEFAULT_INACTIVE_FILL_OPACITY,
    themeActiveGradientId,
    totalNotches,
    useThemePaletteGradient,
  };
}

// Both orientations forward the same nine fill props; collecting them here keeps the components short.
const collectGaugeFillStateInput = (props: Readonly<GaugeFillStateInput>): GaugeFillStateInput => {
  const { activeFill, activeFillOpacity, activeGradient, children, inactiveFill, inactiveFillOpacity, inactiveGradient, totalNotches, useGradient } = props;
  return { activeFill, activeFillOpacity, activeGradient, children, inactiveFill, inactiveFillOpacity, inactiveGradient, totalNotches, useGradient };
};

interface ComputeArcRowsOptions {
  readonly activeFill?: string;
  readonly endAngle: number;
  readonly fillState: Readonly<GaugeFillState>;
  readonly inactiveFill?: string;
  readonly notchLengthPercent: number;
  readonly spacing: number;
  readonly startAngle: number;
  readonly totalNotches: number;
  readonly useGradient: boolean;
  readonly value: number;
  readonly width: number;
  readonly height: number;
}

interface ArcRowsResult {
  readonly activeRows: readonly GaugeArcRow[];
  readonly bgRows: readonly GaugeArcRow[];
  readonly innerRadiusRatio: number;
  readonly outerRadiusRatio: number;
}

const computeArcRows = (options: Readonly<ComputeArcRowsOptions>): ArcRowsResult | undefined => {
  const { activeFill, endAngle, fillState, inactiveFill, notchLengthPercent, spacing, startAngle, totalNotches, useGradient, value, width, height } = options;
  if (width <= 0 || height <= 0) {return undefined;}
  const radii = resolveArcRadii(notchLengthPercent);
  const angles = resolveArcAngles({ endAngle, spacing, startAngle, totalNotches });
  const activeNotches = Math.round((value / PERCENT_MULTIPLIER) * totalNotches);
  const denom = totalNotches > 1 ? totalNotches - 1 : 1;
  const rows = buildArcRows({
    activeFill,
    activeGrad0: fillState.activeGrad0,
    activeGrad1: fillState.activeGrad1,
    activeNotches,
    angles,
    denom,
    hasCustomActive: fillState.hasCustomActive,
    hasCustomInactive: fillState.hasCustomInactive,
    inactiveFill,
    inactiveGrad0: fillState.inactiveGrad0,
    inactiveGrad1: fillState.inactiveGrad1,
    themeActiveGradientId: fillState.themeActiveGradientId,
    totalNotches,
    useGradient,
    useThemePaletteGradient: fillState.useThemePaletteGradient,
  });
  return { activeRows: rows.activeRows, bgRows: rows.bgRows, innerRadiusRatio: radii.innerRadiusRatio, outerRadiusRatio: radii.outerRadiusRatio };
};

interface GaugeArcLayoutOptions {
  readonly heightProp?: number;
  readonly liveWidth: number;
  readonly minWidth?: number;
  readonly widthProp?: number;
}

interface GaugeArcLayout {
  readonly fixedSize: boolean;
  readonly height: number;
  readonly resolvedMinWidth: number;
  readonly size: number;
  readonly width: number;
}

const resolveGaugeArcLayout = (options: Readonly<GaugeArcLayoutOptions>): GaugeArcLayout => {
  const { heightProp, liveWidth, minWidth, widthProp } = options;
  const width = widthProp ?? liveWidth;
  // Host-owned sizing: the sizer locks aspect 21/16, so height follows width until props fix it.
  const height = heightProp ?? (width * ARC_ASPECT_HEIGHT) / ARC_ASPECT_WIDTH;
  return {
    fixedSize: widthProp !== undefined && heightProp !== undefined,
    height,
    resolvedMinWidth: minWidth ?? GAUGE_ARC_MIN_WIDTH_PX,
    size: Math.min(width, height),
    width,
  };
};

const useArcRows = (
  props: Readonly<GaugeArcProps>,
  fillState: Readonly<GaugeFillState>,
  layout: Readonly<GaugeArcLayout>,
): ArcRowsResult | undefined => {
  const { activeFill, endAngle, inactiveFill, notchLengthPercent, spacing, startAngle, totalNotches, useGradient, value } = props;
  const { height, width } = layout;
  return useMemo(() => computeArcRows({
    activeFill,
    endAngle: endAngle ?? GAUGE_DEFAULT_END_ANGLE,
    fillState,
    height,
    inactiveFill,
    notchLengthPercent: notchLengthPercent ?? GAUGE_DEFAULT_NOTCH_LENGTH_PERCENT,
    spacing: spacing ?? GAUGE_DEFAULT_SPACING,
    startAngle: startAngle ?? GAUGE_DEFAULT_START_ANGLE,
    totalNotches: totalNotches ?? GAUGE_DEFAULT_TOTAL_NOTCHES,
    useGradient: useGradient ?? false,
    value,
    width,
  }), [
    width,
    height,
    totalNotches,
    spacing,
    startAngle,
    endAngle,
    notchLengthPercent,
    value,
    useGradient,
    fillState,
    inactiveFill,
    activeFill,
  ]);
};

const computeUniformArcRows = (
  props: Readonly<GaugeArcProps>,
  fillState: Readonly<GaugeFillState>,
  layout: Readonly<GaugeArcLayout>,
): {
  readonly active: readonly UniformArcRow[];
  readonly bg: readonly UniformArcRow[];
  readonly notchLength: number;
} | undefined => {
  const geometry = computeUniformArcGeometry({
    activeGrad0: fillState.activeGrad0,
    activeGrad1: fillState.activeGrad1,
    endAngle: props.endAngle ?? GAUGE_DEFAULT_END_ANGLE,
    height: layout.height,
    notchLengthPercent: props.notchLengthPercent ?? GAUGE_DEFAULT_NOTCH_LENGTH_PERCENT,
    spacing: props.spacing ?? GAUGE_DEFAULT_SPACING,
    startAngle: props.startAngle ?? GAUGE_DEFAULT_START_ANGLE,
    totalNotches: props.totalNotches ?? GAUGE_DEFAULT_TOTAL_NOTCHES,
    useGradient: props.useGradient ?? false,
    useThemePaletteGradient: fillState.useThemePaletteGradient,
    value: props.value,
    width: layout.width,
  });
  if (geometry === undefined) {return undefined;}
  const rows = collectUniformArcRows({
    activeFill: props.activeFill,
    geometry,
    hasCustomActive: fillState.hasCustomActive,
    hasCustomInactive: fillState.hasCustomInactive,
    inactiveFill: props.inactiveFill,
    inactiveGrad0: fillState.inactiveGrad0,
    inactiveGrad1: fillState.inactiveGrad1,
    themeActiveGradientId: fillState.themeActiveGradientId,
    totalNotches: props.totalNotches ?? GAUGE_DEFAULT_TOTAL_NOTCHES,
    useGradient: props.useGradient ?? false,
    useThemePaletteGradient: fillState.useThemePaletteGradient,
  });
  return { active: rows.active, bg: rows.bg, notchLength: geometry.notchLength };
};

const useUniformArcRows = (
  props: Readonly<GaugeArcProps>,
  fillState: Readonly<GaugeFillState>,
  layout: Readonly<GaugeArcLayout>,
): {
  readonly active: readonly UniformArcRow[];
  readonly bg: readonly UniformArcRow[];
  readonly notchLength: number;
} | undefined =>
  useMemo(() => computeUniformArcRows(props, fillState, layout), [
    props,
    fillState,
    layout,
  ]);

const defineArcChart = (
  marks: readonly PolarMark<GaugeArcRow | UniformArcRow, number, number, never, never>[],
  themeActiveGradientId: string,
  useThemePaletteGradient: boolean,
): DomChartDefinition =>
  defineChart({
    focus: focusDisabled,
    gradients: buildGaugeThemeGradients(themeActiveGradientId, useThemePaletteGradient),
    guides: false,
    marks: [
      polar({
        marks,
        radiusRatio: 1,
        scales: { angle: null, radius: null },
      }),
    ],
    scales: { x: null, y: null },
  });

interface BuildArcDefinitionOptions {
  readonly activeFillOpacity: number;
  readonly arcRows: Readonly<ArcRowsResult> | undefined;
  readonly enterStaggerScale: number;
  readonly enterTransition: GaugeEnterTransition | undefined;
  readonly inactiveFillOpacity: number;
  readonly notchCornerRadius: number;
  readonly themeActiveGradientId: string;
  readonly uniformRows: Readonly<{
    readonly active: readonly UniformArcRow[];
    readonly bg: readonly UniformArcRow[];
    readonly notchLength: number;
  }> | undefined;
  readonly uniformWidth: boolean;
  readonly useThemePaletteGradient: boolean;
}

const buildArcDefinition = (options: Readonly<BuildArcDefinitionOptions>): DomChartDefinition | undefined => {
  const { activeFillOpacity, arcRows, enterStaggerScale, enterTransition, inactiveFillOpacity, notchCornerRadius, themeActiveGradientId, uniformRows, uniformWidth, useThemePaletteGradient } = options;
  if (!arcRows || (uniformWidth && !uniformRows)) {return undefined;}
  const bgNotchMotion = createArcNotchMotion({ enterStaggerScale, enterTransition, isActiveGroup: false });
  const activeNotchMotion = createArcNotchMotion({ enterStaggerScale, enterTransition, isActiveGroup: true });
  if (uniformWidth && uniformRows) {
    const quadMark = buildUniformArcQuadMark({
      active: uniformRows.active,
      activeFillOpacity,
      bg: uniformRows.bg,
      enterStaggerScale,
      enterTransition,
      inactiveFillOpacity,
      notchCornerRadius,
      notchLength: uniformRows.notchLength,
    });
    return defineArcChart([quadMark], themeActiveGradientId, useThemePaletteGradient);
  }
  const marks = buildTaperedArcMarks({
    activeFillOpacity,
    activeNotchMotion,
    activeRows: arcRows.activeRows,
    bgNotchMotion,
    bgRows: arcRows.bgRows,
    inactiveFillOpacity,
    innerRadiusRatio: arcRows.innerRadiusRatio,
    notchCornerRadius,
    outerRadiusRatio: arcRows.outerRadiusRatio,
  });
  return defineArcChart(marks, themeActiveGradientId, useThemePaletteGradient);
};

interface UseArcDefinitionOptions {
  readonly arcRows: Readonly<ArcRowsResult> | undefined;
  readonly enterStaggerScale: number;
  readonly enterTransition: GaugeEnterTransition | undefined;
  readonly fillState: Readonly<GaugeFillState>;
  readonly notchCornerRadius: number;
  readonly uniformRows: Readonly<{
    readonly active: readonly UniformArcRow[];
    readonly bg: readonly UniformArcRow[];
    readonly notchLength: number;
  }> | undefined;
  readonly uniformWidth: boolean;
}

const useArcDefinition = (options: Readonly<UseArcDefinitionOptions>): DomChartDefinition | undefined => {
  const { arcRows, enterStaggerScale, enterTransition, fillState, notchCornerRadius, uniformRows, uniformWidth } = options;
  return useMemo(() => buildArcDefinition({
    activeFillOpacity: fillState.resolvedActiveFillOpacity,
    arcRows,
    enterStaggerScale,
    enterTransition,
    inactiveFillOpacity: fillState.resolvedInactiveFillOpacity,
    notchCornerRadius,
    themeActiveGradientId: fillState.themeActiveGradientId,
    uniformRows,
    uniformWidth,
    useThemePaletteGradient: fillState.useThemePaletteGradient,
  }), [
    arcRows,
    uniformWidth,
    uniformRows,
    notchCornerRadius,
    fillState.resolvedInactiveFillOpacity,
    fillState.resolvedActiveFillOpacity,
    fillState.useThemePaletteGradient,
    fillState.themeActiveGradientId,
    enterTransition,
    enterStaggerScale,
  ]);
};

interface RenderGaugeArcInnerOptions {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly centerOverlayStyle: CSSProperties;
  readonly centerValue?: number;
  readonly defaultLabel: string;
  readonly definition: DomChartDefinition | undefined;
  readonly fillState: Readonly<GaugeFillState>;
  readonly formatOptions: CenterStatFormat;
  readonly innerWrapStyle: CSSProperties;
  readonly layout: Readonly<GaugeArcLayout>;
  readonly onRender: (context: { readonly scene?: { readonly width?: number } }) => void;
  readonly prefix?: string;
  readonly suffix?: string;
}

const renderGaugeArcInner = (options: Readonly<RenderGaugeArcInnerOptions>): ReactNode => {
  const { ariaDescription, ariaLabel = "Gauge chart", centerOverlayStyle, centerValue, defaultLabel, definition, fillState, formatOptions, innerWrapStyle, layout, onRender, prefix, suffix } = options;
  return definition && layout.size > 0 ? (
    <div style={innerWrapStyle}>
      <ChartHost
        ariaLabel={ariaLabel}
        ariaDescription={ariaDescription}
        aspectRatio={ARC_ASPECT_WIDTH / ARC_ASPECT_HEIGHT}
        initialWidth={layout.fixedSize ? layout.width : HOST_INITIAL_WIDTH}
        definition={definition}
        height={layout.height}
        renderer={chartMotionRenderer()}
        width={layout.fixedSize ? layout.width : undefined}
        onRender={onRender}
      />
      {fillState.defsChildren.length > 0 ? (
        // Overlay svg mounts after the chart: url(#id) resolves document-wide; chart svg stays first in DOM.
        <svg
          width={0}
          height={0}
          style={GAUGE_DEFS_SVG_STYLE}
          aria-hidden="true"
          focusable="false"
        >
          <defs>{fillState.defsChildren}</defs>
        </svg>
      ) : undefined}
      {centerValue === undefined ? undefined : (
        <div
          style={centerOverlayStyle}
        >
          <GaugeCenterOverlay
            centerValue={centerValue}
            contextSize={layout.size}
            defaultLabel={defaultLabel}
            formatOptions={formatOptions}
            prefix={prefix}
            suffix={suffix}
          />
        </div>
      )}
    </div>
  ) : undefined;
};

interface GaugeArcStyles {
  readonly centerOverlayStyle: CSSProperties;
  readonly innerWrapStyle: CSSProperties;
  readonly rootStyle: CSSProperties;
}

// Wrapper styles for the arc gauge, memoized so the host divs keep a stable style identity.
const useGaugeArcStyles = (style: Readonly<CSSProperties> | undefined, layout: Readonly<GaugeArcLayout>): GaugeArcStyles => {
  const { fixedSize, height, resolvedMinWidth, size, width } = layout;
  const innerWrapStyle = useMemo<CSSProperties>(() => ({ height, position: "relative", width }), [height, width]);
  const centerOverlayStyle = useMemo<CSSProperties>(() => ({
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    inset: 0,
    justifyContent: "center",
    paddingTop: size * GAUGE_CENTER_TOP_PADDING_FRACTION,
    pointerEvents: "none",
    position: "absolute",
  }), [size]);
  const rootStyle = useMemo<CSSProperties>(() => (fixedSize
    ? { display: "inline-flex", maxWidth: "100%", position: "relative", ...style }
    : { maxWidth: "100%", minWidth: resolvedMinWidth, position: "relative", width: "100%", ...style }), [fixedSize, resolvedMinWidth, style]);
  return { centerOverlayStyle, innerWrapStyle, rootStyle };
};

type GaugeArcProps = Omit<GaugeProps, "orientation" | "labelPlacement" | "labelAlign" | "notchWidthPercent" | "linearHeight" | "geometryScrubbing">;

interface GaugeArcSizeProps {
  readonly height?: number;
  readonly minWidth?: number;
  readonly width?: number;
}

// Merges the host-owned width with the size props into the arc layout options.
const collectGaugeArcLayoutOptions = (props: Readonly<GaugeArcSizeProps>, liveWidth: number): GaugeArcLayoutOptions => ({
  heightProp: props.height,
  liveWidth,
  minWidth: props.minWidth,
  widthProp: props.width,
});

interface GaugeArcGeometryProps {
  readonly enterStaggerScale?: number;
  readonly enterTransition?: GaugeEnterTransition | undefined;
  readonly notchCornerRadius?: number;
  readonly uniformWidth?: boolean;
}

interface GaugeArcDefinitionInput {
  readonly arcRows: Readonly<ArcRowsResult> | undefined;
  readonly fillState: Readonly<GaugeFillState>;
  readonly props: Readonly<GaugeArcGeometryProps>;
  readonly uniformRows: Readonly<{
    readonly active: readonly UniformArcRow[];
    readonly bg: readonly UniformArcRow[];
    readonly notchLength: number;
  }> | undefined;
}

// Defaulted definition inputs: the stagger, transition, and geometry fallbacks live in one place.
const resolveArcDefinitionOptions = (options: Readonly<GaugeArcDefinitionInput>): UseArcDefinitionOptions => {
  const { arcRows, fillState, props, uniformRows } = options;
  return {
    arcRows,
    enterStaggerScale: props.enterStaggerScale ?? 1,
    enterTransition: props.enterTransition,
    fillState,
    notchCornerRadius: props.notchCornerRadius ?? 0,
    uniformRows,
    uniformWidth: props.uniformWidth ?? false,
  };
};

const GaugeArc = (props: Readonly<GaugeArcProps>): ReactElement => {
  const fillState = useGaugeFillState(collectGaugeFillStateInput(props));

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const handleHostRender = useCallback((context: { readonly scene?: { readonly width?: number } }): void => {
    adoptHostWidth(setLiveWidth, context.scene?.width);
  }, []);

  const layout = resolveGaugeArcLayout(collectGaugeArcLayoutOptions(props, liveWidth));
  const arcRows = useArcRows(props, fillState, layout);
  const uniformRows = useUniformArcRows(props, fillState, layout);
  const definition = useArcDefinition(resolveArcDefinitionOptions({ arcRows, fillState, props, uniformRows }));
  const arcStyles = useGaugeArcStyles(props.style, layout);
  // Root JSX lives in this component rather than in a plain render helper.
  // The sizer ref attaches directly, so it never crosses a function during render.
  const arcInner = renderGaugeArcInner({
    ariaDescription: props.ariaDescription,
    ariaLabel: props.ariaLabel,
    centerOverlayStyle: arcStyles.centerOverlayStyle,
    centerValue: props.centerValue,
    defaultLabel: props.defaultLabel ?? "Total",
    definition,
    fillState,
    formatOptions: props.formatOptions ?? defaultCenterStatFormat,
    innerWrapStyle: arcStyles.innerWrapStyle,
    layout,
    onRender: handleHostRender,
    prefix: props.prefix,
    suffix: props.suffix,
  });
  return layout.fixedSize ? (
    <div className={props.className} data-bkm-chart="gauge" style={arcStyles.rootStyle}>
      {arcInner}
    </div>
  ) : (
    <div
      className={props.className}
      data-bkm-chart="gauge"
      style={arcStyles.rootStyle}
    >
      <div
        ref={containerRef}
        style={GAUGE_ARC_SIZER_STYLE}
      >
        {arcInner}
      </div>
    </div>
  );
}

interface LinearGaugeLayoutOptions {
  readonly heightProp?: number;
  readonly linearHeight?: number;
  readonly liveWidth: number;
  readonly minWidth?: number;
  readonly widthProp?: number;
}

interface LinearGaugeLayout {
  readonly fixedWidth: boolean;
  readonly height: number;
  readonly resolvedMinWidth: number;
  readonly width: number;
}

const resolveLinearGaugeLayout = (options: Readonly<LinearGaugeLayoutOptions>): LinearGaugeLayout => {
  const { heightProp, linearHeight, liveWidth, minWidth, widthProp } = options;
  const resolvedLinearHeight = linearHeight ?? DEFAULT_LINEAR_GAUGE_HEIGHT;
  return {
    fixedWidth: widthProp !== undefined,
    height: heightProp ?? resolvedLinearHeight,
    resolvedMinWidth: minWidth ?? GAUGE_LINEAR_MIN_WIDTH_PX,
    width: widthProp ?? liveWidth,
  };
};

const useLinearGaugeGeometry = (
  props: Readonly<GaugeLinearProps>,
  fillState: Readonly<GaugeFillState>,
  layout: Readonly<LinearGaugeLayout>,
): ReturnType<typeof computeLinearNotches> | undefined =>
  useMemo(() => {
    if (layout.width <= 0 || layout.height <= 0) {return undefined;}
    return computeLinearNotches({
      activeGrad0: fillState.activeGrad0,
      activeGrad1: fillState.activeGrad1,
      height: layout.height,
      notchLengthPercent: props.notchLengthPercent ?? GAUGE_DEFAULT_NOTCH_LENGTH_PERCENT,
      notchWidthPercent: props.notchWidthPercent ?? GAUGE_DEFAULT_NOTCH_WIDTH_PERCENT,
      spacing: props.spacing ?? GAUGE_DEFAULT_SPACING,
      totalNotches: props.totalNotches ?? GAUGE_DEFAULT_TOTAL_NOTCHES,
      uniformWidth: props.uniformWidth ?? true,
      useGradient: props.useGradient ?? false,
      useThemePaletteGradient: fillState.useThemePaletteGradient,
      value: props.value,
      width: layout.width,
    });
  }, [
    layout.width,
    layout.height,
    props.totalNotches,
    props.spacing,
    props.uniformWidth,
    props.notchLengthPercent,
    props.notchWidthPercent,
    props.value,
    props.useGradient,
    fillState.useThemePaletteGradient,
    fillState.activeGrad0,
    fillState.activeGrad1,
  ]);

interface LinearGaugeFills {
  readonly resolveActiveFill: (notch: ComputedNotch) => string;
  readonly resolveBgFill: (notchIndex: number) => string;
}

const useLinearGaugeFills = (
  props: Readonly<GaugeLinearProps>,
  fillState: Readonly<GaugeFillState>,
): LinearGaugeFills => {
  const resolveBgFill = useCallback(
    (notchIndex: number) =>
      resolveGaugeBgFill({
        arcTrackFill: GAUGE_ARC_TRACK_FILL,
        hasCustomInactive: fillState.hasCustomInactive,
        inactiveFill: props.inactiveFill,
        inactiveGrad0: fillState.inactiveGrad0,
        inactiveGrad1: fillState.inactiveGrad1,
        linearMode: true,
        linearTrackFill: "var(--chart-background)",
        notchIndex,
        totalNotches: props.totalNotches ?? GAUGE_DEFAULT_TOTAL_NOTCHES,
        useGradient: props.useGradient ?? false,
        useThemePaletteGradient: fillState.useThemePaletteGradient,
      }),
    [
      props.totalNotches,
      fillState.hasCustomInactive,
      props.inactiveFill,
      fillState.useThemePaletteGradient,
      props.useGradient,
      fillState.inactiveGrad0,
      fillState.inactiveGrad1,
    ],
  );
  const resolveActiveFill = useCallback(
    (notch: ComputedNotch) =>
      resolveGaugeActiveFill({
        activeFill: props.activeFill,
        activeFillSolid: GAUGE_ACTIVE_SOLID_FILL,
        hasCustomActive: fillState.hasCustomActive,
        notch,
        themeActiveGradientId: fillState.themeActiveGradientId,
        useGradient: props.useGradient ?? false,
        useThemePaletteGradient: fillState.useThemePaletteGradient,
      }),
    [
      fillState.hasCustomActive,
      props.activeFill,
      fillState.useThemePaletteGradient,
      fillState.themeActiveGradientId,
      props.useGradient,
    ],
  );
  return { resolveActiveFill, resolveBgFill };
};

interface LinearGaugeNodesOptions {
  readonly activeFillOpacity: number;
  readonly activeNotches: readonly ComputedNotch[];
  readonly cornerVerticalDepth: number;
  readonly inactiveFillOpacity: number;
  readonly notchCornerRadius: number;
  readonly notches: readonly ComputedNotch[];
  readonly resolveActiveFill: (notch: ComputedNotch) => string;
  readonly resolveBgFillByNotch: (notch: ComputedNotch) => string;
}

const renderLinearGaugeNodes = (options: Readonly<LinearGaugeNodesOptions>): SceneNode[] => {
  const { activeFillOpacity, activeNotches, cornerVerticalDepth, inactiveFillOpacity, notchCornerRadius, notches, resolveActiveFill, resolveBgFillByNotch } = options;
  const nodes: SceneNode[] = [];
  if (notches.length > 0) {
    nodes.push({
      ariaHidden: true,
      children: buildLinearNotchNodes({
        cornerVerticalDepth,
        fillOpacity: inactiveFillOpacity,
        keyPrefix: GAUGE_BG_GROUP_KEY,
        notchCornerRadius,
        notches,
        resolveFill: resolveBgFillByNotch,
      }),
      className: GAUGE_ARC_MARK_CLASS,
      key: GAUGE_BG_GROUP_KEY,
      kind: "group",
    });
  }
  if (activeNotches.length > 0) {
    nodes.push({
      ariaHidden: true,
      children: buildLinearNotchNodes({
        cornerVerticalDepth,
        fillOpacity: activeFillOpacity,
        keyPrefix: GAUGE_ACTIVE_GROUP_KEY,
        notchCornerRadius,
        notches: activeNotches,
        resolveFill: resolveActiveFill,
      }),
      className: GAUGE_ARC_MARK_CLASS,
      key: GAUGE_ACTIVE_GROUP_KEY,
      kind: "group",
    });
  }
  return nodes;
};

interface BuildLinearQuadMarkOptions {
  readonly activeFillOpacity: number;
  readonly activeNotches: readonly ComputedNotch[];
  readonly cornerVerticalDepth: number;
  readonly enterStaggerScale: number;
  readonly enterTransition: GaugeEnterTransition | undefined;
  readonly geometryScrubbing: boolean;
  readonly inactiveFillOpacity: number;
  readonly notchCornerRadius: number;
  readonly notches: readonly ComputedNotch[];
  readonly resolveActiveFill: (notch: ComputedNotch) => string;
  readonly resolveBgFillByNotch: (notch: ComputedNotch) => string;
}

const buildLinearQuadMark = (options: Readonly<BuildLinearQuadMarkOptions>): ChartMark<never, never, never> => {
  const { activeFillOpacity, activeNotches, cornerVerticalDepth, enterStaggerScale, enterTransition, geometryScrubbing, inactiveFillOpacity, notchCornerRadius, notches, resolveActiveFill, resolveBgFillByNotch } = options;
  return createMark<never, never, never>(
    () => ({
      channels: {},
      id: "gauge-linear",
      render: (): MarkScene<never, never, never> => ({
        nodes: renderLinearGaugeNodes({
          activeFillOpacity, activeNotches, cornerVerticalDepth, inactiveFillOpacity, notchCornerRadius, notches, resolveActiveFill, resolveBgFillByNotch,
        }),
      }),
    }),
    (ctx) => {
      if (geometryScrubbing) {return false;}
      const sep = ctx.key.indexOf(":");
      if (sep === -1) {return false;}
      return resolveGaugeNotchTiming({
        enterStaggerScale,
        enterTransition,
        idx: Number(ctx.key.slice(sep + 1)),
        isActiveGroup: ctx.key.startsWith(GAUGE_ACTIVE_GROUP_PREFIX),
        phase: ctx.phase,
      });
    },
  );
};

const buildLinearGaugeChart = (
  quadMark: ChartMark<never, never, never>,
  themeActiveGradientId: string,
  useThemePaletteGradient: boolean,
): DomChartDefinition =>
  defineChart({
    focus: focusDisabled,
    gradients: buildGaugeThemeGradients(themeActiveGradientId, useThemePaletteGradient),
    guides: false,
    margin: { bottom: 0, left: 0, right: 0, top: 0 },
    marks: [quadMark],
    scales: { x: null, y: null },
  });

interface UseLinearGaugeDefinitionOptions {
  readonly fills: Readonly<LinearGaugeFills>;
  readonly fillState: Readonly<GaugeFillState>;
  readonly geometry: { readonly notches: readonly ComputedNotch[]; readonly notchDepth: number; readonly cornerVerticalDepth: number; readonly centerY: number } | undefined;
  readonly props: Readonly<GaugeLinearProps>;
}

const useLinearGaugeDefinition = (options: Readonly<UseLinearGaugeDefinitionOptions>): DomChartDefinition | undefined => {
  const { fills, fillState, geometry, props } = options;
  const { resolveActiveFill, resolveBgFill } = fills;
  const { resolvedActiveFillOpacity, resolvedInactiveFillOpacity, themeActiveGradientId, useThemePaletteGradient } = fillState;
  const { enterStaggerScale, enterTransition, geometryScrubbing, notchCornerRadius } = props;
  return useMemo(() => {
    if (!geometry) {return undefined;}
    const { cornerVerticalDepth, notches } = geometry;
    const activeNotches = notches.filter((notch) => notch.isActive);
    const resolveBgFillByNotch = (notch: ComputedNotch): string => resolveBgFill(notch.index);
    const quadMark = buildLinearQuadMark({
      activeFillOpacity: resolvedActiveFillOpacity,
      activeNotches,
      cornerVerticalDepth,
      enterStaggerScale: enterStaggerScale ?? 1,
      enterTransition,
      geometryScrubbing: geometryScrubbing ?? false,
      inactiveFillOpacity: resolvedInactiveFillOpacity,
      notchCornerRadius: notchCornerRadius ?? 0,
      notches,
      resolveActiveFill,
      resolveBgFillByNotch,
    });
    return buildLinearGaugeChart(quadMark, themeActiveGradientId, useThemePaletteGradient);
  }, [
    geometry,
    notchCornerRadius,
    resolveBgFill,
    resolveActiveFill,
    resolvedInactiveFillOpacity,
    resolvedActiveFillOpacity,
    useThemePaletteGradient,
    themeActiveGradientId,
    geometryScrubbing,
    enterTransition,
    enterStaggerScale,
  ]);
};

interface LinearGaugeStyles {
  readonly chartWrapStyle: CSSProperties;
  readonly containerStyle: CSSProperties;
  readonly innerWidthStyle: CSSProperties;
  readonly label: ReactNode;
  readonly rootStyle: CSSProperties;
  readonly trackStyle: CSSProperties;
}

// Wrapper styles and label element for the linear gauge.
// Host divs and the label layout keep stable prop identities across renders.
const useLinearGaugeStyles = (props: Readonly<GaugeLinearProps>, layout: Readonly<LinearGaugeLayout>): LinearGaugeStyles => {
  const { centerValue, defaultLabel, formatOptions, labelAlign, prefix, style, suffix, width: propWidth } = props;
  const { fixedWidth, height, resolvedMinWidth, width } = layout;
  const chartWrapStyle = useMemo<CSSProperties>(() => ({ height, position: "relative", width }), [height, width]);
  const trackStyle = useMemo<CSSProperties>(() => ({ height, position: "relative", width: "100%" }), [height]);
  const label = useMemo(() => (centerValue === undefined ? undefined : (
    <GaugeLabelStat
      align={labelAlign ?? "start"}
      centerValue={centerValue}
      defaultLabel={defaultLabel ?? "Total"}
      formatOptions={formatOptions ?? defaultCenterStatFormat}
      prefix={prefix}
      suffix={suffix}
    />
  )), [centerValue, defaultLabel, formatOptions, labelAlign, prefix, suffix]);
  const rootStyle = useMemo<CSSProperties>(() => (fixedWidth
    ? { maxWidth: "100%", position: "relative", width: "100%", ...style }
    : { maxWidth: "100%", minWidth: 0, position: "relative", width: "100%", ...style }), [fixedWidth, style]);
  const innerWidthStyle = useMemo<CSSProperties>(() => ({ width: propWidth }), [propWidth]);
  const containerStyle = useMemo<CSSProperties>(() => ({ minWidth: resolvedMinWidth, width: "100%" }), [resolvedMinWidth]);
  return { chartWrapStyle, containerStyle, innerWidthStyle, label, rootStyle, trackStyle };
};

interface RenderLinearGaugeBodyOptions {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly chartWrapStyle: CSSProperties;
  readonly definition: DomChartDefinition | undefined;
  readonly defsChildren: readonly Readonly<ReactElement>[];
  readonly fixedWidth: boolean;
  readonly height: number;
  readonly label: ReactNode;
  readonly labelAlign: GaugeLabelAlign;
  readonly labelPlacement: GaugeLabelPlacement;
  readonly onRender: (context: { readonly scene?: { readonly width?: number } }) => void;
  readonly trackStyle: CSSProperties;
  readonly width: number;
}

const renderLinearGaugeBody = (options: Readonly<RenderLinearGaugeBodyOptions>): ReactElement => {
  const { ariaDescription, ariaLabel = "Gauge chart", chartWrapStyle, definition, defsChildren, fixedWidth, height, label, labelAlign, labelPlacement, onRender, trackStyle, width } = options;
  const svg =
    definition && width > 0 ? (
      <div style={chartWrapStyle}>
        <ChartHost
          ariaLabel={ariaLabel}
          ariaDescription={ariaDescription}
          definition={definition}
          height={height}
          initialWidth={fixedWidth ? width : HOST_INITIAL_WIDTH}
          renderer={chartMotionRenderer()}
          width={fixedWidth ? width : undefined}
          onRender={onRender}
        />
        {defsChildren.length > 0 ? (
          <svg width={0} height={0} style={GAUGE_DEFS_SVG_STYLE} aria-hidden="true" focusable="false">
            <defs>{defsChildren}</defs>
          </svg>
        ) : undefined}
      </div>
    ) : undefined;
  const track = (
    <div style={trackStyle}>{svg}</div>
  );
  return (
    <GaugeLabelLayout align={labelAlign} label={label} placement={labelPlacement}>
      {track}
    </GaugeLabelLayout>
  );
};

type GaugeLinearProps = Omit<GaugeProps, "orientation" | "startAngle" | "endAngle">;

const GaugeLinear = (props: Readonly<GaugeLinearProps>): ReactElement => {
  const fillState = useGaugeFillState(collectGaugeFillStateInput(props));

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Host-owned sizing: initial width renders on the server; onRender adopts the measured width.
  const [liveWidth, setLiveWidth] = useState(HOST_INITIAL_WIDTH);
  const handleHostRender = useCallback((context: { readonly scene?: { readonly width?: number } }): void => {
    adoptHostWidth(setLiveWidth, context.scene?.width);
  }, []);

  const layout = resolveLinearGaugeLayout({
    heightProp: props.height,
    linearHeight: props.linearHeight,
    liveWidth,
    minWidth: props.minWidth,
    widthProp: props.width,
  });
  const geometry = useLinearGaugeGeometry(props, fillState, layout);
  const fills = useLinearGaugeFills(props, fillState);
  const definition = useLinearGaugeDefinition({ fillState, fills, geometry, props });
  const linearStyles = useLinearGaugeStyles(props, layout);

  // Root JSX lives in this component rather than in a plain render helper.
  // The sizer ref attaches directly, so it never crosses a function during render.
  const linearBody = renderLinearGaugeBody({
    ariaDescription: props.ariaDescription,
    ariaLabel: props.ariaLabel,
    chartWrapStyle: linearStyles.chartWrapStyle,
    definition,
    defsChildren: fillState.defsChildren,
    fixedWidth: layout.fixedWidth,
    height: layout.height,
    label: linearStyles.label,
    labelAlign: props.labelAlign ?? "start",
    labelPlacement: props.labelPlacement ?? "top",
    onRender: handleHostRender,
    trackStyle: linearStyles.trackStyle,
    width: layout.width,
  });
  return layout.fixedWidth ? (
    <div className={props.className} data-bkm-chart="gauge" style={linearStyles.rootStyle}>
      <div style={linearStyles.innerWidthStyle}>{linearBody}</div>
    </div>
  ) : (
    <div
      className={props.className}
      data-bkm-chart="gauge"
      style={linearStyles.rootStyle}
    >
      <div ref={containerRef} style={linearStyles.containerStyle}>
        {layout.width > 0 ? linearBody : undefined}
      </div>
    </div>
  );
}

const Gauge = ({ orientation = "arc", ...rest }: Readonly<GaugeProps>): ReactElement => {
  if (orientation === "linear") {
    return <GaugeLinear {...rest} />;
  }
  return <GaugeArc {...rest} />;
};

Gauge.displayName = "Gauge";

export type { GaugeOrientation, GaugeProps };
export { Gauge };
export type { GaugeEnterTransition } from "./internal/enter-transition";
export type { GaugeLabelAlign, GaugeLabelPlacement } from "./internal/gauge-center";
