// Registry port (n = total arc count at fixed depth 3); focusId controlled for zoom QA.
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

const SUNBURST_SIZE = 360;

// Phase-less chart (no onPhaseChange): settle = maxDelay*1000+935+1100ms via buildSunburstEnterTiming.
function sunburstSettleMs(arcs: ArcDatum[]): number {
  const { maxDelay } = buildSunburstEnterTiming(arcs, 1);
  return maxDelay * 1000 + 935 + 1100;
}

// Manual mount arm (computed end exceeds the shared 2500ms fallback); zoom re-arms keep the timer arm.
const REVEAL_CLOCK_MARGIN_MS = 250;

// Zoom must dispatch a real bubbling click: setting focusId alone snaps (zoomT stays 1), bypassing the morph.
// DOM order replicates bklit's unexported depth-DESC/arcIndex-DESC sort; no data-* attrs on bklit markup.
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

  // Arm once per mount ([n] dep): later updates must not re-arm the mount-settle timer.
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
    // n = arc count at fixed depth, not a window: no live-append concept.
    window.__benchLiveTick = () => {};

    // Zoom QA: replicate-a-click drill path, then re-arm settle for the 750ms zoom + 150ms margin.
    window.__benchDrilldown = (nodeId?: string) => {
      const container = containerRef.current;
      if (!container) return;
      const target = nodeId
        ? arcs.find((arc) => arc.id === nodeId)
        : arcs[0]; // arcs[0] = first top-level branch.
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
    /** Zoom-QA hook: drill down into nodeId (default: first top-level branch). */
    __benchDrilldown?: (nodeId?: string) => void;
    /** Zoom-QA hook: drill up one level (clicks the center hub). */
    __benchDrillUp?: () => void;
  }
}
