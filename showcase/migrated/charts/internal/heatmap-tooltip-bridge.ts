import type { CSSProperties } from 'react';
import type { HeatmapHoverCoordinator } from './heatmap-hover-chrome';

// Bridges tooltip config between sibling components via the shared coordinator.
interface HeatmapTooltipConfig {
  readonly formatLabel: (count: number, date: Readonly<Date>) => string;
  readonly className: string;
  readonly panelStyle?: Readonly<CSSProperties>;
  readonly showDelayMs: number;
  readonly hideDelayMs: number;
}

const heatmapTooltipConfigs = new WeakMap<HeatmapHoverCoordinator, HeatmapTooltipConfig>();
const heatmapTooltipListeners = new WeakMap<HeatmapHoverCoordinator, Set<() => void>>();

const getHeatmapTooltipListenerSet = (coordinator: Readonly<HeatmapHoverCoordinator>): Set<() => void> => {
  let listeners = heatmapTooltipListeners.get(coordinator);
  if (!listeners) {
    listeners = new Set();
    heatmapTooltipListeners.set(coordinator, listeners);
  }
  return listeners;
}

const setHeatmapTooltipConfig = (coordinator: Readonly<HeatmapHoverCoordinator>, config: Readonly<HeatmapTooltipConfig> | undefined): void => {
  if (config) {heatmapTooltipConfigs.set(coordinator, config);}
  else {heatmapTooltipConfigs.delete(coordinator);}
  for (const listener of getHeatmapTooltipListenerSet(coordinator)) {listener();}
}

const subscribeHeatmapTooltipConfig = (coordinator: Readonly<HeatmapHoverCoordinator> | undefined, listener: () => void): (() => void) => {
  if (!coordinator) {
    return () => {
      // No coordinator: nothing to unsubscribe.
    };
  }
  const listeners = getHeatmapTooltipListenerSet(coordinator);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getHeatmapTooltipConfig = (coordinator: Readonly<HeatmapHoverCoordinator> | undefined): HeatmapTooltipConfig | undefined => {
  if (!coordinator) {return undefined;}
  return heatmapTooltipConfigs.get(coordinator);
}

export { setHeatmapTooltipConfig, subscribeHeatmapTooltipConfig, getHeatmapTooltipConfig };
export type { HeatmapTooltipConfig };
