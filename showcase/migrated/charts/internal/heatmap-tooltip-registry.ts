import { useLayoutEffect } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { HeatmapHoverCoordinator } from "./heatmap-hover-chrome";
import { useHeatmapCoordinatorOptional } from "./heatmap-interaction";
import { formatHeatmapContributionLabel } from "./heatmap-utils";

// Module-scoped pub/sub bridging `HeatmapTooltip` (config-carrier sibling,
// Renders null) to `HeatmapCells` (owns the `<Chart>` definition). The two
// Are React siblings under an ancestor (`HeatmapInteractionProvider`) that
// Is out of scope to edit, so they can't share config via props/context —
// Instead both already receive the same stable `HeatmapHoverCoordinator`
// Object from that ancestor, and this WeakMap keyed on that identity
// Carries the tooltip config across without touching the provider.
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
   * @deprecated No-op since the C2 (phase 6) native-tooltip migration: the
   * native tooltip extension always renders with `motion: false` (matching
   * bklit's former `instant` fast path), so there is no longer a distinct
   * spring-entrance mode to opt out of. Kept only so existing call sites
   * keep compiling; passing it has no effect.
   */
  readonly instant?: boolean;
  readonly showDelay?: number;
  readonly hideDelay?: number;
}

// C2 (phase 6): `HeatmapTooltip` no longer renders a bespoke portal panel —
// It publishes its config into the module-scoped registry above so the
// Sibling `<HeatmapCells>` can enable TanStack's native `tooltip` extension
// And build the panel markup itself via `renderTooltipBody` (same content
// As the legacy `HeatmapTooltipPanel`, just positioned by the native
// Placement engine instead of bespoke flip/clamp math). Rendering an
// `<HeatmapTooltip/>` remains opt-in: no sibling means no registered
// Config, which keeps the native tooltip disabled (`tooltip: false`) on
// `<HeatmapCells>`'s definition, preserving prior "no tooltip unless
// Explicitly requested" behavior.
const HeatmapTooltip = ({
  formatLabel = formatHeatmapContributionLabel,
  className = "",
  panelStyle,
  backgroundColor,
  // The deprecated `instant` prop is deliberately not destructured: it is a no-op kept for call-site compatibility.
  showDelay = DEFAULT_TOOLTIP_SHOW_DELAY_MS,
  hideDelay = DEFAULT_TOOLTIP_HIDE_DELAY_MS,
}: Readonly<HeatmapTooltipProps>): ReactElement | undefined => {
  const coordinator = useHeatmapCoordinatorOptional();

  useLayoutEffect(() => {
    if (!coordinator) {return;}
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

  return undefined;
};

export { getHeatmapTooltipConfig, HeatmapTooltip, setHeatmapTooltipConfig, subscribeHeatmapTooltipConfig };
export type { HeatmapTooltipConfig, HeatmapTooltipProps };
