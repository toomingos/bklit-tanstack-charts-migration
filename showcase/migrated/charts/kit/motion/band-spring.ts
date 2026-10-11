// Hover band (bklit use-highlight-segment.ts): x and width are two 180/28 springs that keep velocity across retargets; a rAF
// integrator writes `--bkm-hs0/1` (a CSS transition would restart at zero velocity). UPSTREAM-GAPS #31: `states` hover repaints the scene.
import { restOf, springOf } from "./spring-curve";
import { HIGHLIGHT_SPRING } from "./springs";
import { writeVar } from "../host-write";

interface Axis {
  target: number;
  /** Displacement from `target` and velocity (px/s) at `t0`. */
  x0: number;
  v0: number;
  t0: number;
}

interface Band {
  readonly x: Axis;
  readonly w: Axis;
  frame: number;
}

interface AxisSample {
  readonly value: number;
  readonly velocity: number;
  readonly rest: boolean;
}

const bands = new WeakMap<HTMLElement, Band>();

const read = (axis: Axis, now: number): AxisSample => {
  const sample = springOf(HIGHLIGHT_SPRING, restOf(axis.x0)).sample(now - axis.t0, { from: axis.x0, to: 0, velocity: axis.v0 });
  return { rest: sample.done, value: axis.target + sample.value, velocity: sample.velocity };
};

const retarget = (axis: Axis, target: number, now: number, jump: boolean): void => {
  const live = jump ? { value: target, velocity: 0 } : read(axis, now);
  axis.x0 = live.value - target;
  axis.v0 = live.velocity;
  axis.target = target;
  axis.t0 = now;
};

const write = (host: HTMLElement, lo: number, hi: number): void => {
  writeVar(host, "--bkm-hs0", lo.toFixed(2));
  writeVar(host, "--bkm-hs1", hi.toFixed(2));
};

const tick = (host: HTMLElement, band: Band, now: number): void => {
  band.frame = 0;
  if (!host.isConnected) { return; }
  const x = read(band.x, now);
  const w = read(band.w, now);
  if (x.rest && w.rest) {
    write(host, band.x.target, band.x.target + band.w.target);
    return;
  }
  write(host, x.value, x.value + w.value);
  // Frame loop standing in for bklit's motion springs (use-highlight-segment.ts:44-57); runs only while one is in flight.
  band.frame = requestAnimationFrame((next) => {
    tick(host, band, next);
  });
};

/** Springs the host's highlight band to [`lo`, `hi`] (svg px); `jump` places it there at once (the hover just entered). */
const springBand = (host: HTMLElement, lo: number, hi: number, jumpRequested: boolean): void => {
  const now = performance.now();
  let band = bands.get(host);
  const jump = jumpRequested || band === undefined;
  if (band === undefined) {
    band = { frame: 0, w: { t0: now, target: 0, v0: 0, x0: 0 }, x: { t0: now, target: 0, v0: 0, x0: 0 } };
    bands.set(host, band);
  }
  retarget(band.x, lo, now, jump);
  retarget(band.w, hi - lo, now, jump);
  if (jump) {
    if (band.frame !== 0) { cancelAnimationFrame(band.frame); band.frame = 0; }
    write(host, lo, hi);
    return;
  }
  if (band.frame === 0) {
    const live = band;
    // Frame loop standing in for bklit's motion springs (use-highlight-segment.ts:44-57); runs only while one is in flight.
    live.frame = requestAnimationFrame((frameNow) => {
      tick(host, live, frameNow);
    });
  }
};

export { springBand };
