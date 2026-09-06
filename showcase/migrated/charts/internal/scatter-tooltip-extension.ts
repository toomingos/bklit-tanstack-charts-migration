import { tooltip as packageTooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import type { ChartTooltipInput } from "@tanstack/charts";
import type { ChartDatum, ExtractedChildren } from "./types";
import type { SpringConfig } from "./chart-config-context";
import { BOX_OFFSET } from "./design-tokens";

interface BuildScatterTooltipExtensionParams {
  readonly discrete: boolean;
  readonly tooltip: ExtractedChildren["tooltip"];
  readonly tooltipBoxSpring: Readonly<SpringConfig>;
}

const buildScatterTooltipExtension = ({
  discrete,
  tooltip,
  tooltipBoxSpring,
}: Readonly<BuildScatterTooltipExtensionParams>): ChartTooltipInput<ChartDatum, Date, number, "dom"> | false => {
  if (!(tooltip?.enabled ?? false)) {return false;}
  return {
    // Plot-top anchor: plain point anchor put the panel at the focused point's y.
    anchor: (_points, context) => ({
      x: context.focus.primary.x,
      y: context.plot.y - BOX_OFFSET,
    }),
    // Shell class strips the package panel chrome like every other family; the body
    // Renderer draws the `.bkm-tooltip-panel` box (and carries the user className).
    className: "bkm-native-tooltip",
    motion: discrete
      ? (false as const)
      : { damping: tooltipBoxSpring.damping, stiffness: tooltipBoxSpring.stiffness, type: "spring" as const },
    offset: BOX_OFFSET,
    placement: ["bottom-right", "bottom-left"] as const,
    portal,
    sticky: false,
    use: packageTooltip,
  };
};

export { buildScatterTooltipExtension };
export type { BuildScatterTooltipExtensionParams };
