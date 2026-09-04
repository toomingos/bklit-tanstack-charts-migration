"use client";

import type { ReactElement } from "react";
import { LegendItem, LegendLabel, LegendMarker } from "./legend";

const ProfitLossLegendTemplate = (): ReactElement => (
  <LegendItem className="flex items-center gap-2">
    <LegendMarker className="h-2.5 w-2.5" />
    <LegendLabel className="text-xs" />
  </LegendItem>
);

ProfitLossLegendTemplate.displayName = "ProfitLossLegendTemplate";

export { ProfitLossLegendTemplate };
