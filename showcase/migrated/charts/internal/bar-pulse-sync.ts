import { ensurePulseClipDef, MS_PER_SECOND, PULSE_WAVE_DURATION_S } from "./bar-pulse-clip";

// Imperative pulse clip + WAAPI sweep for bar-pulse-mark: scene clips are
// Rectangular-only (the wave needs the polygon), and the reconciler wipes
// Injected nodes. Split out so bar-pulse-mark.ts stays under the size limits.
// Held until bars finish growing ("ready"); absent under pulsePaused; no reduced-motion branch (legacy parity).

interface BarPulseLoopState {
  anim: Animation | undefined;
  geomKey: string | undefined;
}

const loopStates = new WeakMap<SVGGElement, BarPulseLoopState>();

// Loop state for one pulse group, created on first sync. Hoisted so syncBarPulseGroup stays short.
const getPulseLoopState = (group: SVGGElement): BarPulseLoopState => {
  const existing = loopStates.get(group);
  if (existing) {return existing;}
  const fresh: BarPulseLoopState = { anim: undefined, geomKey: undefined };
  loopStates.set(group, fresh);
  return fresh;
};

interface PulseSyncArgs {
  readonly group: SVGGElement;
  readonly active: boolean;
}

// Deactivation branch of the group sync; undefined means "handled, skip the group". Hoisted so syncBarPulseGroup stays short.
const preparePulseSync = (syncArgs: Readonly<PulseSyncArgs>): BarPulseLoopState | undefined => {
  const state = getPulseLoopState(syncArgs.group);
  if (syncArgs.active) {return state;}
  if (state.anim) {
    state.anim.cancel();
    state.anim = undefined;
    state.geomKey = undefined;
  }
  syncArgs.group.style.display = "none";
  return undefined;
};

interface PulseWaveNodes {
  silhouette: SVGPathElement;
  wave: SVGRectElement;
}

// Silhouette + wave scene nodes for one group; undefined when either is missing.
const queryPulseWaveNodes = (group: SVGGElement): PulseWaveNodes | undefined => {
  const silhouette = group.querySelector<SVGPathElement>(`path[data-ts-key$=":silhouette"]`);
  const wave = group.querySelector<SVGRectElement>(`rect[data-ts-key$=":wave"]`);
  if (!silhouette || !wave) {return undefined;}
  return { silhouette, wave };
};

interface PulseWaveAttributes {
  clipD: string;
  waveX: number;
  waveY: number;
  waveH: number;
  wave: SVGRectElement;
}

// Numeric wave attributes; hoisted so readPulseSyncState stays short.
const readPulseWaveAttributes = (silhouette: SVGPathElement, wave: SVGRectElement): PulseWaveAttributes | undefined => {
  const clipD = silhouette.getAttribute("d") ?? "";
  const waveX = Number(wave.getAttribute("x") ?? "0");
  const waveY = Number(wave.getAttribute("y") ?? "0");
  const waveH = Number(wave.getAttribute("height") ?? "0");
  if (!clipD || !Number.isFinite(waveY) || !Number.isFinite(waveH) || waveH <= 0) {return undefined;}
  return { clipD, wave, waveH, waveX, waveY };
};

interface PulseSyncReadArgs {
  readonly svgRoot: SVGSVGElement;
  readonly group: SVGGElement;
}

const pendingRetries = new WeakMap<SVGSVGElement, { count: number }>();
// Bounded: a genuinely-gone chart stops retrying after this many frames.
const MAX_PULSE_RETRY_FRAMES = 10;

const schedulePulseRetry = (svgRoot: SVGSVGElement, active: boolean): void => {
  let box = pendingRetries.get(svgRoot);
  if (!box) {
    box = { count: 0 };
    pendingRetries.set(svgRoot, box);
  }
  // Bounded: a genuinely-gone chart stops retrying after a few frames.
  if (box.count >= MAX_PULSE_RETRY_FRAMES) {return;}
  box.count += 1;
  requestAnimationFrame(() => {
    box.count = 0;
    syncBarPulseGroups(svgRoot, active);
  });
};

// Reads + validates one group's wave attributes; undefined schedules a retry and skips the group.
const readPulseSyncState = (readArgs: Readonly<PulseSyncReadArgs>): PulseWaveAttributes | undefined => {
  const nodes = queryPulseWaveNodes(readArgs.group);
  if (nodes === undefined) {
    schedulePulseRetry(readArgs.svgRoot, true);
    return undefined;
  }
  const attributes = readPulseWaveAttributes(nodes.silhouette, nodes.wave);
  if (attributes === undefined) {
    schedulePulseRetry(readArgs.svgRoot, true);
    return undefined;
  }
  return attributes;
};

/**
 * Topmost silhouette y (= lid's back edge): the sweep's end anchor. Odd token indices are y coords.
 *
 * @param {string} clipD - Silhouette path data; only the y token of each coordinate pair is read.
 * @returns {number} Smallest y in CSS pixels, or Infinity when the path holds no numeric tokens.
 */
const silhouetteMinY = (clipD: string): number => {
  let minY = Number.POSITIVE_INFINITY;
  const nums = clipD.match(/-?\d*\.?\d+/gu) ?? [];
  for (let i = 1; i < nums.length; i += 2) {
    const parsedValue = Number(nums[i]);
    if (Number.isFinite(parsedValue) && parsedValue < minY) {minY = parsedValue;}
  }
  return minY;
}

interface PulseTravelArgs {
  readonly svgRoot: SVGSVGElement;
  readonly group: SVGGElement;
  readonly clipD: string;
  readonly waveX: number;
  readonly waveY: number;
  readonly waveH: number;
}

interface PulseTravel {
  geomKey: string;
  clipId: string;
  travel: number;
}

// Clip + travel for one group; unhides the group once geometry validates (an unclipped wave must never paint).
const syncPulseClipAndTravel = (travelArgs: Readonly<PulseTravelArgs>): PulseTravel => {
  travelArgs.group.style.display = "";
  const minY = silhouetteMinY(travelArgs.clipD);
  // Root→tip travel; ease-in-out + Infinity mirrors legacy.
  const yEnd = (Number.isFinite(minY) ? minY : travelArgs.waveY) - travelArgs.waveH;
  const travel = yEnd - travelArgs.waveY;
  const geomKey = `${travelArgs.clipD}|${travelArgs.waveX}|${travelArgs.waveY}|${travelArgs.waveH}`;
  const clipId = ensurePulseClipDef(travelArgs.svgRoot, travelArgs.group, travelArgs.clipD);
  return { clipId, geomKey, travel };
};

interface PulseSweepArgs {
  readonly state: BarPulseLoopState;
  readonly group: SVGGElement;
  readonly wave: SVGRectElement;
  readonly clipId: string;
  readonly geomKey: string;
  readonly travel: number;
}

// Applies the clip and (re)starts the WAAPI sweep when geometry changed. Hoisted so syncBarPulseGroup stays short.
const applyPulseSweep = (sweepArgs: Readonly<PulseSweepArgs>): void => {
  const desiredClip = `url(#${sweepArgs.clipId})`;
  if (sweepArgs.group.getAttribute("clip-path") !== desiredClip) {sweepArgs.group.setAttribute("clip-path", desiredClip);}
  if (sweepArgs.state.geomKey === sweepArgs.geomKey && sweepArgs.state.anim) {return;}
  sweepArgs.state.anim?.cancel();
  sweepArgs.state.anim = sweepArgs.wave.animate(
    [{ transform: "translateY(0px)" }, { transform: `translateY(${sweepArgs.travel}px)` }],
    { duration: PULSE_WAVE_DURATION_S * MS_PER_SECOND, easing: "ease-in-out", iterations: Infinity },
  );
  sweepArgs.state.geomKey = sweepArgs.geomKey;
};

/**
 * Per-group step of syncBarPulseGroups; early returns skip one group (forEach-callback semantics).
 *
 * @param {Readonly<{ svgRoot: SVGSVGElement; group: SVGGElement; active: boolean }>} args - Group sync inputs; `svgRoot` owns clip defs and retry scheduling, `group` is the pulse group to sync, and `active` selects the sweep versus the hide branch.
 */
const syncBarPulseGroup = (args: Readonly<{ svgRoot: SVGSVGElement; group: SVGGElement; active: boolean }>): void => {
  const state = preparePulseSync({ active: args.active, group: args.group });
  if (state === undefined) {return;}
  const syncState = readPulseSyncState({ group: args.group, svgRoot: args.svgRoot });
  if (syncState === undefined) {return;}
  const travel = syncPulseClipAndTravel({ clipD: syncState.clipD, group: args.group, svgRoot: args.svgRoot, waveH: syncState.waveH, waveX: syncState.waveX, waveY: syncState.waveY });
  applyPulseSweep({ clipId: travel.clipId, geomKey: travel.geomKey, group: args.group, state, travel: travel.travel, wave: syncState.wave });
};

/**
 * Takes the chart's own SVG root directly; only `g.bkm-chart__bar-pulse` groups match.
 *
 * @param {SVGSVGElement} svgRoot - Chart's own SVG root; only `g.bkm-chart__bar-pulse` descendants are synced.
 * @param {boolean} active - True runs the clip sweep; false cancels loops and hides the groups.
 */
const syncBarPulseGroups = (svgRoot: SVGSVGElement, active: boolean): void => {
  const groups = svgRoot.querySelectorAll<SVGGElement>("g.bkm-chart__bar-pulse");
  for (const group of groups) {
    syncBarPulseGroup({ active, group, svgRoot });
  }
}

export { syncBarPulseGroups };
