// Migrated SunburstChart scenario — mirrors bklit-sunburst.tsx's harness
// contract exactly: same data generation, same settle arm, same zoom hooks.
//
// Uses the TanStack-native SunburstChart from migrated/charts/sunburst-chart.tsx
// (D81 redo: stock `radialArc` with custom d3 `arc()` generator replacing the
// D79 custom PolarMark).
//
// Settle detection: computed from `buildSunburstEnterTiming` maxDelay +
// 1100ms reveal duration + 935ms labels delay, matching bklit-sunburst.tsx's
// formula. Armed via `armManualSettle` with REVEAL_CLOCK_MARGIN_MS to match
// the bklit scenario's settle arm (Fable edit, D51/D52 precedent).
//
// Zoom (`__benchDrilldown`/`__benchDrillUp`): dispatches click events on the
// TanStack-rendered SVG <path> elements inside `[data-ts-key="sunburst-arcs"]`.
// With D81's `radialArc`, there is ONE <path> per arc datum, in
// depth-descending order (matching bklit's `sortSunburstSegments`), so
// segment DOM order maps directly via `markGroup.children[domIndex]`.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SunburstChart,
  SunburstSegment,
  SunburstCenter,
  SunburstLabels,
  SunburstHint,
} from "../../../../showcase/migrated/charts/sunburst-chart";
import {
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

// --- Settle computation (verbatim from bklit-sunburst.tsx) ---
function sunburstSettleMs(arcs: ArcDatum[]): number {
  const { maxDelay } = buildSunburstEnterTiming(arcs, 1);
  return maxDelay * 1000 + 935 + 1100;
}

const REVEAL_CLOCK_MARGIN_MS = 250;

// --- DOM helpers for zoom click dispatching ---

/** bklit's `sortSunburstSegments` ordering: depth desc, then arcIndex desc. */
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
  el?.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}

/**
 * Click a segment by its arcIndex. The TanStack-rendered DOM inside
 * `[data-ts-key="sunburst-arcs"]` has one `<path>` per arc, in
 * depth-descending order matching `segmentDomOrder`.
 */
function clickSegment(
  container: HTMLElement,
  arcs: ArcDatum[],
  targetArcIndex: number,
): boolean {
  const markGroup = container.querySelector('[data-ts-key="sunburst-arcs"]');
  if (!markGroup) return false;

  // Get all path children from the single mark group
  const children: Element[] = [];
  markGroup.querySelectorAll("[data-ts-key] path").forEach((p) => children.push(p));

  const domOrder = segmentDomOrder(arcs);
  const domIndex = domOrder.indexOf(targetArcIndex);
  if (domIndex === -1) return false;

  const target = children[domIndex];
  if (!target) return false;

  dispatchClick(target);
  return true;
}

/**
 * Click the center overlay. The center is an absolute-positioned div with
 * a circle child. We dispatch a click on the inner circle div.
 */
function clickCenter(container: HTMLElement): boolean {
  // Find the center overlay's clickable circle div
  const center = container.querySelector('[data-bkm-chart="sunburst"] div[role="button"]') as HTMLElement | null;
  if (!center) return false;
  dispatchClick(center);
  return true;
}

// Zoom settle
const SUNBURST_ZOOM_DURATION_MS = 750;
const SUNBURST_ZOOM_SETTLE_MARGIN_MS = 150;

export default function MigratedSunburst({ n }: { n: number }) {
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

  // Mount settle arm (matches bklit-sunburst.tsx exactly)
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
    window.__benchLiveTick = () => {};

    window.__benchDrilldown = (nodeId?: string) => {
      const container = containerRef.current;
      if (!container) return;
      const target = nodeId
        ? arcs.find((arc) => arc.id === nodeId)
        : arcs[0];
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
    __benchDrilldown?: (nodeId?: string) => void;
    __benchDrillUp?: () => void;
  }
}
