// Shared "create the spring once, lazily, on the ref that owns it" helper.
// Every tooltip sub-component uses this to imperatively drive an SVG or DOM attribute from a Spring instance held in a ref.
import { createSpring } from './spring';
import type { Spring } from './spring';

interface EnsureSpringConfig {
  initial: number;
  stiffness: number;
  damping: number;
  onUpdate: (value: number) => void;
}

// `ref` is genuinely mutated (it is the spring instance's home); it cannot be
// Readonly without breaking the lazy-init contract.
const ensureSpring = (ref: { current: Spring | null }, config: Readonly<EnsureSpringConfig>): void => {
  ref.current ??= createSpring(config.initial, config.stiffness, config.damping, config.onUpdate);
};

export { ensureSpring };
export type { EnsureSpringConfig };
