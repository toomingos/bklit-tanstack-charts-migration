import { createContext, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createHeatmapHoverCoordinator } from './heatmap-hover-chrome';
import type { HeatmapHoverCoordinator } from './heatmap-hover-chrome';

const HeatmapInteractionContext = createContext<HeatmapHoverCoordinator | null>(null);

interface HeatmapInteractionProviderProps {
  readonly children?: ReactNode;
  readonly coordinator?: HeatmapHoverCoordinator;
}

const HeatmapInteractionProvider = ({ children, coordinator }: Readonly<HeatmapInteractionProviderProps>): ReactElement => {
  // Owned coordinator is memoized, never a ref, because its identity is read during render.
  // The empty factory keeps one stable instance per mount.
  const ownCoordinator = useMemo(() => createHeatmapHoverCoordinator(), []);
  const resolved = coordinator ?? ownCoordinator;
  return <HeatmapInteractionContext.Provider value={resolved}>{children}</HeatmapInteractionContext.Provider>;
};

export { HeatmapInteractionContext, HeatmapInteractionProvider };
export type { HeatmapInteractionProviderProps };
