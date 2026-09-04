import type { RefObject } from "react";
// Shared "create the spring once, lazily, on the ref that owns it" helper.
// Every tooltip sub-component uses this to imperatively drive an SVG or DOM attribute from a Spring instance held in a ref.
import { createSpring } from './spring';
import type { Spring } from './spring';

interface EnsureSpringConfig {
  readonly initial: number;
  readonly stiffness: number;
  readonly damping: number;
  readonly onUpdate: (value: number) => void;
}

// `ref` is genuinely mutated (it is the spring instance's home); it cannot be
// Readonly without breaking the lazy-init contract.
const ensureSpring = (ref: RefObject<Spring | null>, config: Readonly<EnsureSpringConfig>): void => {
  ref.current ??= createSpring({ damping: config.damping, initial: config.initial, onUpdate: config.onUpdate, stiffness: config.stiffness });
};

export { ensureSpring };
export type { EnsureSpringConfig };
