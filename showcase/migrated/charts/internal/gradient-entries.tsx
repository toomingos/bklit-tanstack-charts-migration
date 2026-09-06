// V3.4b parity: legacy `@visx/gradient` names over seam-compatible elements.
import type { LinearGradientProps, RadialGradientProps } from "@visx/gradient";
import type { ReactElement, ReactNode } from "react";

// Default stop placement and opacity mirror `@visx/gradient` defaults.
const DEFAULT_FROM_OFFSET = "0%";
const DEFAULT_TO_OFFSET = "100%";
const DEFAULT_STOP_OPACITY = 1;
const VERTICAL_DEFAULT_COORD = "0";
const VERTICAL_DEFAULT_END = "1";

type GradientCoord = string | number | undefined;

interface GradientStopProps {
  readonly children: ReactNode;
  readonly from: string | undefined;
  readonly fromOffset: GradientCoord;
  readonly fromOpacity: GradientCoord;
  readonly to: string | undefined;
  readonly toOffset: GradientCoord;
  readonly toOpacity: GradientCoord;
}

// Explicit children win; otherwise the from/to stops.
// Falsy children never occur; visx would fall back to the stops for those.
const hasGradientChildren = (children: ReactNode): boolean =>
  children !== undefined && children !== null && children !== false;

const GradientStops = ({
  children,
  from,
  fromOffset,
  fromOpacity,
  to,
  toOffset,
  toOpacity,
}: GradientStopProps): ReactNode => {
  if (hasGradientChildren(children)) {
    return children;
  }
  return (
    <>
      <stop
        offset={fromOffset ?? DEFAULT_FROM_OFFSET}
        stopColor={from}
        stopOpacity={fromOpacity ?? DEFAULT_STOP_OPACITY}
      />
      <stop
        offset={toOffset ?? DEFAULT_TO_OFFSET}
        stopColor={to}
        stopOpacity={toOpacity ?? DEFAULT_STOP_OPACITY}
      />
    </>
  );
};

const isGradientCoordSet = (coord: GradientCoord): boolean =>
  coord !== undefined && coord !== "" && coord !== 0;

const hasGradientRotation = (rotate: GradientCoord): boolean =>
  rotate !== undefined && rotate !== "" && rotate !== 0;

// Shared worker renders the bare `<linearGradient>` element, never a seam island.
// Chart children travel through `resources`; standalone sits in defs.
const LinearGradientImpl = ({
  children,
  id,
  from,
  to,
  x1: rawX1,
  y1: rawY1,
  x2: rawX2,
  y2: rawY2,
  fromOffset,
  fromOpacity,
  toOffset,
  toOpacity,
  rotate,
  transform,
  vertical = true,
  ...restProps
}: LinearGradientProps): ReactElement => {
  // Vertical default mirrors visx: no coords passed means a top-down gradient.
  const coordsMissing =
    !isGradientCoordSet(rawX1) &&
    !isGradientCoordSet(rawX2) &&
    !isGradientCoordSet(rawY1) &&
    !isGradientCoordSet(rawY2);
  const useVerticalDefaults = vertical && coordsMissing;
  return (
    <linearGradient
      id={id}
      x1={useVerticalDefaults ? VERTICAL_DEFAULT_COORD : rawX1}
      y1={useVerticalDefaults ? VERTICAL_DEFAULT_COORD : rawY1}
      x2={useVerticalDefaults ? VERTICAL_DEFAULT_COORD : rawX2}
      y2={useVerticalDefaults ? VERTICAL_DEFAULT_END : rawY2}
      gradientTransform={hasGradientRotation(rotate) ? `rotate(${rotate})` : transform}
      {...restProps}
    >
      <GradientStops
        from={from}
        fromOffset={fromOffset}
        fromOpacity={fromOpacity}
        to={to}
        toOffset={toOffset}
        toOpacity={toOpacity}
      >
        {children}
      </GradientStops>
    </linearGradient>
  );
};

// Shared worker for the radial form; consumer ids are scoped by the seam.
const RadialGradientImpl = ({
  children,
  id,
  from,
  to,
  fromOffset,
  fromOpacity,
  toOffset,
  toOpacity,
  rotate,
  transform,
  ...restProps
}: RadialGradientProps): ReactElement => (
  <radialGradient
    id={id}
    gradientTransform={hasGradientRotation(rotate) ? `rotate(${rotate})` : transform}
    {...restProps}
  >
    <GradientStops
      from={from}
      fromOffset={fromOffset}
      fromOpacity={fromOpacity}
      to={to}
      toOffset={toOffset}
      toOpacity={toOpacity}
    >
      {children}
    </GradientStops>
  </radialGradient>
);

const LinearGradient = (props: LinearGradientProps): ReactElement => <LinearGradientImpl {...props} />;

const RadialGradient = (props: RadialGradientProps): ReactElement => <RadialGradientImpl {...props} />;

// Preset palettes mirror the `@visx/gradient` preset defaults stop for stop.
const GradientDarkgreenGreen = ({
  from = "#184E86",
  to = "#57CA85",
  ...restProps
}: LinearGradientProps): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

const GradientLightgreenGreen = ({
  from = "#42E695",
  to = "#3BB2B8",
  ...restProps
}: LinearGradientProps): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

const GradientOrangeRed = ({
  from = "#FCE38A",
  to = "#F38181",
  ...restProps
}: LinearGradientProps): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

const GradientPinkBlue = ({
  from = "#F02FC2",
  to = "#6094EA",
  ...restProps
}: LinearGradientProps): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

const GradientPinkRed = ({
  from = "#F54EA2",
  to = "#FF7676",
  ...restProps
}: LinearGradientProps): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

const GradientPurpleOrange = ({
  from = "#7117EA",
  to = "#EA6060",
  ...restProps
}: LinearGradientProps): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

const GradientPurpleTeal = ({
  from = "#5B247A",
  to = "#1BCEDF",
  ...restProps
}: LinearGradientProps): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

const GradientSteelPurple = ({
  from = "#65799B",
  to = "#5E2563",
  ...restProps
}: LinearGradientProps): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

const GradientTealBlue = ({
  from = "#17EAD9",
  to = "#6078EA",
  ...restProps
}: LinearGradientProps): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

export {
  GradientDarkgreenGreen,
  GradientLightgreenGreen,
  GradientOrangeRed,
  GradientPinkBlue,
  GradientPinkRed,
  GradientPurpleOrange,
  GradientPurpleTeal,
  GradientSteelPurple,
  GradientTealBlue,
  LinearGradient,
  RadialGradient,
};
