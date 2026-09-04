// Single sunburst hit path: stable hover/click handlers per arc so the parent
// Map never allocates inline closures during render.
import { useCallback } from "react";
import type { ReactElement } from "react";

interface SunburstHitPathProps {
  readonly arcIndex: number;
  readonly hasChildren: boolean;
  readonly onHitClick: (arcIndex: number) => void;
  readonly onHitEnter: (arcIndex: number) => void;
  readonly pathData: string;
}

const SUNBURST_HIT_DEFAULT_STYLE = { cursor: "default" } as const;

const SUNBURST_HIT_POINTER_STYLE = { cursor: "pointer" } as const;

const SunburstHitPath = ({
  arcIndex,
  hasChildren,
  onHitClick,
  onHitEnter,
  pathData,
}: Readonly<SunburstHitPathProps>): ReactElement => {
  const handleClick = useCallback((): void => {
    onHitClick(arcIndex);
  }, [arcIndex, onHitClick]);
  const handlePointerEnter = useCallback((): void => {
    onHitEnter(arcIndex);
  }, [arcIndex, onHitEnter]);
  return (
    <path
      data-bkm-sunburst-hit={arcIndex}
      d={pathData}
      fill="transparent"
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      style={hasChildren ? SUNBURST_HIT_POINTER_STYLE : SUNBURST_HIT_DEFAULT_STYLE}
    />
  );
};

export { SunburstHitPath };
export type { SunburstHitPathProps };
