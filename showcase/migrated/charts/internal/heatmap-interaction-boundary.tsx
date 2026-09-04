import { useCallback } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useHeatmapCoordinator } from './heatmap-interaction';

interface HeatmapInteractionBoundaryProps {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

const HeatmapInteractionBoundary = ({ children, className, style }: Readonly<HeatmapInteractionBoundaryProps>): ReactElement => {
  const coordinator = useHeatmapCoordinator();
  const handlePointerLeave = useCallback((): void => { coordinator.clearInteraction(); }, [coordinator]);
  return (
    <div
      className={className}
      style={style}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </div>
  );
};

export { HeatmapInteractionBoundary };
export type { HeatmapInteractionBoundaryProps };
