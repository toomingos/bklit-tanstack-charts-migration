import type { ReactNode, SVGProps } from "react";

// ── visx gradient reimplementations (dependency-free) ──────────────────────
// visx gradient (v4.0.1-alpha.0) LinearGradient/RadialGradient + the 9 fixed-
// stop presets, ported verbatim (esm/gradients/*.js). Same wrapper shape as
// ./pattern-preset (named fn component delegating to a local impl,
// .displayName set). CRITICAL: pie-chart.tsx:131-132 and
// gauge-notch.ts:63-64 classify consumer-supplied children by
// `displayName === "LinearGradient"` / `"RadialGradient"` to decide whether
// to hoist a child into <defs> — every displayName below is preserved
// byte-for-byte.

type LinearGradientOwnProps = {
  /** Unique id for the gradient. Should be unique across all page elements. */
  id: string;
  /** Start color of gradient. */
  from?: string;
  /** End color of gradient. */
  to?: string;
  /** The x coordinate of the starting point along which the linear gradient is drawn. */
  x1?: string | number;
  /** The x coordinate of the ending point along which the linear gradient is drawn. */
  x2?: string | number;
  /** The y coordinate of the starting point along which the linear gradient is drawn. */
  y1?: string | number;
  /** The y coordinate of the ending point along which the linear gradient is drawn. */
  y2?: string | number;
  /** Number or percent defining the where the 'from' starting color is placed along the gradient. */
  fromOffset?: string | number;
  /** Opacity of the 'from' starting color. */
  fromOpacity?: string | number;
  /** Number or percent defining the where the 'to' ending color is placed along the gradient. */
  toOffset?: string | number;
  /** Opacity of the 'to' ending color. */
  toOpacity?: string | number;
  /** Rotation to apply to gradient. */
  rotate?: string | number;
  /** Transform to apply to linearGradient, overrides rotate. */
  transform?: string;
  /** Override of linearGradient children. */
  children?: ReactNode;
  /** (When no x or y values are passed), will orient the gradient vertically instead of horizontally. */
  vertical?: boolean;
};

type LinearGradientProps = LinearGradientOwnProps &
  Omit<SVGProps<SVGLinearGradientElement>, keyof LinearGradientOwnProps>;

function LinearGradientImpl({
  children,
  id,
  from,
  to,
  x1: _x1,
  y1: _y1,
  x2: _x2,
  y2: _y2,
  fromOffset = "0%",
  fromOpacity = 1,
  toOffset = "100%",
  toOpacity = 1,
  rotate,
  transform,
  vertical = true,
  ...restProps
}: LinearGradientProps) {
  let x1 = _x1;
  let x2 = _x2;
  let y1 = _y1;
  let y2 = _y2;
  if (vertical && !x1 && !x2 && !y1 && !y2) {
    x1 = "0";
    x2 = "0";
    y1 = "0";
    y2 = "1";
  }
  return (
    <defs>
      <linearGradient
        id={id}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        gradientTransform={rotate ? `rotate(${rotate})` : transform}
        {...restProps}
      >
        {!!children && children}
        {!children && (
          <stop offset={fromOffset} stopColor={from} stopOpacity={fromOpacity} />
        )}
        {!children && (
          <stop offset={toOffset} stopColor={to} stopOpacity={toOpacity} />
        )}
      </linearGradient>
    </defs>
  );
}

type RadialGradientProps = Pick<
  LinearGradientProps,
  | "id"
  | "from"
  | "to"
  | "fromOffset"
  | "fromOpacity"
  | "toOffset"
  | "toOpacity"
  | "rotate"
  | "transform"
  | "children"
> &
  SVGProps<SVGRadialGradientElement>;

function RadialGradientImpl({
  children,
  id,
  from,
  to,
  fromOffset = "0%",
  fromOpacity = 1,
  toOffset = "100%",
  toOpacity = 1,
  rotate,
  transform,
  ...restProps
}: RadialGradientProps) {
  return (
    <defs>
      <radialGradient
        id={id}
        gradientTransform={rotate ? `rotate(${rotate})` : transform}
        {...restProps}
      >
        {!!children && children}
        {!children && (
          <stop offset={fromOffset} stopColor={from} stopOpacity={fromOpacity} />
        )}
        {!children && (
          <stop offset={toOffset} stopColor={to} stopOpacity={toOpacity} />
        )}
      </radialGradient>
    </defs>
  );
}

export function LinearGradient(props: LinearGradientProps) {
  return <LinearGradientImpl {...props} />;
}
LinearGradient.displayName = "LinearGradient";

export function RadialGradient(props: RadialGradientProps) {
  return <RadialGradientImpl {...props} />;
}
RadialGradient.displayName = "RadialGradient";

// ── fixed-stop presets — all props pass through to LinearGradientImpl ──────

export function GradientDarkgreenGreen({
  from = "#184E86",
  to = "#57CA85",
  ...restProps
}: LinearGradientProps) {
  return <LinearGradientImpl from={from} to={to} {...restProps} />;
}
GradientDarkgreenGreen.displayName = "GradientDarkgreenGreen";

export function GradientLightgreenGreen({
  from = "#42E695",
  to = "#3BB2B8",
  ...restProps
}: LinearGradientProps) {
  return <LinearGradientImpl from={from} to={to} {...restProps} />;
}
GradientLightgreenGreen.displayName = "GradientLightgreenGreen";

export function GradientOrangeRed({
  from = "#FCE38A",
  to = "#F38181",
  ...restProps
}: LinearGradientProps) {
  return <LinearGradientImpl from={from} to={to} {...restProps} />;
}
GradientOrangeRed.displayName = "GradientOrangeRed";

export function GradientPinkBlue({
  from = "#F02FC2",
  to = "#6094EA",
  ...restProps
}: LinearGradientProps) {
  return <LinearGradientImpl from={from} to={to} {...restProps} />;
}
GradientPinkBlue.displayName = "GradientPinkBlue";

export function GradientPinkRed({
  from = "#F54EA2",
  to = "#FF7676",
  ...restProps
}: LinearGradientProps) {
  return <LinearGradientImpl from={from} to={to} {...restProps} />;
}
GradientPinkRed.displayName = "GradientPinkRed";

export function GradientPurpleOrange({
  from = "#7117EA",
  to = "#EA6060",
  ...restProps
}: LinearGradientProps) {
  return <LinearGradientImpl from={from} to={to} {...restProps} />;
}
GradientPurpleOrange.displayName = "GradientPurpleOrange";

export function GradientPurpleTeal({
  from = "#5B247A",
  to = "#1BCEDF",
  ...restProps
}: LinearGradientProps) {
  return <LinearGradientImpl from={from} to={to} {...restProps} />;
}
GradientPurpleTeal.displayName = "GradientPurpleTeal";

export function GradientSteelPurple({
  from = "#65799B",
  to = "#5E2563",
  ...restProps
}: LinearGradientProps) {
  return <LinearGradientImpl from={from} to={to} {...restProps} />;
}
GradientSteelPurple.displayName = "GradientSteelPurple";

export function GradientTealBlue({
  from = "#17EAD9",
  to = "#6078EA",
  ...restProps
}: LinearGradientProps) {
  return <LinearGradientImpl from={from} to={to} {...restProps} />;
}
GradientTealBlue.displayName = "GradientTealBlue";
