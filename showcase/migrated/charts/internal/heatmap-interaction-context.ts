import { createContext } from 'react';
import type { HeatmapHoverCoordinator } from './heatmap-hover-chrome';

const HeatmapInteractionContext = createContext<HeatmapHoverCoordinator | null>(null);

export { HeatmapInteractionContext };
