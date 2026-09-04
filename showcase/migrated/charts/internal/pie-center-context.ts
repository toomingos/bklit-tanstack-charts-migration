// Pie center contexts: stable spec and hover coordinator shared with PieChart.
// Split from pie-center so each module exports a uniform shape.
import { createContext } from "react";
import type { PieHoverCoordinator } from "./pie-hover-chrome";
import type { PieStableValue } from "./pie-center";

const PieStableContext = createContext<PieStableValue | null>(null);
const PieHoverCoordinatorContext = createContext<PieHoverCoordinator | null>(null);

export {
  PieStableContext,
  PieHoverCoordinatorContext,
};
