import type { ChartPhase } from "./chart-phase";
import { getSkeletonTargetValue, getSkeletonValue } from "./skeleton-data";

// Pulse mode is the codomain of the mapping below, so it is declared here.
type LineLoadingPulseMode = "loop" | "exit" | "enter";

// Maps lifecycle phase to pulse mode (null draws no pulse); member-for-member with legacy,
// So the mapping ports 1:1.
const resolveLineLoadingPulseMode = (phase: ChartPhase): LineLoadingPulseMode | null => {
  switch (phase) {
    case "loading": {
      return "loop";
    }
    case "exiting": {
      return "exit";
    }
    case "revealingLoading": {
      return "enter";
    }
    case "exitingReady":
    case "gridTweenLoading":
    case "gridTweenReady":
    case "ready":
    case "revealing": {
      return null;
    }
    default: {
      return null;
    }
  }
}

// Placeholder series shape only (public surface deleted); values set the loading y-domain.
const LOADING_SKELETON_POINT_COUNT = 7;

// Placeholder rows: standalone 7-point series without data, mirror of real rows otherwise;
// Only dataKey is read downstream.
const buildLoadingSkeletonRows = (rowCount: number, dataKey: string): Record<string, number>[] => {
  const fromTarget = rowCount > 0;
  const count = fromTarget ? rowCount : LOADING_SKELETON_POINT_COUNT;
  const value = fromTarget ? getSkeletonTargetValue : getSkeletonValue;
  return Array.from({ length: count }, (_unused, index) => ({ [dataKey]: value(index) }));
}

export {
  resolveLineLoadingPulseMode,
  buildLoadingSkeletonRows,
};
export type { LineLoadingPulseMode };
