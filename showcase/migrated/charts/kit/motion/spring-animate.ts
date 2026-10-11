// Velocity-preserving hover springs on WAAPI: each change samples the running animation and replays a fresh spring from it; rest/hot stay static CSS.
// UPSTREAM-GAPS #31 (mark `states` repaint the scene on hover) and #50 (callers skip mid-tween nodes).
import type { ChartSpringState } from "@tanstack/charts/spring";
import { restOf, settleMs, springOf } from "./spring-curve";
import type { Spring } from "./springs";

const FRAME_MS = 1000 / 120;
const MAX_MS = 20_000;

interface LiveSample {
  readonly value: number;
  readonly velocity: number;
}

interface SpringState {
  readonly spring: Spring;
  readonly target: number;
  readonly x0: number;
  readonly v0: number;
  /** Milliseconds the animation waits (holding its first frame) before the spring starts. */
  readonly delay: number;
  readonly animation: Animation | null;
}

interface SpringJob {
  readonly el: Element;
  readonly spring: Spring;
  /** Value the element settles on (its static CSS rule holds the same value). */
  readonly target: number;
  /** Value the element was resting at before this change; used when it has no spring state yet. */
  readonly rest: number;
  /** Start from this value at zero velocity instead of the live state (the element was just remounted at rest). */
  readonly from?: number;
  /** The keyframe that paints `value` (the scalar the spring runs on: px, scale delta, radius ...). */
  readonly frame: (value: number) => Keyframe;
  /** motion's `transition.delay`: the element holds its current value for this many ms, then springs. A retarget during the delay restarts it. */
  readonly delay?: number;
}

interface SpringDriver {
  readonly play: (job: Readonly<SpringJob>) => void;
  /** Live value of an element the driver has played (analytic, no DOM read); undefined when it has never been driven. */
  readonly value: (el: Element) => number | undefined;
}

const createSpringDriver = (): SpringDriver => {
  const states = new WeakMap<Element, SpringState>();

  /** Live value and velocity of an element: from its running animation's clock, or at rest on its last target when none is running. */
  const live = (el: Element, rest: number): LiveSample => {
    const state = states.get(el);
    const animation = state?.animation;
    if (state === undefined || animation === null || animation === undefined || animation.playState !== "running") {
      return { value: state === undefined ? rest : state.target, velocity: 0 };
    }
    const seconds = (Number(animation.currentTime ?? 0) - state.delay) / 1000;
    // Still inside the delay: the element holds the state the spring will start from.
    if (seconds <= 0) { return { value: state.target + state.x0, velocity: state.v0 }; }
    const sample = springOf(state.spring, restOf(state.x0)).sample(seconds * 1000, { from: state.x0, to: 0, velocity: state.v0 });
    return { value: state.target + sample.value, velocity: sample.velocity };
  };

  return {
    value: (el) => (states.has(el) ? live(el, 0).value : undefined),
    play: ({ el, spring, target, rest, from, frame, delay = 0 }) => {
      const start = from === undefined ? live(el, rest) : { value: from, velocity: 0 };
      states.get(el)?.animation?.cancel();
      const x0 = start.value - target;
      const thresholds = restOf(x0);
      if (Math.abs(x0) <= thresholds.delta && Math.abs(start.velocity) <= thresholds.speed) {
        states.set(el, { animation: null, delay: 0, spring, target, v0: 0, x0: 0 });
        return;
      }
      const native = springOf(spring, thresholds);
      const state: ChartSpringState = { from: x0, to: 0, velocity: start.velocity };
      const duration = settleMs(native, state, FRAME_MS, MAX_MS);
      const frames: Keyframe[] = [];
      for (let ms = 0; ms < duration; ms += FRAME_MS) { frames.push(frame(target + native.sample(ms, state).value)); }
      frames.push(frame(target));
      const animation = el.animate(frames, { delay, duration, easing: "linear", fill: delay > 0 ? "backwards" : "none" });
      // After the last keyframe the element falls back to the static CSS rule, which holds the same target.
      states.set(el, { animation, delay, spring, target, v0: start.velocity, x0 });
    },
  };
};

/** One driver for every chart on the page: its state is keyed by element, so a handler that is rebuilt (new rows, new size) still finds the running animation. */
const springDriver = createSpringDriver();

export { springDriver };
