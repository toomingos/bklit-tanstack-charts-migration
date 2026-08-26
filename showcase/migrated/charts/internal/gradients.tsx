import type { ComponentProps } from "react";
import {
  GradientDarkgreenGreen as VisxGradientDarkgreenGreen,
  GradientLightgreenGreen as VisxGradientLightgreenGreen,
  GradientOrangeRed as VisxGradientOrangeRed,
  GradientPinkBlue as VisxGradientPinkBlue,
  GradientPinkRed as VisxGradientPinkRed,
  GradientPurpleOrange as VisxGradientPurpleOrange,
  GradientPurpleTeal as VisxGradientPurpleTeal,
  GradientSteelPurple as VisxGradientSteelPurple,
  GradientTealBlue as VisxGradientTealBlue,
  LinearGradient as VisxLinearGradient,
  RadialGradient as VisxRadialGradient,
} from "@visx/gradient";

// ── visx gradient passthroughs ──────────────────────────────────────────────
// Same wrapper shape as ./pattern-preset (named fn component delegating to an
// aliased @visx import, .displayName set). Legacy barrel re-exported these
// eleven directly from @visx/gradient; the wrapper tier keeps symbol ownership
// inside migrated code, matching what P3.x did for patterns.

export function GradientDarkgreenGreen(
  props: ComponentProps<typeof VisxGradientDarkgreenGreen>,
) {
  return <VisxGradientDarkgreenGreen {...props} />;
}
GradientDarkgreenGreen.displayName = "GradientDarkgreenGreen";

export function GradientLightgreenGreen(
  props: ComponentProps<typeof VisxGradientLightgreenGreen>,
) {
  return <VisxGradientLightgreenGreen {...props} />;
}
GradientLightgreenGreen.displayName = "GradientLightgreenGreen";

export function GradientOrangeRed(
  props: ComponentProps<typeof VisxGradientOrangeRed>,
) {
  return <VisxGradientOrangeRed {...props} />;
}
GradientOrangeRed.displayName = "GradientOrangeRed";

export function GradientPinkBlue(
  props: ComponentProps<typeof VisxGradientPinkBlue>,
) {
  return <VisxGradientPinkBlue {...props} />;
}
GradientPinkBlue.displayName = "GradientPinkBlue";

export function GradientPinkRed(
  props: ComponentProps<typeof VisxGradientPinkRed>,
) {
  return <VisxGradientPinkRed {...props} />;
}
GradientPinkRed.displayName = "GradientPinkRed";

export function GradientPurpleOrange(
  props: ComponentProps<typeof VisxGradientPurpleOrange>,
) {
  return <VisxGradientPurpleOrange {...props} />;
}
GradientPurpleOrange.displayName = "GradientPurpleOrange";

export function GradientPurpleTeal(
  props: ComponentProps<typeof VisxGradientPurpleTeal>,
) {
  return <VisxGradientPurpleTeal {...props} />;
}
GradientPurpleTeal.displayName = "GradientPurpleTeal";

export function GradientSteelPurple(
  props: ComponentProps<typeof VisxGradientSteelPurple>,
) {
  return <VisxGradientSteelPurple {...props} />;
}
GradientSteelPurple.displayName = "GradientSteelPurple";

export function GradientTealBlue(
  props: ComponentProps<typeof VisxGradientTealBlue>,
) {
  return <VisxGradientTealBlue {...props} />;
}
GradientTealBlue.displayName = "GradientTealBlue";

export function LinearGradient(
  props: ComponentProps<typeof VisxLinearGradient>,
) {
  return <VisxLinearGradient {...props} />;
}
LinearGradient.displayName = "LinearGradient";

export function RadialGradient(
  props: ComponentProps<typeof VisxRadialGradient>,
) {
  return <VisxRadialGradient {...props} />;
}
RadialGradient.displayName = "RadialGradient";
