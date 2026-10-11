import { cubicBezier } from "../kit/motion/easing";

// bklit sunburst zoom (750ms) curve; the sweep uses the shared reveal curve.
export const ZOOM_EASING = cubicBezier(0.22, 1, 0.36, 1);
export const ZOOM_MS = 750;
