// Ring hover scales as reactive geometry multipliers (bklit ring.tsx parity).
// Hovered 1.03, outward-pushed 1.02, rest 1.
const RING_HOVERED_SCALE = 1.03;
const RING_PUSHED_OUT_SCALE = 1.02;
const ringHoverScale = (isHovered: boolean, isPushedOut: boolean): number => {
  if (isHovered) {return RING_HOVERED_SCALE;}
  if (isPushedOut) {return RING_PUSHED_OUT_SCALE;}
  return 1;
}

export { ringHoverScale };
export {
  createPieHoverCoordinator as createRingHoverCoordinator,
  type PieHoverCoordinator as RingHoverCoordinator,
} from "./pie-hover-chrome";
