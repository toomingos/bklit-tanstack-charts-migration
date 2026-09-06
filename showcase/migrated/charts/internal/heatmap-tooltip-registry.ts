import { memo, useLayoutEffect } from "react";
import type { CSSProperties, NamedExoticComponent, ReactElement } from "react";
import type { HeatmapHoverCoordinator } from "./heatmap-context";
import { useHeatmapCoordinatorOptional } from "./heatmap-context";
import { formatHeatmapContributionLabel } from "./heatmap-utils";

// Sibling bridge: the provider ancestor is out of scope, so tooltip config travels via WeakMap on coordinator identity.
interface HeatmapTooltipConfig {
  readonly formatLabel: (count: number, date: Readonly<Date>) => string;
  readonly className: string;
  readonly panelStyle?: Readonly<CSSProperties>;
  readonly backgroundColor?: string;
  readonly showDelayMs: number;
  readonly hideDelayMs: number;
}

const heatmapTooltipConfigs = new WeakMap<HeatmapHoverCoordinator, HeatmapTooltipConfig>();
const heatmapTooltipListeners = new WeakMap<HeatmapHoverCoordinator, Set<() => void>>();

const DEFAULT_TOOLTIP_SHOW_DELAY_MS = 0;
const DEFAULT_TOOLTIP_HIDE_DELAY_MS = 120;
const MIN_TOOLTIP_DELAY_MS = 0;

const getHeatmapTooltipListenerSet = (coordinator: Readonly<HeatmapHoverCoordinator>): Set<() => void> => {
  let listeners = heatmapTooltipListeners.get(coordinator);
  if (!listeners) {
    listeners = new Set();
    heatmapTooltipListeners.set(coordinator, listeners);
  }
  return listeners;
};

const setHeatmapTooltipConfig = (coordinator: Readonly<HeatmapHoverCoordinator>, config: Readonly<HeatmapTooltipConfig> | null): void => {
  if (config) {heatmapTooltipConfigs.set(coordinator, config);}
  else {heatmapTooltipConfigs.delete(coordinator);}
  for (const listener of getHeatmapTooltipListenerSet(coordinator)) {listener();}
};

const subscribeHeatmapTooltipConfig = (coordinator: Readonly<HeatmapHoverCoordinator> | null, listener: () => void): (() => void) => {
  if (!coordinator) {
    return () => {
      // No coordinator, so there is nothing to unsubscribe.
    };
  }
  const listeners = getHeatmapTooltipListenerSet(coordinator);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getHeatmapTooltipConfig = (coordinator: Readonly<HeatmapHoverCoordinator> | null): HeatmapTooltipConfig | null => {
  if (!coordinator) {return null;}
  return heatmapTooltipConfigs.get(coordinator) ?? null;
};

interface HeatmapTooltipProps {
  readonly formatLabel?: (count: number, date: Readonly<Date>) => string;
  readonly className?: string;
  readonly panelStyle?: Readonly<CSSProperties>;
  readonly backgroundColor?: string;
  /**
   * @deprecated No-op since the C2 (phase 6) package-tooltip migration: the
   * package tooltip extension always renders with `motion: false` (matching
   * bklit's former `instant` fast path), so there is no longer a distinct
   * spring-entrance mode to opt out of. Kept only so existing call sites
   * keep compiling; passing it has no effect.
   */
  readonly instant?: boolean;
  readonly showDelay?: number;
  readonly hideDelay?: number;
}

// Publishes config for HeatmapCells' native tooltip; no sibling keeps it disabled (opt-in preserved).
const RenderHeatmapTooltip = ({
  formatLabel = formatHeatmapContributionLabel,
  className = "",
  panelStyle,
  backgroundColor,
  // The deprecated `instant` prop is deliberately not destructured: it is a no-op kept for call-site compatibility.
  showDelay = DEFAULT_TOOLTIP_SHOW_DELAY_MS,
  hideDelay = DEFAULT_TOOLTIP_HIDE_DELAY_MS,
}: Readonly<HeatmapTooltipProps>): ReactElement | null => {
  const coordinator = useHeatmapCoordinatorOptional();

  useLayoutEffect(() => {
    if (!coordinator) {
      return (): void => {
        // No coordinator, so there is nothing to clean up.
      };
    }
    setHeatmapTooltipConfig(coordinator, {
      backgroundColor,
      className,
      formatLabel,
      hideDelayMs: Math.max(MIN_TOOLTIP_DELAY_MS, hideDelay),
      panelStyle,
      showDelayMs: Math.max(MIN_TOOLTIP_DELAY_MS, showDelay),
    });
    return (): void => {
      setHeatmapTooltipConfig(coordinator, null);
    };
  }, [coordinator, formatLabel, className, panelStyle, backgroundColor, showDelay, hideDelay]);

  return null;
};

const HeatmapTooltip: NamedExoticComponent<Readonly<HeatmapTooltipProps>> = memo(RenderHeatmapTooltip);

HeatmapTooltip.displayName = "HeatmapTooltip";

export { getHeatmapTooltipConfig, HeatmapTooltip, setHeatmapTooltipConfig, subscribeHeatmapTooltipConfig };
export type { HeatmapTooltipConfig, HeatmapTooltipProps };
