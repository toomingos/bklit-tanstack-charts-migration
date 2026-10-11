import { Children, isValidElement } from "react";
import type { ReactNode } from "react";
import { defineCarrier } from "../kit/role";
import { roleOf } from "./role-of";
import type { ChoroplethFeatureProps, ChoroplethGraticuleProps, ChoroplethTooltipProps } from "./types";

// Carrier components: configuration is read from the element props by the chart (roleOf), they render nothing.
const ChoroplethFeatureComponent = defineCarrier<Readonly<ChoroplethFeatureProps>>("choroplethFeature", "ChoroplethFeature");
const ChoroplethGraticule = defineCarrier<Readonly<ChoroplethGraticuleProps>>("choroplethGraticule", "ChoroplethGraticule");
const ChoroplethTooltip = defineCarrier<Readonly<ChoroplethTooltipProps>>("choroplethTooltip", "ChoroplethTooltip");

interface ExtractedConfig {
  readonly featureConfig: ChoroplethFeatureProps | undefined;
  readonly tooltipConfig: ChoroplethTooltipProps | undefined;
  readonly graticuleConfig: ChoroplethGraticuleProps | undefined;
  readonly overlayChildren: readonly ReactNode[];
}

const extractChildren = (children: ReactNode): ExtractedConfig => {
  let featureConfig: ChoroplethFeatureProps | undefined = undefined;
  let tooltipConfig: ChoroplethTooltipProps | undefined = undefined;
  let graticuleConfig: ChoroplethGraticuleProps | undefined = undefined;
  const overlayChildren: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    const role = isValidElement(child) ? roleOf(child.type) : undefined;
    if (role === "choroplethFeature" && isValidElement<ChoroplethFeatureProps>(child)) {
      featureConfig = child.props;
    } else if (role === "choroplethTooltip" && isValidElement<ChoroplethTooltipProps>(child)) {
      tooltipConfig = child.props;
    } else if (role === "choroplethGraticule" && isValidElement<ChoroplethGraticuleProps>(child)) {
      graticuleConfig = child.props;
    } else {
      overlayChildren.push(child);
    }
  }
  return { featureConfig, graticuleConfig, overlayChildren, tooltipConfig };
};

export { ChoroplethFeatureComponent, ChoroplethGraticule, ChoroplethTooltip, extractChildren };
