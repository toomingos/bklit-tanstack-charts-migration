import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { HeatmapHoverCoordinator } from './heatmap-hover-chrome';
import { HeatmapInteractionBoundary } from './heatmap-interaction-boundary';
import { HeatmapInteractionProvider } from './heatmap-interaction-provider';

interface HeatmapInteractionRootProps {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly coordinator?: HeatmapHoverCoordinator;
}

const HeatmapInteractionRoot = ({ children, className, style, coordinator }: Readonly<HeatmapInteractionRootProps>): ReactElement => (
    <HeatmapInteractionProvider coordinator={coordinator}>
      <HeatmapInteractionBoundary className={className} style={style}>
        {children}
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
);

export { HeatmapInteractionRoot };
export type { HeatmapInteractionRootProps };
