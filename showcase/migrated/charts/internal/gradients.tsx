import type { ReactElement, ReactNode, SVGProps } from "react";

// Visx gradients ported verbatim; displayNames are load-bearing (pie/gauge classify
// Children by displayName for defs-hoisting — preserve byte-for-byte).

const DEFAULT_GRADIENT_STOP_OPACITY = 1;

interface LinearGradientOwnProps {
  id: string;
  from?: string;
  to?: string;
  x1?: string | number;
  x2?: string | number;
  y1?: string | number;
  y2?: string | number;
  fromOffset?: string | number;
  fromOpacity?: string | number;
  toOffset?: string | number;
  toOpacity?: string | number;
  rotate?: string | number;
  transform?: string;
  children?: ReactNode;
  vertical?: boolean;
}

type LinearGradientProps = LinearGradientOwnProps &
  Omit<SVGProps<SVGLinearGradientElement>, keyof LinearGradientOwnProps>;

type GradientCoord = string | number | undefined;

interface GradientCoordInput {
  readonly vertical: boolean;
  readonly x1: GradientCoord;
  readonly x2: GradientCoord;
  readonly y1: GradientCoord;
  readonly y2: GradientCoord;
}

interface GradientCoords {
  readonly x1: GradientCoord;
  readonly x2: GradientCoord;
  readonly y1: GradientCoord;
  readonly y2: GradientCoord;
}

// Bare vertical gradients default to a top-to-bottom axis.
// Any explicit coordinate keeps the caller's own axis.
const resolveLinearGradientCoords = (params: Readonly<GradientCoordInput>): GradientCoords => {
  const { vertical, x1, x2, y1, y2 } = params;
  const hasExplicitCoords = Boolean(x1) || Boolean(x2) || Boolean(y1) || Boolean(y2);
  if (vertical && !hasExplicitCoords) {
    return { x1: "0", x2: "0", y1: "0", y2: "1" };
  }
  return { x1, x2, y1, y2 };
};

const LinearGradientImpl = ({
  children,
  id,
  from,
  to,
  x1: _x1,
  y1: _y1,
  x2: _x2,
  y2: _y2,
  fromOffset = "0%",
  fromOpacity = DEFAULT_GRADIENT_STOP_OPACITY,
  toOffset = "100%",
  toOpacity = DEFAULT_GRADIENT_STOP_OPACITY,
  rotate,
  transform,
  vertical = true,
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => {
  const { x1, x2, y1, y2 } = resolveLinearGradientCoords({ vertical, x1: _x1, x2: _x2, y1: _y1, y2: _y2 });
  const hasRotate = Boolean(rotate);
  const hasChildren = Boolean(children);
  return (
    <defs>
      <linearGradient
        id={id}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        gradientTransform={hasRotate ? `rotate(${rotate})` : transform}
        {...restProps}
      >
        {hasChildren && children}
        {!hasChildren && (
          <stop offset={fromOffset} stopColor={from} stopOpacity={fromOpacity} />
        )}
        {!hasChildren && (
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

const RadialGradientImpl = ({
  children,
  id,
  from,
  to,
  fromOffset = "0%",
  fromOpacity = DEFAULT_GRADIENT_STOP_OPACITY,
  toOffset = "100%",
  toOpacity = DEFAULT_GRADIENT_STOP_OPACITY,
  rotate,
  transform,
  ...restProps
}: Readonly<RadialGradientProps>): ReactElement => {
  const hasRadialRotate = Boolean(rotate);
  const hasRadialChildren = Boolean(children);
  return (
    <defs>
      <radialGradient
        id={id}
        gradientTransform={hasRadialRotate ? `rotate(${rotate})` : transform}
        {...restProps}
      >
        {hasRadialChildren && children}
        {!hasRadialChildren && (
          <stop offset={fromOffset} stopColor={from} stopOpacity={fromOpacity} />
        )}
        {!hasRadialChildren && (
          <stop offset={toOffset} stopColor={to} stopOpacity={toOpacity} />
        )}
      </radialGradient>
    </defs>
  );
};


const LinearGradient = (props: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl {...props} />;

LinearGradient.displayName = "LinearGradient";

const RadialGradient = (props: Readonly<RadialGradientProps>): ReactElement => <RadialGradientImpl {...props} />;

RadialGradient.displayName = "RadialGradient";


const GradientDarkgreenGreen = ({
  from = "#184E86",
  to = "#57CA85",
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

GradientDarkgreenGreen.displayName = "GradientDarkgreenGreen";

const GradientLightgreenGreen = ({
  from = "#42E695",
  to = "#3BB2B8",
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

GradientLightgreenGreen.displayName = "GradientLightgreenGreen";

const GradientOrangeRed = ({
  from = "#FCE38A",
  to = "#F38181",
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

GradientOrangeRed.displayName = "GradientOrangeRed";

const GradientPinkBlue = ({
  from = "#F02FC2",
  to = "#6094EA",
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

GradientPinkBlue.displayName = "GradientPinkBlue";

const GradientPinkRed = ({
  from = "#F54EA2",
  to = "#FF7676",
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

GradientPinkRed.displayName = "GradientPinkRed";

const GradientPurpleOrange = ({
  from = "#7117EA",
  to = "#EA6060",
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

GradientPurpleOrange.displayName = "GradientPurpleOrange";

const GradientPurpleTeal = ({
  from = "#5B247A",
  to = "#1BCEDF",
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

GradientPurpleTeal.displayName = "GradientPurpleTeal";

const GradientSteelPurple = ({
  from = "#65799B",
  to = "#5E2563",
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

GradientSteelPurple.displayName = "GradientSteelPurple";

const GradientTealBlue = ({
  from = "#17EAD9",
  to = "#6078EA",
  ...restProps
}: Readonly<LinearGradientProps>): ReactElement => <LinearGradientImpl from={from} to={to} {...restProps} />;

GradientTealBlue.displayName = "GradientTealBlue";

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
