// Same harness contract as bklit-sunburst.tsx (data/settle/zoom hooks); TanStack-native chart.

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

// Verbatim from bklit-sunburst.tsx.
function sunburstSettleMs(arcs: ArcDatum[]): number {
  const { maxDelay } = buildSunburstEnterTiming(arcs, 1);
  return maxDelay * 1000 + 935 + 1100;
}

const REVEAL_CLOCK_MARGIN_MS = 250;

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

function clickSegment(
  container: HTMLElement,
  arcs: ArcDatum[],
  targetArcIndex: number,
): boolean {
  // Mark id folds in playKey; match by prefix.
  const markGroup = container.querySelector('[data-ts-key^="sunburst-arcs-"]');
  if (!markGroup) return false;

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

function clickCenter(container: HTMLElement): boolean {
  const center = container.querySelector('[data-bkm-chart="sunburst"] div[role="button"]') as HTMLElement | null;
  if (!center) return false;
  dispatchClick(center);
  return true;
}

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
