// Maps bklit's enter-transition prop (motion-library shape, seconds) onto a native TanStack ChartMotionTransition.
import type { ChartMotionTransition } from "@tanstack/charts";
import { toMotionTransition } from "../kit/motion/enter-transition";
import type { EnterSpring } from "../kit/motion/enter-transition";
import type { EnterTransition } from "../kit/motion/phase";

export type RadarEnterTransition = EnterTransition;

// The series progress runs 0 -> 1 (bklit's mountProgress), a span <= 5, so motion's granular rest (0.005 / 0.01) = the native defaults.
export const RADAR_ENTER_SPRING: EnterSpring = { damping: 20, mass: 1, stiffness: 60 };

export const toChartTransition = (transition: RadarEnterTransition | undefined): ChartMotionTransition => toMotionTransition(transition, { spring: RADAR_ENTER_SPRING });
