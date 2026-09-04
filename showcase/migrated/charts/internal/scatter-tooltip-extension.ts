import { buildNativeTooltipExtension } from "./native-tooltip";
import type { NativeTooltipExtension } from "./native-tooltip";
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
}: Readonly<BuildScatterTooltipExtensionParams>): NativeTooltipExtension<ChartDatum, Date, number> =>
  buildNativeTooltipExtension<ChartDatum, Date, number>({
    // Plot-top anchor: plain point anchor put the panel at the focused point's y.
    anchorX: "point",
    className: tooltip?.className,
    discrete,
    enabled: tooltip?.enabled ?? false,
    offset: BOX_OFFSET,
    spring: tooltipBoxSpring,
  });

export { buildScatterTooltipExtension };
export type { BuildScatterTooltipExtensionParams };
