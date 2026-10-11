// Hover push: bklit's applyHoverGrow moves sectors and labels on the hovered path outward as a CSS transform on its 420ms curve; each sector publishes a `SectorPush` (bisector translate + centre scale).
// Each element gets `--sb-t<i>` / `--sb-m<i>` (sectors), `--sb-pt<i>` / `--sb-pm<i>` (overlays) or `--sb-lt<i>` (labels); rules per arc index (up to PUSH_CAP) read them.
import { hoverGrowForPathSegment, hubScale, ID_SEP, ringOptions } from "./arcs";
import type { ArcDatum } from "./arcs";

/** Arcs beyond this index are not pushed (rules are emitted per arc, up to this many). */
export const PUSH_CAP = 128;
// bklit growControls: duration 0.42, ease [0.22, 1, 0.36, 1]
const PUSH_MS = 420;
const PUSH_EASING = "cubic-bezier(.22,1,.36,1)";
const FIT_STEPS = 6;
const NORMAL_EQUATIONS = 3;
const F3 = 1000;

/** Affine fit of one unit radial field: displacement = slide * u + (stretchU * x) u + (stretchV * y) v in the bisector frame. */
interface FieldFit {
  readonly slide: number;
  readonly stretchU: number;
  readonly stretchV: number;
}

export interface SectorPush {
  /** Sector bisector, radians clockwise from 12 o'clock. */
  readonly bisector: number;
  /** Label direction (the sector centroid angle), radians clockwise from 12 o'clock. */
  readonly labelAngle: number;
  /** Radial thickness of the ring in px. */
  readonly thickness: number;
  /** Radial and angular extent at rest (angles clockwise from 12 o'clock, `halfSweep` either side of the bisector). */
  readonly minR: number;
  readonly maxR: number;
  readonly halfSweep: number;
  /** Whole sector moved radially by 1 (per unit of ancestor push). */
  readonly shift: FieldFit;
  /** Outer edge moved by 1 while the inner edge stays (per unit of own grow); linear in the radius. */
  readonly grow: FieldFit;
}

export interface SectorExtent {
  readonly minR: number;
  readonly maxR: number;
  /** Angular extent relative to the sector's reference angle. */
  readonly minD: number;
  readonly maxD: number;
}

const subtractRow = (m: number[][], row: number, col: number, factor: number): void => {
  for (let k = col; k <= NORMAL_EQUATIONS; k += 1) {
    (m[row])[k] = (m[row]?.[k] ?? 0) - factor * (m[col]?.[k] ?? 0);
  }
};

const eliminate = (m: number[][], col: number, lead: number): void => {
  for (let row = 0; row < NORMAL_EQUATIONS; row += 1) {
    const factor = (m[row]?.[col] ?? 0) / lead;
    if (row !== col && factor !== 0) {
      subtractRow(m, row, col, factor);
    }
  }
};

const solve3 = (a: number[][], b: number[]): number[] => {
  const n = NORMAL_EQUATIONS;
  const m = a.map((row, i) => [...row, b[i] ?? 0]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) {
        pivot = row;
      }
    }
    const swap = m[col] ?? [];
    m[col] = m[pivot] ?? [];
    m[pivot] = swap;
    const lead = m[col]?.[col] ?? 0;
    const singular = Math.abs(lead) < 1e-12;
    if (!singular) {
      eliminate(m, col, lead);
    }
  }
  return m.map((row, i) => {
    const diagonal = row[i] ?? 0;
    return diagonal === 0 ? 0 : (row[n] ?? 0) / diagonal;
  });
};

const accumulate = (normal: number[][], rhs: number[], basis: readonly (readonly [number, number])[], target: readonly [number, number]): void => {
  for (let a = 0; a < NORMAL_EQUATIONS; a += 1) {
    const ba = basis[a] ?? [0, 0];
    (rhs)[a] = (rhs[a] ?? 0) + ba[0] * target[0] + ba[1] * target[1];
    for (let b = 0; b < NORMAL_EQUATIONS; b += 1) {
      const bb = basis[b] ?? [0, 0];
      (normal[a])[b] = (normal[a]?.[b] ?? 0) + ba[0] * bb[0] + ba[1] * bb[1];
    }
  }
};

const fitField = (extent: SectorExtent, weightAt: (r: number) => number): FieldFit => {
  const half = (extent.maxD - extent.minD) / 2;
  const normal = Array.from({ length: NORMAL_EQUATIONS }, () => Array.from({ length: NORMAL_EQUATIONS }, () => 0));
  const rhs = Array.from({ length: NORMAL_EQUATIONS }, () => 0);
  for (let i = 0; i <= FIT_STEPS; i += 1) {
    for (let j = 0; j <= FIT_STEPS; j += 1) {
      const r = extent.minR + ((extent.maxR - extent.minR) * i) / FIT_STEPS;
      const f = -half + (2 * half * j) / FIT_STEPS;
      const x = r * Math.cos(f);
      const y = r * Math.sin(f);
      // Basis columns (du, dv) for [slide, stretchU, stretchV]; target is the weighted radial vector in the bisector frame.
      const basis: readonly (readonly [number, number])[] = [[1, 0], [x, 0], [0, y]];
      const weight = weightAt(r);
      accumulate(normal, rhs, basis, [weight * Math.cos(f), weight * Math.sin(f)]);
    }
  }
  const [slide = 0, stretchU = 0, stretchV = 0] = solve3(normal, rhs);
  return { slide, stretchU, stretchV };
};

/** Least-squares fits of bklit's two radial fields over an annular sector: a whole-sector shift and the outer-edge grow
 * (weight 0 inner, 1 outer). Exact on the bisector; the residual grows with angular width. */
export const fitSectorPush = (extent: SectorExtent, reference: number, labelAngle: number): SectorPush => {
  const thickness = extent.maxR - extent.minR;
  return {
    bisector: reference + (extent.maxD + extent.minD) / 2,
    labelAngle,
    thickness,
    minR: extent.minR,
    maxR: extent.maxR,
    halfSweep: (extent.maxD - extent.minD) / 2,
    shift: fitField(extent, () => 1),
    grow: fitField(extent, (r) => (thickness > 0 ? (r - extent.minR) / thickness : 0)),
  };
};

const round3 = (value: number): number => Math.round(value * F3) / F3;

interface PushValues {
  readonly translate: string;
  readonly transform: string;
}

/** CSS `translate` and `transform` values for a sector moved outward by `p` px with its outer edge grown by `g` px. */
const sectorPushValues = (push: SectorPush, p: number, g: number): PushValues => {
  const slide = p * push.shift.slide + g * push.grow.slide;
  const frame = push.bisector - Math.PI / 2;
  const scaleU = 1 + p * push.shift.stretchU + g * push.grow.stretchU;
  const scaleV = 1 + p * push.shift.stretchV + g * push.grow.stretchV;
  return {
    transform: `rotate(${round3(frame)}rad) scale(${round3(scaleU)},${round3(scaleV)}) rotate(${round3(-frame)}rad)`,
    translate: `${round3(Math.sin(push.bisector) * slide)}px ${round3(-Math.cos(push.bisector) * slide)}px`,
  };
};

/** Id of the sector under a point given relative to the chart centre (null over the hub, the gaps and outside the ring). */
export const sectorAtPoint = (sectors: ReadonlyMap<string, SectorPush>, dx: number, dy: number): string | null => {
  const r = Math.hypot(dx, dy);
  const angle = Math.atan2(dx, -dy);
  for (const [id, sector] of sectors) {
    const delta = Math.atan2(Math.sin(angle - sector.bisector), Math.cos(angle - sector.bisector));
    if (r >= sector.minR && r <= sector.maxR && Math.abs(delta) <= sector.halfSweep) {
      return id;
    }
  }
  return null;
};

const onPath = (arc: ArcDatum, hovered: ArcDatum): boolean => arc.id === hovered.id || hovered.id.startsWith(`${arc.id}${ID_SEP}`);

interface PushInput {
  readonly arcs: readonly ArcDatum[];
  readonly sectors: ReadonlyMap<string, SectorPush>;
  readonly hovered: ArcDatum | null;
  readonly focusDepth: number;
  readonly maxDepth: number;
  readonly popOut: number;
}

/** bklit's per-arc grow for the hovered path (buildHoverGrowTargets): one segment grow for the visible path length,
 * capped at one expanded first-level ring (maxHoverSegmentThickness). */
const growTargets = ({ arcs, sectors, hovered, focusDepth, maxDepth, popOut }: Readonly<PushInput & { readonly hovered: ArcDatum }>): Map<string, number> => {
  const targets = new Map<string, number>();
  const ringWidth = sectors.get(hovered.id)?.thickness ?? 0;
  if (ringWidth <= 0) {
    return targets;
  }
  const radius = (ringWidth * Math.max(1, maxDepth - focusDepth)) / (1 - hubScale(focusDepth) / Math.max(1, maxDepth));
  const reference = ringOptions(1, maxDepth, radius).ringWidth;
  const maxExpanded = reference + hoverGrowForPathSegment(popOut, reference, 1);
  const segmentGrow = hoverGrowForPathSegment(popOut, ringWidth, Math.max(1, hovered.depth - focusDepth));
  for (const arc of arcs) {
    const sector = sectors.get(arc.id);
    if (sector !== undefined && arc.depth > focusDepth && onPath(arc, hovered)) {
      targets.set(arc.id, sector.thickness >= maxExpanded ? 0 : Math.min(segmentGrow, maxExpanded - sector.thickness));
    }
  }
  return targets;
};

// The vars live on the elements that read them: one written on the host restyles its whole subtree (about 1 ms for 140 nodes), on an element only that element.
const desiredVars = new WeakMap<HTMLElement, Map<string, string>>();
const VAR_NAME = /^--sb-(t|m|pt|pm|lt)(\d+)$/;

const classOfVar = (name: string): string => {
  const [, kind = "", index = ""] = VAR_NAME.exec(name) ?? [];
  if (kind === "lt") { return `bk-sb-l-${index}`; }
  return kind.startsWith("p") ? `bk-sb-p${index}` : `bk-sb-a${index}`;
};

const applyVar = (host: HTMLElement, name: string, value: string | undefined): void => {
  for (const element of host.querySelectorAll<SVGElement>(`.${classOfVar(name)}`)) {
    if (value === undefined) { element.style.removeProperty(name); } else { element.style.setProperty(name, value); }
  }
};

/** Re-applies the wanted vars after the sector layer painted: its elements are created by the scene, not by hover. */
export const reapplyPush = (host: HTMLElement | null): void => {
  const desired = host === null ? undefined : desiredVars.get(host);
  if (host !== null && desired !== undefined) {
    for (const [name, value] of desired) { applyVar(host, name, value); }
  }
};

const setVar = (host: HTMLElement, name: string, value: string | null): void => {
  const desired = desiredVars.get(host) ?? new Map<string, string>();
  desiredVars.set(host, desired);
  if (desired.get(name) === (value ?? undefined)) { return; }
  if (value === null) { desired.delete(name); } else { desired.set(name, value); }
  applyVar(host, name, value ?? undefined);
};

const setPair = (host: HTMLElement, translateVar: string, transformVar: string, values: PushValues | null): void => {
  setVar(host, translateVar, values === null ? null : values.translate);
  setVar(host, transformVar, values === null ? null : values.transform);
};

/** Sum of the grow targets of an arc's ancestors. */
const ancestorPush = (arc: ArcDatum, byId: ReadonlyMap<string, ArcDatum>, targets: ReadonlyMap<string, number>): number => {
  let push = 0;
  let parent = arc.parentId === null ? undefined : byId.get(arc.parentId);
  while (parent !== undefined) {
    push += targets.get(parent.id) ?? 0;
    parent = parent.parentId === null ? undefined : byId.get(parent.parentId);
  }
  return push;
};

const writeArcPush = (host: HTMLElement, index: number, sector: SectorPush | undefined, push: number, own: number | undefined): void => {
  // Sector: moves with its grown ancestors. Overlay (the on-path copy at full opacity): also grows its own outer edge.
  setPair(host, `--sb-t${index}`, `--sb-m${index}`, sector === undefined || push === 0 ? null : sectorPushValues(sector, push, 0));
  setPair(host, `--sb-pt${index}`, `--sb-pm${index}`, sector === undefined || own === undefined ? null : sectorPushValues(sector, push, own));
  // bklit centres the label on the pushed (and, on the hovered path, grown) sector.
  const shift = push + (own ?? 0) / 2;
  setVar(host, `--sb-lt${index}`, sector === undefined || shift === 0 ? null : `${round3(Math.sin(sector.labelAngle) * shift)}px ${round3(-Math.cos(sector.labelAngle) * shift)}px`);
};

/** Writes (or clears) the push vars for the hovered arc on `host`. Reads only the published sector table; never touches the chart definition. */
export const writePush = (host: HTMLElement, input: Readonly<PushInput>): void => {
  const { arcs, sectors, hovered } = input;
  const targets = hovered === null ? new Map<string, number>() : growTargets({ ...input, hovered });
  const byId = new Map(arcs.map((arc) => [arc.id, arc]));
  for (const arc of arcs) {
    if (arc.arcIndex < PUSH_CAP) {
      writeArcPush(host, arc.arcIndex, sectors.get(arc.id), ancestorPush(arc, byId, targets), targets.get(arc.id));
    }
  }
};

const ease = `${PUSH_MS}ms ${PUSH_EASING}`;
/** Transition for the pushed properties (not natively tweened, so no motion-role guard). */
export const PUSH_TRANSITION = `translate ${ease},transform ${ease}`;
/** Labels are pushed by `translate` only: their `transform` is the rotation the zoom tween writes every frame, which a transition would drag behind the text. */
export const LABEL_PUSH_TRANSITION = `translate ${ease}`;

/** One rule per arc index below `count`: sectors read `--sb-t/--sb-m`, path overlays `--sb-pt/--sb-pm`, labels `--sb-lt`; `data-bk-path` shows the
 * hovered arc's ancestors' overlays at once (bklit's path arcs are already opaque), even mid-zoom. */
export const pushCss = (count: number): string => Array.from(
  { length: Math.min(count, PUSH_CAP) },
  (_, i) => `.bk-sb-a${i}{translate:var(--sb-t${i},0 0);transform:var(--sb-m${i},none)}.bk-sb-p${i}{translate:var(--sb-pt${i},0 0);transform:var(--sb-pm${i},none)}.bk-sb-l-${i}{translate:var(--sb-lt${i},0 0)}[data-bk-path~="${i}"] g.bk-sb-pops .bk-sb-p${i}{opacity:1;transition:${PUSH_TRANSITION}}`,
).join("");

/** Rules per arc index below `count`: the hovered arc's descendants stay opaque, the arcs on its path step aside (instantly) for the overlay. */
export const sectorEmphasisCss = (sector: string, count: number): string =>
  Array.from({ length: Math.min(count, PUSH_CAP) }, (_, i) => `[data-bk-pop="${i}"] ${sector}.bk-sb-u${i}{opacity:1}`).join("") +
  Array.from({ length: Math.min(count, PUSH_CAP) }, (_, i) => `[data-bk-path~="${i}"] ${sector}.bk-sb-a${i}{opacity:0;transition:none}`).join("");
