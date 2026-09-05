// Pie center hooks: context readers for components inside PieChart.
// Split from pie-center so each module exports a uniform shape.
import { useContext } from "react";
import type { HoverSource } from "./hover-motion";
import { PieHoverCoordinatorContext, PieStableContext } from "./pie-center-context";
import type { PieStableValue } from "./pie-center";

const usePieStable = (): PieStableValue => {
  const ctx = useContext(PieStableContext);
  if (!ctx) {throw new Error("Pie components must be used within <PieChart>.");}
  return ctx;
}

const usePieHoverCoordinator = (): HoverSource => {
  const ctx = useContext(PieHoverCoordinatorContext);
  if (!ctx) {throw new Error("Pie components must be used within <PieChart>.");}
  return ctx;
}

export {
  usePieStable,
  usePieHoverCoordinator,
};
