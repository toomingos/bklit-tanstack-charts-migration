// Faithful port of the registry example (verified VALID per docs/LOG.md D32
// -- "second clean one"): repos/bklit-ui/packages/ui/registry/examples/
// sunburst-chart.tsx:
//
//   const { arcs } = buildArcs(data);
//   <SunburstChart data={data} size={360}>
//     {arcs.map((arc) => <SunburstSegment index={arc.arcIndex} key={arc.id} />)}
//     <SunburstCenter />
//     <SunburstLabels />
//     <SunburstHint />
//   </SunburstChart>
//
// This scenario swaps the registry's static sample data for this bench's
// seeded `generateSunburst`/`generateSunburstUpdate` (bench/data.ts) and the
// harness's `n` (D32: "n = TOTAL ARC COUNT at fixed depth 3"), keeping every
// other prop/default untouched (no `enterTransition`/`enterStaggerScale`/
// `hoverPop`/`padding` overrides) -- EXCEPT that `focusId`/`onFocusChange`
// are wired as CONTROLLED props (docs demo's pattern -- SunburstChartDemo in
// apps/web/components/docs/sunburst-chart-demo.tsx -- also does this; the
// registry example itself leaves focus uncontrolled, but D32's zoom-QA
// requirement needs an externally-drivable focus state, and the docs demo is
// the verified-working reference for how bklit expects that to be wired).
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SunburstChart,
  SunburstSegment,
  SunburstCenter,
  SunburstLabels,
  SunburstHint,
  buildArcs,
  buildSunburstEnterTiming,
  type ArcDatum,
} from "@bklitui/ui/charts";
import {
  generateSunburst,
  generateSunburstUpdate,
  type SeededSunburstNode,
} from "../../../data";
import { armBklitTimerSettle, armManualSettle } from "../bench/settle";
import { measureUpdatePaint } from "../bench/paint";

// registry example's own `size={360}` (mirrored exactly).
const SUNBURST_SIZE = 360;

// --- Settle detection (M1b) for this phase-less chart -----------------------
// `SunburstChartProps` (sunburst-chart.tsx) has no `onPhaseChange`/`status`
// prop -- like radar/heatmap/candlestick, there's no callback to observe
// reveal completion. Computed directly from source, not guessed (D32):
//
//   sunburst.ts `buildSunburstEnterTiming(arcs, staggerScale=1)`:
//     per-arc delay = (ringIndex*0.12 + indexWithinRing*0.08) * scale  (secs)
//     maxDelay      = the LARGEST such delay across all arcs            (secs)
//   sunburst-segment.tsx: each segment's own path tween runs
//     `useMountProgress(enterTransition, segmentDelay, ...)` -- since this
//     scenario doesn't pass `enterTransition` (matching the registry
//     example), that falls back to `DEFAULT_CHART_ENTER_TRANSITION`
//     (animation.ts): a 1100ms tween. So the LAST segment finishes at
//     `maxDelay*1000 + 1100` ms.
//   sunburst-labels.tsx: `labelsDelay = enterTiming.maxDelay + enterDuration*0.85`
//     (enterDuration = 1.1s, same fallback) = `maxDelay + 0.935s`, and labels
//     animate over their OWN 1100ms tween (same default) -- so labels finish
//     at `maxDelay*1000 + 935 + 1100` ms, which is LATER than the segments'
//     own `maxDelay*1000 + 1100` end (labels start 935ms after the last
//     segment BEGINS, not after it ends) -- labels are therefore always the
//     true last-to-finish element. Total settle:
//
//     settle(n) = maxDelay(n)*1000 + 935 + 1100 ms      (D32: "≈ maxDelay+2035ms")
//
// `maxDelay` itself only depends on ring COUNTS (ring index = depth-1, and
// each arc's position within its same-depth ring sorted by absolute angle --
// which, since `layoutNode` lays out children in array order with strictly
// increasing angular cursors, sorts to the SAME order regardless of the
// random seeded leaf values) -- i.e. it is a pure function of this
// generator's branching factors (`b1`,`b2`), not of the random values
// themselves. Rather than re-derive that invariance by hand, this computes
// `maxDelay` from the ACTUAL `arcs` built from this render's `data` via the
// real, imported `buildSunburstEnterTiming` (zero drift risk if any future
// bklit change alters the ring/index math).
function sunburstSettleMs(arcs: ArcDatum[]): number {
  const { maxDelay } = buildSunburstEnterTiming(arcs, 1);
  return maxDelay * 1000 + 935 + 1100;
}

// MOUNT settle arm (Fable edit, docs/LOG.md D51/D52 settle-arm alignment
// precedent): originally `armBklitTimerSettle(sunburstSettleMs(arcs))`,
// whose shared 2500ms `FALLBACK_MS` wedge-guard resolves BELOW the computed
// end whenever `sunburstSettleMs` exceeds it — true at the structural sizes
// AND at the n=27 gate (maxDelay alone can push past 2500ms), i.e. QA would
// capture mid-reveal (D47's finding: qa/screenshot.mjs gates EVERY capture
// on `__benchSettled`). Switched to `armManualSettle` + the shared
// REVEAL_CLOCK_MARGIN_MS; the migrated scenario must apply it identically
// so M1b absorbs the constant symmetrically. The ZOOM re-arms below keep
// `armBklitTimerSettle` unchanged — their computed 750+150ms is far under
// the 2500ms fallback, so the computed timer deterministically wins there.
const REVEAL_CLOCK_MARGIN_MS = 250;

// --- Zoom (D32: `__benchDrilldown`/`__benchDrillUp`) ------------------------
//
// `SunburstChartProps.focusId`/`onFocusChange` (sunburst-chart.tsx) let a
// parent CONTROL which node is focused, but the smooth 750ms zoom morph
// itself lives entirely INSIDE `SunburstChartCore`'s own `zoomTo` closure
// (captured in `SunburstContext`, only reachable by `SunburstSegment`'s
// `onClick`/`SunburstCenter`'s `onClick`) -- there is no exported ref/method
// to invoke `zoomTo` from outside. Verified directly: if this scenario were
// to instead just SET the controlled `focusId` prop from outside (bypassing
// a real click), `zoomT`/`prevFocusId` would NOT be reset by that prop
// change alone (the only effect that resets them fires on `rootId` change,
// sunburst-chart.tsx lines ~196-202) -- since `zoomT` would still read its
// last settled value (1, i.e. "at rest"), `transitionGeometry(..., zoomT=1)`
// collapses to `lerpGeometry(from, to, 1) === to`: an instant SNAP, not the
// real animated zoom. So this scenario "replicates a click" (D32's
// documented alternative) instead of driving focus directly:
//
//   `hitHandlers.onClick` (sunburst-segment.tsx) is bound to the segment's
//   OUTER `<motion.g>` -- clicking (dispatching a bubbling `click` event)
//   anywhere inside that `<g>` (its invisible `fill="transparent"` hit path
//   included -- SVG `pointer-events: visiblePainted` treats a `transparent`
//   fill as painted, so it IS hit-testable) reaches the same
//   `arc.hasChildren && zoomTo(arc.id)` a real user click would.
//   `SunburstCenter`'s `<circle onClick={() => focus.parentId && zoomTo(...)}
//   >` is the equivalent zoom-OUT control.
//
// Locating the right DOM node for a given arc without adding any data-*
// attribute to bklit's own markup (read-only, D32's integrity rule): bklit
// reorders `<SunburstSegment>` children before rendering them into the SVG
// (`sortSunburstSegments`, sunburst-chart.tsx, unexported) so shallower
// (parent) rings paint LAST and win hit-testing at ring boundaries: sort by
// depth DESCENDING, tie-break by `arcIndex` DESCENDING. That function is
// pure and already fully read -- replicated verbatim below (not imported,
// since it isn't exported) purely to compute DOM position from the SAME
// `arcs` array both sides already share. The rendered `<svg>`'s direct
// children are, in order: N segment `<g>` elements (in the sorted order
// below), then `SunburstCenter`'s `<circle>`, then `SunburstLabels`' single
// wrapping `<g>` (this scenario's own child order --
// segments/Center/Labels/Hint -- mirrors the registry example exactly, and
// `isOutsideSvgComponent` pulls Hint out of the SVG entirely, per
// sunburst-chart.tsx).
function segmentDomOrder(arcs: ArcDatum[]): number[] {
  return arcs
    .map((_, arcIndex) => arcIndex)
    .sort((ai, bi) => {
      const a = arcs[ai];
      const b = arcs[bi];
      if (!(a && b)) return 0;
      if (a.depth !== b.depth) return b.depth - a.depth;
      return bi - ai;
    });
}

function dispatchClick(el: Element | null | undefined): void {
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function clickSegment(
  container: HTMLElement,
  arcs: ArcDatum[],
  targetArcIndex: number,
): boolean {
  const svg = container.querySelector("svg");
  if (!svg) return false;
  const domOrder = segmentDomOrder(arcs);
  const domIndex = domOrder.indexOf(targetArcIndex);
  if (domIndex === -1) return false;
  const groups = Array.from(svg.children).filter(
    (child) => child.tagName.toLowerCase() === "g",
  );
  const target = groups[domIndex];
  if (!target) return false;
  dispatchClick(target);
  return true;
}

function clickCenter(container: HTMLElement): boolean {
  const svg = container.querySelector("svg");
  const circle = svg?.querySelector("circle");
  if (!circle) return false;
  dispatchClick(circle);
  return true;
}

// sunburst-chart.tsx `zoomTo`: `animate(0, 1, { duration: 0.75, ... })`.
const SUNBURST_ZOOM_DURATION_MS = 750;
const SUNBURST_ZOOM_SETTLE_MARGIN_MS = 150;

export default function BklitSunburst({ n }: { n: number }) {
  const [data, setData] = useState<SeededSunburstNode>(() =>
    generateSunburst("sunburst", n),
  );
  const tickRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { arcs, rootId } = useMemo(() => buildArcs(data), [data]);
  const [focusId, setFocusId] = useState(rootId);

  useEffect(() => {
    setFocusId(rootId);
  }, [rootId]);

  // Armed once per mount from the FIRST render's `arcs` (the `[n]` dep, not
  // `[arcs]`/`[data]`, means this `useMemo` body only ever runs on mount --
  // matching bklit-radar.tsx's/bklit-heatmap.tsx's "arm once" convention --
  // so later `__benchUpdate` re-renders don't re-arm the mount-settle timer;
  // `arcs` is intentionally left out of the dep array for that reason).
  useMemo(() => {
    const settleMs = sunburstSettleMs(arcs) + REVEAL_CLOCK_MARGIN_MS;
    const { resolve } = armManualSettle(settleMs + 3000);
    window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }, settleMs);
  }, [n]);

  useEffect(() => {
    window.__benchUpdate = () =>
      measureUpdatePaint(() => {
        tickRef.current += 1;
        setData(generateSunburstUpdate("sunburst", n, tickRef.current));
      });
    // Sunburst's `n` is total arc count at a fixed depth (D32), not a
    // time-series window -- no live-append concept applies (radar/pie/ring/
    // gauge/funnel/heatmap precedent).
    window.__benchLiveTick = () => {};

    // D32: zoom QA via a scenario-side `__benchDrilldown`/`__benchDrillUp`
    // global that synchronously invokes the drill path (see header comment
    // for the "replicate a click" mechanism), then re-arms `__benchSettled`
    // for the 750ms zoom duration + a 150ms margin (same
    // `armBklitTimerSettle` helper used for the mount settle above, reused
    // as-is -- not a new settle primitive).
    window.__benchDrilldown = (nodeId?: string) => {
      const container = containerRef.current;
      if (!container) return;
      const target = nodeId
        ? arcs.find((arc) => arc.id === nodeId)
        : arcs[0]; // no arg -> first top-level branch: `buildArcs`/`layoutNode`
      // (sunburst.ts) pushes each arc BEFORE recursing into its children,
      // in array order with NO sorting (D32) -- so `arcs[0]` is always the
      // first depth-1 branch pushed.
      if (!target) return;
      const clicked = clickSegment(container, arcs, target.arcIndex);
      if (clicked) {
        armBklitTimerSettle(
          SUNBURST_ZOOM_DURATION_MS + SUNBURST_ZOOM_SETTLE_MARGIN_MS,
        );
      }
    };
    window.__benchDrillUp = () => {
      const container = containerRef.current;
      if (!container) return;
      const clicked = clickCenter(container);
      if (clicked) {
        armBklitTimerSettle(
          SUNBURST_ZOOM_DURATION_MS + SUNBURST_ZOOM_SETTLE_MARGIN_MS,
        );
      }
    };
  }, [n, arcs]);

  return (
    <div ref={containerRef}>
      <SunburstChart
        data={data}
        focusId={focusId}
        onFocusChange={setFocusId}
        size={SUNBURST_SIZE}
      >
        {arcs.map((arc) => (
          <SunburstSegment index={arc.arcIndex} key={arc.id} />
        ))}
        <SunburstCenter />
        <SunburstLabels />
        <SunburstHint />
      </SunburstChart>
    </div>
  );
}

declare global {
  interface Window {
    /** D32 zoom-QA hook: drill down into `nodeId` (default: first top-level branch). */
    __benchDrilldown?: (nodeId?: string) => void;
    /** D32 zoom-QA hook: drill up one level (clicks the center hub, if any). */
    __benchDrillUp?: () => void;
  }
}
