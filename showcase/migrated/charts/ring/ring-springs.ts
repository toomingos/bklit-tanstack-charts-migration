// Ring hover pop as bklit's 400/25 motion spring (ring.tsx: the hovered ring scales 1.03, the rings outside it 1.02), drawn on the Web Animations API so a
// hover reversal keeps the arcs' velocity (kit/motion/spring-animate.ts). The static rules in styles.css hold the hot value and the dim opacity tween.
import { isMotionNode } from "../kit/renderer-dom";
import { springDriver } from "../kit/motion/spring-animate";
import { HOVER_SPRING } from "../kit/motion/springs";
import { MAX_INDEX, RING_HOVER_SCALE, RING_PUSHED_SCALE } from "../kit/polar/polar-dim";

/** Scale delta of ring `index` while `hovered` is the focused ring (outer rings, drawn after it, are pushed). */
const ringTarget = (index: number, hovered: number | null): number => {
  if (hovered === null) { return 0; }
  if (index === hovered) { return RING_HOVER_SCALE - 1; }
  return index > hovered ? RING_PUSHED_SCALE - 1 : 0;
};

/** One arc element per ring index of each host, recorded by `springRings`, so the hit test can read the live painted scale without a DOM query. */
const arcsByHost = new WeakMap<HTMLElement, Map<number, SVGElement>>();

/** Scale the painted ring `index` has right now (bklit hit-tests its live motion-scaled paths): the spring's analytic value when driven, else the static target for `hovered`. */
const liveRingScale = (host: HTMLElement | null, index: number, hovered: number | null): number => {
  const el = host === null ? undefined : arcsByHost.get(host)?.get(index);
  const value = el?.isConnected === true ? springDriver.value(el) : undefined;
  return 1 + (value ?? ringTarget(index, hovered));
};

/** Hosts whose CSS entrance has finished: the entrance scan (a forced style flush inside the pointer task) is skipped for them until a CSS animation starts again. */
const settledHosts = new WeakSet<HTMLElement>();

/** Elements whose CSS entrance keyframes are running now (they own the track's transform); only a CSSAnimation counts, the hover's opacity CSSTransition runs on dimmed tracks. */
const enteringElements = (host: HTMLElement): ReadonlySet<Element | null> => {
  if (settledHosts.has(host)) { return new Set(); }
  // oxlint-disable-next-line no-restricted-properties -- one subtree read per hover change until the entrance ends, not per element after bulk mutations (AGENTS.md exception)
  const running = new Set(host.getAnimations({ subtree: true }).flatMap((animation) => (animation instanceof CSSAnimation && animation.playState === "running" && animation.effect instanceof KeyframeEffect ? [animation.effect.target] : [])));
  if (running.size === 0) {
    settledHosts.add(host);
    host.addEventListener("animationstart", () => { settledHosts.delete(host); }, { once: true });
  }
  return running;
};

/** Retargets every ring arc of `host` from its live scale and velocity to the delta of the new hovered ring. */
const springRings = (host: HTMLElement, previous: number | null, next: number | null): void => {
  const entering = enteringElements(host);
  const arcs = new Map<number, SVGElement>();
  arcsByHost.set(host, arcs);
  // Groups are addressed by the `bkm-rg-<row index>` className we set (ring-chart.tsx:89), no class read-back; WAAPI because `states` has no transform channel (UPSTREAM-GAPS #20/#36).
  const groups = Array.from({ length: MAX_INDEX }, (_, index) => ({ els: host.querySelectorAll<SVGElement>(`g.bkm-rg-arc.bkm-rg-${index}`), index }));
  for (const { els, index } of groups) {
    // A renderer-owned motion node is skipped (isMotionNode, UPSTREAM-GAPS #50).
    for (const el of [...els].filter((node) => !isMotionNode(node))) {
      const isTrack = el.classList.contains("bkm-rg-track");
      if (!arcs.has(index) || isTrack) { arcs.set(index, el); }
      const rest = ringTarget(index, previous);
      const target = ringTarget(index, next);
      if (rest !== target && !(isTrack && entering.has(el))) {
        springDriver.play({ el, frame: (value) => ({ transform: `scale(${1 + value})` }), rest, spring: HOVER_SPRING, target });
      }
    }
  }
};

export { liveRingScale, springRings };
