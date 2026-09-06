// Mirror of bklit-sunchrome.tsx; data/settle/focus from migrated-sunburst.tsx, chrome differs.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SunburstBreadcrumb,
  SunburstChart,
  SunburstCenter,
  SunburstHint,
  SunburstLabels,
  SunburstSegment,
  useSunburstBreadcrumbItems,
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
const REVEAL_CLOCK_MARGIN_MS = 250;
const SUNBURST_ZOOM_DURATION_MS = 750;
const SUNBURST_ZOOM_SETTLE_MARGIN_MS = 150;

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
  const markGroup = container.querySelector('[data-ts-key="sunburst-arcs"]');
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

function sunburstSettleMs(arcs: ArcDatum[]): number {
  const { maxDelay } = buildSunburstEnterTiming(arcs, 1);
  return maxDelay * 1000 + 935 + 1100;
}

// GUARD: crumb markup must stay byte-identical to the bklit scenario's copy.
interface CrumbItem {
  id: string;
  label: string;
  isCurrent: boolean;
}

function CrumbList({
  items,
  onNavigate,
}: {
  items: readonly CrumbItem[];
  onNavigate: (id: string) => void;
}) {
  return (
    <ol
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        listStyle: "none",
        margin: 0,
        padding: 0,
        fontSize: "13px",
        lineHeight: "20px",
      }}
    >
      {items.map((item, index) => (
        <li key={item.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {index > 0 ? (
            <span aria-hidden="true" style={{ opacity: 0.45 }}>
              {"›"}
            </span>
          ) : null}
          {item.isCurrent ? (
            <span aria-current="page" style={{ fontWeight: 600 }}>
              {item.label}
            </span>
          ) : (
            <button
              onClick={() => onNavigate(item.id)}
              style={{
                background: "none",
                border: 0,
                padding: 0,
                font: "inherit",
                color: "inherit",
                opacity: 0.6,
                cursor: "pointer",
              }}
              type="button"
            >
              {item.label}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Context-fed like bklit: the hook reads data/focus/zoomTo itself. */
function MigratedCrumbs() {
  const { items, zoomTo } = useSunburstBreadcrumbItems();
  return <CrumbList items={items} onNavigate={zoomTo} />;
}

export default function MigratedSunChrome({ n }: { n: number }) {
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
      const target = nodeId ? arcs.find((arc) => arc.id === nodeId) : arcs[0];
      if (!target) return;
      if (clickSegment(container, arcs, target.arcIndex)) {
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
        <SunburstBreadcrumb>
          <MigratedCrumbs />
        </SunburstBreadcrumb>
        {arcs.map((arc) => (
          <SunburstSegment index={arc.arcIndex} key={arc.id} />
        ))}
        <SunburstCenter />
        <SunburstLabels />
        <SunburstHint>
          {({ hintText, hoveredArc, focus }) =>
            hoveredArc ? (
              <span>
                <strong>{hoveredArc.name}</strong>
                {` · depth ${hoveredArc.depth} · ${hoveredArc.value}`}
              </span>
            ) : (
              <span>{`${focus.name} — ${hintText}`}</span>
            )
          }
        </SunburstHint>
      </SunburstChart>
    </div>
  );
}
