import { defineChart } from "@tanstack/charts/scene";
import { erase } from "../kit/erased-types";
import type { DomChartDefinition, ChartCursorController, ChartMotionContext, ChartMotionTransition, ChartPoint, ChartScene } from "@tanstack/charts";
import { cursorHost } from "@tanstack/charts/cursor";
import { polar } from "@tanstack/charts/polar";
import { REVEAL_EASING } from "../kit/motion/easing";
import { buildEnterDelays, buildRows, hubScale } from "./arcs";
import type { Focus, SunburstModel } from "./arcs";
import type { SunburstLabelsProps } from "./carriers";
import { defaultSunburstColors, sunburstCssVars } from "./colors";
import { ZOOM_EASING, ZOOM_MS } from "./easing";
import { createSunburstFocus } from "./focus";
import { END_ANGLE, hubMark, isHub, START_ANGLE } from "./hub";
import type { SunburstDatum } from "./hub";
import { labelsOption } from "./labels";
import { sectorAtPoint } from "./push";
import type { SectorPush } from "./push";
import { sectorArc } from "./geometry";
import { nativeSunburst } from "./sunburst-mark";
import type { SectorFeed } from "./sunburst-layer";
import type { SectorTrail, SunburstNativeNode } from "./sunburst-mark";

const EXIT_MS = 320;
const revealEase: (t: number) => number = REVEAL_EASING;
const middle = (values: readonly number[]): number => (Math.min(...values) + Math.max(...values)) / 2;

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Centre of the bounding box of an annular sector (angles clockwise from 12 o'clock), as the SVG fill-box origin sees it. */
const sweptArcBox = (lead: number, span: number, inner: number, outer: number): Point => {
  const angles = [lead, lead + span];
  for (let k = Math.ceil(lead / (Math.PI / 2)); k * (Math.PI / 2) <= lead + span; k += 1) {
    angles.push(k * (Math.PI / 2));
  }
  const xs = angles.flatMap((a) => [inner * Math.sin(a), outer * Math.sin(a)]);
  const ys = angles.flatMap((a) => [-inner * Math.cos(a), -outer * Math.cos(a)]);
  return { x: middle(xs), y: middle(ys) };
};

/** What `sectorMotion` hands the renderer: a tween or nothing (the caller falls back to the zoom tween). */
type SectorMotion = { readonly delay?: number; readonly transition: ChartMotionTransition } | undefined;

interface DefinitionInput {
  readonly model: SunburstModel;
  readonly focus: Focus;
  readonly fillOf: (nodeId: string) => string;
  readonly hasCenter: boolean;
  readonly labels: SunburstLabelsProps | null;
  readonly sweepMs: number;
  readonly enterStaggerScale: number;
  /** What the sector layer paints (filled by the mark on every render) and the layer renderer itself. */
  readonly feed: SectorFeed;
  readonly sectorRenderer: Parameters<typeof nativeSunburst>[3];
  /** True while the entrance runs: per-segment delays apply to the radial growth and labels. Read lazily by the motion callback so the end of the entrance does not rebuild the definition (a rebuild re-runs an 850ms no-op update tween). */
  readonly isIntro: () => boolean;
  /** Chart centre in scene coordinates, from the last render. */
  readonly center: () => { readonly x: number; readonly y: number } | null;
  readonly controlled: boolean;
  /** Clock (performance.now) of the mount effect that starts bklit's per-segment motion clocks; the intro's tweens run on that schedule. */
  readonly introAt: () => number | null;
  readonly hoverPop: number;
  readonly padding: number;
  readonly controller: ChartCursorController<number, number>;
  readonly registry: Map<string, ChartPoint<SunburstNativeNode, number, number>>;
  readonly trail: SectorTrail;
  /** Filled by the mark on every render with each sector's radial-push fit (read by the hover effect). */
  readonly pushes: Map<string, SectorPush>;
  /** Last rendered scene, for the focus strategy's pointer resolution. */
  readonly scene: () => ChartScene<SunburstDatum, number, number> | null;
  /** Records whether the last select came from the keyboard (zoom hands focus to a node only then). */
  readonly noteSource: (source: "pointer" | "keyboard") => void;
  /** True while a pointer move is dispatched (see usePointerHold). */
  readonly moving: () => boolean;
  /** Id of the sector the hover store holds, if any. */
  readonly hoveredId: () => string | null;
}

export const buildDefinition = (input: Readonly<DefinitionInput>): DomChartDefinition<SunburstDatum, number, number> => {
  const { model, focus, fillOf, hasCenter, labels, sweepMs, enterStaggerScale, feed, sectorRenderer, isIntro, center, controlled, introAt, hoverPop, padding, controller, registry, pushes, trail, scene, noteSource, moving, hoveredId } = input;
  const { maxDepth, arcs } = model;
  const arcById = new Map(arcs.map((arc) => [arc.id, arc]));
  const enter = buildEnterDelays(arcs, enterStaggerScale);
  const hubFraction = hubScale(focus.depth);
  const hubRadius = (radius: number): number => (radius / Math.max(1, maxDepth)) * hubFraction;
  // bklit keeps ring thickness tied to the deepest level of the whole tree, so a shallow branch does not stretch to the rim.
  let subtreeRings = 1;
  for (const arc of arcs) {
    if (arc.id.startsWith(`${focus.id} / `)) {
      subtreeRings = Math.max(subtreeRings, arc.depth - focus.depth);
    }
  }
  const ringWidthOf = (radius: number): number => (radius - hubRadius(radius)) / Math.max(1, maxDepth - focus.depth);
  // bklit's centre disc fill (sunburst-center.tsx:30-33): the background at the root, else the focus's category colour; it switches at once.
  const hubFill = focus.depth === 0 ? sunburstCssVars.background : (defaultSunburstColors[focus.categoryIndex % defaultSunburstColors.length] ?? sunburstCssVars.slice1);

  const sectorMotion = (context: ChartMotionContext<SunburstNativeNode>): SectorMotion => {
    // Only the centre disc is native motion now; sectors and labels are tweened by the sector layer (sunburst-layer.ts).
    if (context.phase === "enter") {
      return {
        delay: isIntro() ? (enter.delays.get(context.datum?.id ?? "") ?? 0) : 0,
        transition: { duration: sweepMs, easing: REVEAL_EASING, type: "tween" },
      };
    }
    if (context.phase === "exit") {
      return { transition: { duration: EXIT_MS, easing: "ease-out", type: "tween" } };
    }
    return undefined;
  };

  // bklit's hit path is arcPath(base, p, 1) under a scale(p) about its own box centre (sunburst-segment.tsx:98-100,111-137), p being the sector's eased enter progress.
  const swept = (datum: SunburstDatum, x: number, y: number): boolean => {
    const at = center();
    const push = pushes.get(datum.id);
    const start = introAt();
    if (!isIntro() || at === null || push === undefined || start === null) {
      return true;
    }
    const local = (performance.now() - start - (enter.delays.get(datum.id) ?? 0)) / sweepMs;
    const progress = revealEase(Math.min(1, Math.max(0, local)));
    if (progress <= 0) {
      return false;
    }
    const lead = push.bisector - push.halfSweep;
    const span = 2 * push.halfSweep * progress;
    const inner = push.minR < 1 ? 0 : push.minR;
    const outer = inner + (push.maxR - inner) * progress;
    const box = sweptArcBox(lead, span, inner, outer);
    const qx = box.x + (x - at.x - box.x) / progress;
    const qy = box.y + (y - at.y - box.y) / progress;
    const sweep = (Math.atan2(qx, -qy) - lead + 4 * Math.PI) % (2 * Math.PI);
    const radius = Math.hypot(qx, qy);
    return sweep <= span && radius >= inner && radius <= outer;
  };

  const rows = buildRows(model);
  const sectorLabels = labelsOption(labels, arcById);
  const sunburstMark = nativeSunburst(
    rows,
    {
      className: "bk-sb-mark",
      fill: (node) => fillOf(node.id),
      id: "sunburst",
      innerRadius: ({ radius }) => hubRadius(radius),
      outerRadius: ({ radius }) => hubRadius(radius) + ringWidthOf(radius) * subtreeRings,
      nodeId: "id",
      parentId: "parentId",
      rootId: focus.id,
      stroke: sunburstCssVars.ring,
      strokeWidth: 1,
      value: "value",
    },
    {
      arcIndexOf: (node) => arcById.get(node.id)?.arcIndex,
      depthOf: (node) => arcById.get(node.id)?.depth,
      pushes,
      arcOf: (node, layout) => {
        const arc = arcById.get(node.id);
        if (arc === undefined) {
          return undefined;
        }
        const outer = hubRadius(layout.radius) + ringWidthOf(layout.radius) * subtreeRings;
        // d3 arc angles, as the native sunburst feeds them: the polar layout's own start and end.
        return sectorArc({ endAngle: layout.endAngle, inner: hubRadius(layout.radius), outer, rings: subtreeRings, rootEnd: focus.a1, rootStart: focus.a0, startAngle: layout.startAngle }, arc.a0, arc.a1, arc.depth - focus.depth);
      },
      delayOf: (node) => (isIntro() ? (enter.delays.get(node.id) ?? 0) : 0),
      feed,
      sweepMs,
      view: focus.id,
      popOut: hoverPop,
      registry,
      trail,
      labels: sectorLabels,
    },
    sectorRenderer,
  );

  const polarMarks = hasCenter ? [sunburstMark, hubMark(hubRadius, hubFill)] : [sunburstMark];
  const motion = (context: ChartMotionContext): SectorMotion => sectorMotion(erase(context)) ?? { transition: { duration: ZOOM_MS, easing: ZOOM_EASING, type: "tween" } };
  return erase(defineChart({
    // Drilled in, the view's root is not drawn as an arc (the hub disc stands for it), so its point is no keyboard stop.
    focus: createSunburstFocus<SunburstDatum>({
      orderOf: (datum) => {
        if (isHub(datum)) {return focus.depth > 0 ? -1 : undefined;}
        const arc = arcById.get(datum.id);
        // Only the sectors drawn in this view: descendants of the view's root. Arcs elsewhere in the tree keep zero-size points.
        return arc === undefined || !arc.id.startsWith(`${focus.id} / `) ? undefined : arc.arcIndex;
      },
      scene,
      swept,
      // Over the hub, gaps and empty corners a move keeps the last sector hovered; the native chart would drop focus there.
      heldAt: (x, y) => {
        const at = center();
        if (!moving() || at === null || sectorAtPoint(pushes, x - at.x, y - at.y) !== null) {
          return undefined;
        }
        const id = hoveredId();
        return id === null ? null : (registry.get(id) ?? null);
      },
    }),
    // `change` runs before `onSelect` for both pointer and keyboard selects (renderer.ts:830,868).
    selection: { change: (_point, source) => { noteSource(source); }, type: "keyed" },
    focusRing: false,
    keyboard: true,
    margin: 0,
    marks: [
      polar({
        endAngle: END_ANGLE,
        inset: padding,
        marks: polarMarks,
        scales: { angle: null, radius: null },
        startAngle: START_ANGLE,
      }),
    ],
    // Only a controlled hoveredIndex drives focus through the controller; pointer focus is the renderer's own.
    cursor: controlled ? { controller, match: "xy", mode: "focus", use: cursorHost } : undefined,
    motion,
    scales: { x: null, y: null },
  }));
};
