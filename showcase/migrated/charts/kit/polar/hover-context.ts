// Context plumbing shared by pie/model.tsx and ring/model.tsx: required-context read, hover value hook and the
// coordinator that PieProvider/RingProvider bridge to a caller-supplied hovered index.
import { useContext, useEffect, useMemo, useState } from "react";
import type { Context } from "react";
import { createHoverSource, useHoverIndex } from "./polar-hover";
import type { HoverSource } from "./polar-hover";

interface PolarHoverValue {
  /** Index of the hovered slice, ring or series, or `null` when nothing is hovered. */
  hoveredIndex: number | null;
  /** Sets the hovered index; pass `null` to clear hover. */
  readonly setHoveredIndex: (index: number | null) => void;
}

const useRequiredContext = <Held,>(context: Context<Held>, message: string): NonNullable<Held> => {
  const value = useContext(context);
  if (value === null || value === undefined) { throw new Error(message); }
  return value;
};

const useHoverValue = (coordinator: HoverSource): PolarHoverValue => {
  const hoveredIndex = useHoverIndex(coordinator);
  return useMemo(() => ({ hoveredIndex, setHoveredIndex: (index: number | null) => { coordinator.setHovered(index); } }), [coordinator, hoveredIndex]);
};

const useBridgedCoordinator = (hoveredIndex: number | null, setHoveredIndex: (index: number | null) => void): HoverSource => {
  const [coordinator] = useState<HoverSource>(() => {
    const source = createHoverSource();
    source.setHovered(hoveredIndex);
    return source;
  });
  useEffect(() => { coordinator.setHovered(hoveredIndex); }, [coordinator, hoveredIndex]);
  useEffect(() => coordinator.subscribe(() => { setHoveredIndex(coordinator.getHovered()); }), [coordinator, setHoveredIndex]);
  return coordinator;
};

export { useBridgedCoordinator, useHoverValue, useRequiredContext };
export type { PolarHoverValue };
