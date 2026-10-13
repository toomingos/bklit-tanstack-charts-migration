"use client";
// bklit's visx gradients as config carriers: they render nothing, the charts read them from their
// children and add them to the definition's `gradients`, so `url(#x)` resolves with no DOM <defs>.
import { Children, isValidElement } from "react";
import type { ReactNode, SVGProps } from "react";
import type { ChartGradient, ChartLinearGradient, ChartRadialGradient } from "@tanstack/charts";
import { isNumber, leadingFloat } from "./guards";
import { defineCarrier } from "./role";
import { propsFor } from "./read-children";
import type { ChildTable } from "./read-children";

type Length = string | number;

/** A color stop of a gradient. */
export interface GradientStop {
  /** Position along the gradient from 0 to 1. */
  readonly offset: number;
  /** Color at that position. */
  readonly color: string;
}

interface GradientOwnProps {
  /** Id of the gradient, referenced as `url(#id)`. */
  readonly id: string;
  /**
   * Color at the start of the gradient.
   * @default "currentColor"
   */
  readonly from?: string;
  /**
   * Color at the end of the gradient.
   * @default "currentColor"
   */
  readonly to?: string;
  /**
   * Position of the start color, as a fraction (`0.2`) or a percentage (`"20%"`).
   * @default 0
   */
  readonly fromOffset?: Length;
  /**
   * Position of the end color, as a fraction or a percentage.
   * @default 1
   */
  readonly toOffset?: Length;
  /**
   * Opacity of the start color from 0 to 1.
   * @default 1
   */
  readonly fromOpacity?: Length;
  /**
   * Opacity of the end color from 0 to 1.
   * @default 1
   */
  readonly toOpacity?: Length;
  /** Rotates the gradient direction by this many degrees. */
  readonly rotate?: number | string;
  /** An SVG transform string. Only `rotate(angle)` is applied, and it takes precedence over `rotate`. */
  readonly transform?: string;
  /** `<stop>` elements. When present they replace `from` and `to`. */
  readonly children?: ReactNode;
}

interface LinearGradientOwnProps extends GradientOwnProps {
  /**
   * Start x of the gradient vector, as a fraction or a percentage.
   * @default 0
   */
  readonly x1?: Length;
  /**
   * Start y of the gradient vector.
   * @default 0
   */
  readonly y1?: Length;
  /**
   * End x of the gradient vector.
   * @default 1
   */
  readonly x2?: Length;
  /**
   * End y of the gradient vector.
   * @default 0
   */
  readonly y2?: Length;
  /**
   * Run the gradient from top to bottom. Ignored when any of `x1`, `y1`, `x2`, `y2` is set to a non-zero value.
   * @default true
   */
  readonly vertical?: boolean;
}

/**
 * Props of `LinearGradient`: the gradient options below plus any SVG `linearGradient` attribute. Attributes without a chart equivalent are accepted and ignored.
 */
// bklit's visx gradients pass every other SVG attribute through; the carriers accept them and ignore what has no native equivalent.
export type LinearGradientProps = LinearGradientOwnProps & Omit<SVGProps<SVGLinearGradientElement>, keyof LinearGradientOwnProps | "ref">;

interface RadialGradientOwnProps extends GradientOwnProps {
  /**
   * Center x of the outer circle, as a fraction or a percentage.
   * @default 0.5
   */
  readonly cx?: Length;
  /**
   * Center y of the outer circle.
   * @default 0.5
   */
  readonly cy?: Length;
  /**
   * Radius of the outer circle.
   * @default 0.5
   */
  readonly r?: Length;
  /** Focal point x. The focal point is the center when omitted. */
  readonly fx?: Length;
  /** Focal point y. The focal point is the center when omitted. */
  readonly fy?: Length;
}

/**
 * Props of `RadialGradient`: the gradient options below plus any SVG `radialGradient` attribute. Attributes without a chart equivalent are accepted and ignored.
 */
export type RadialGradientProps = RadialGradientOwnProps & Omit<SVGProps<SVGRadialGradientElement>, keyof RadialGradientOwnProps | "ref">;

/**
 * Declares a linear gradient that chart elements reference as `fill="url(#id)"`. Place it as a child of the chart. It renders nothing itself.
 */
export const LinearGradient = /* @__PURE__ */ defineCarrier<LinearGradientProps>("linearGradient", "LinearGradient");
/**
 * Declares a radial gradient that chart elements reference as `fill="url(#id)"`. Place it as a child of the chart. It renders nothing itself.
 */
export const RadialGradient = /* @__PURE__ */ defineCarrier<RadialGradientProps>("radialGradient", "RadialGradient");

const PRESET_PREFIX = "gradientPreset:";

/** Fixed two-stop linear presets, colors copied from @visx/gradient. */
const PRESETS = {
  GradientDarkgreenGreen: ["#184E86", "#57CA85"],
  GradientLightgreenGreen: ["#42E695", "#3BB2B8"],
  GradientOrangeRed: ["#FCE38A", "#F38181"],
  GradientPinkBlue: ["#F02FC2", "#6094EA"],
  GradientPinkRed: ["#F54EA2", "#FF7676"],
  GradientPurpleOrange: ["#7117EA", "#EA6060"],
  GradientPurpleTeal: ["#5B247A", "#1BCEDF"],
  GradientSteelPurple: ["#65799B", "#5E2563"],
  GradientTealBlue: ["#17EAD9", "#6078EA"],
} as const satisfies Record<string, readonly [string, string]>;

type PresetName = keyof typeof PRESETS;

// The visx preset components accept every LinearGradient prop; from/to are optional.
const preset = (name: PresetName): ReturnType<typeof defineCarrier<LinearGradientProps>> => defineCarrier<LinearGradientProps>(`${PRESET_PREFIX}${name}`, name);

/**
 * Two-stop linear gradient preset from dark blue (#184E86) to green (#57CA85). Reference it as `fill="url(#your-id)"`. Accepts the `LinearGradient` props, and `from` / `to` override the preset colors.
 */
export const GradientDarkgreenGreen = /* @__PURE__ */ preset("GradientDarkgreenGreen");
/**
 * Two-stop linear gradient preset from light green (#42E695) to teal (#3BB2B8). Reference it as `fill="url(#your-id)"`. Accepts the `LinearGradient` props, and `from` / `to` override the preset colors.
 */
export const GradientLightgreenGreen = /* @__PURE__ */ preset("GradientLightgreenGreen");
/**
 * Two-stop linear gradient preset from yellow (#FCE38A) to red (#F38181). Reference it as `fill="url(#your-id)"`. Accepts the `LinearGradient` props, and `from` / `to` override the preset colors.
 */
export const GradientOrangeRed = /* @__PURE__ */ preset("GradientOrangeRed");
/**
 * Two-stop linear gradient preset from pink (#F02FC2) to blue (#6094EA). Reference it as `fill="url(#your-id)"`. Accepts the `LinearGradient` props, and `from` / `to` override the preset colors.
 */
export const GradientPinkBlue = /* @__PURE__ */ preset("GradientPinkBlue");
/**
 * Two-stop linear gradient preset from pink (#F54EA2) to red (#FF7676). Reference it as `fill="url(#your-id)"`. Accepts the `LinearGradient` props, and `from` / `to` override the preset colors.
 */
export const GradientPinkRed = /* @__PURE__ */ preset("GradientPinkRed");
/**
 * Two-stop linear gradient preset from purple (#7117EA) to orange (#EA6060). Reference it as `fill="url(#your-id)"`. Accepts the `LinearGradient` props, and `from` / `to` override the preset colors.
 */
export const GradientPurpleOrange = /* @__PURE__ */ preset("GradientPurpleOrange");
/**
 * Two-stop linear gradient preset from purple (#5B247A) to teal (#1BCEDF). Reference it as `fill="url(#your-id)"`. Accepts the `LinearGradient` props, and `from` / `to` override the preset colors.
 */
export const GradientPurpleTeal = /* @__PURE__ */ preset("GradientPurpleTeal");
/**
 * Two-stop linear gradient preset from steel (#65799B) to purple (#5E2563). Reference it as `fill="url(#your-id)"`. Accepts the `LinearGradient` props, and `from` / `to` override the preset colors.
 */
export const GradientSteelPurple = /* @__PURE__ */ preset("GradientSteelPurple");
/**
 * Two-stop linear gradient preset from teal (#17EAD9) to blue (#6078EA). Reference it as `fill="url(#your-id)"`. Accepts the `LinearGradient` props, and `from` / `to` override the preset colors.
 */
export const GradientTealBlue = /* @__PURE__ */ preset("GradientTealBlue");

/** "50%" -> 0.5, "0.25" -> 0.25, 1 -> 1. Undefined/NaN -> fallback. */
function unit(value: Length | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (isNumber(value)) {
    return Number.isFinite(value) ? value : fallback;
  }
  const trimmed = value.trim();
  const parsed = leadingFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return trimmed.endsWith("%") ? parsed / 100 : parsed;
}

interface AuthoredStop {
  offset: number;
  color: string;
  opacity?: number;
}

function stopsOf(props: GradientOwnProps, defaults?: readonly [string, string]): ChartGradient["stops"] {
  const authored: AuthoredStop[] = [];
  Children.forEach(props.children, (child) => {
    if (!isValidElement<{ offset?: Length; stopColor?: string; stopOpacity?: number }>(child)) {
      return;
    }
    const { offset, stopColor, stopOpacity } = child.props;
    if (stopColor !== undefined) {
      const stop: AuthoredStop = { offset: unit(offset, 0), color: stopColor };
      if (stopOpacity !== undefined) {
        stop.opacity = stopOpacity;
      }
      authored.push(stop);
    }
  });
  if (authored.length > 0) {
    return authored;
  }
  return [
    { offset: unit(props.fromOffset, 0), color: props.from ?? defaults?.[0] ?? "currentColor", opacity: unit(props.fromOpacity, 1) },
    { offset: unit(props.toOffset, 1), color: props.to ?? defaults?.[1] ?? "currentColor", opacity: unit(props.toOpacity, 1) },
  ];
}

/** visx: `transform` overrides `rotate`; only `rotate(a)` maps onto the native gradient vector. */
function rotationOf(props: GradientOwnProps): number {
  const raw = props.transform === undefined ? props.rotate : /rotate\(\s*(-?[\d.]+)/u.exec(props.transform)?.[1];
  return raw === undefined ? 0 : Number(raw);
}

function rotateAboutOrigin(x: number, y: number, degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

function linear(props: LinearGradientProps, defaults?: readonly [string, string]): ChartLinearGradient {
  const explicit = [props.x1, props.y1, props.x2, props.y2].some((v) => v !== undefined && v !== 0 && v !== "0");
  const vertical = props.vertical !== false && !explicit;
  let x1 = vertical ? 0 : unit(props.x1, 0);
  let y1 = vertical ? 0 : unit(props.y1, 0);
  let x2 = vertical ? 0 : unit(props.x2, 1);
  let y2 = vertical ? 1 : unit(props.y2, 0);
  const degrees = rotationOf(props);
  if (Number.isFinite(degrees) && degrees !== 0) {
    [x1, y1] = rotateAboutOrigin(x1, y1, degrees);
    [x2, y2] = rotateAboutOrigin(x2, y2, degrees);
  }
  return { id: props.id, type: "linear", x1, y1, x2, y2, stops: stopsOf(props, defaults) };
}

function radial(props: RadialGradientProps): ChartRadialGradient {
  const gradient: ChartRadialGradient = {
    id: props.id,
    type: "radial",
    cx: unit(props.cx, 0.5),
    cy: unit(props.cy, 0.5),
    r: unit(props.r, 0.5),
    stops: stopsOf(props),
  };
  if (props.fx !== undefined) {
    gradient.fx = unit(props.fx, 0.5);
  }
  if (props.fy !== undefined) {
    gradient.fy = unit(props.fy, 0.5);
  }
  return gradient;
}

const isPresetName = (name: string): name is PresetName => name in PRESETS;

const gradientsOfRole = (table: ChildTable, role: string): ChartGradient[] => {
  if (role === "linearGradient") {
    return propsFor<LinearGradientProps>(table, role).map((p) => linear(p));
  }
  if (role === "radialGradient") {
    return propsFor<RadialGradientProps>(table, role).map((p) => radial(p));
  }
  if (role.startsWith(PRESET_PREFIX)) {
    const name = role.slice(PRESET_PREFIX.length);
    const defaults = isPresetName(name) ? PRESETS[name] : undefined;
    return propsFor<LinearGradientProps>(table, role).map((p) => linear(p, defaults));
  }
  return [];
};

/** Every user-declared gradient in a chart's children, as native definition resources. */
export const userGradients = (table: ChildTable): ChartGradient[] => [...table.keys()].flatMap((role) => gradientsOfRole(table, role));

/** True when a paint is `url(#id)` (resolved against the chart's gradient resources). */
export const isGradientRef = (paint: string | undefined): paint is string => paint?.startsWith("url(#") === true;
