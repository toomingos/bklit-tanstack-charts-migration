// P5.5 Strand 3 gate — sunburst CHROME (breadcrumb + render-prop hint).
//
// `bklit-sunburst.tsx` already gates the ring itself, but it renders the two
// chrome components in their default form: `<SunburstHint />` with no
// children (so the render-prop branch is never taken) and no breadcrumb at
// all. Strand 3 ported both surfaces — SB4 gave `SunburstHint` bklit's
// `ReactNode | ((ctx) => ReactNode)` children contract, SB8 ported
// `SunburstBreadcrumb` + `useSunburstBreadcrumbItems` — so this scenario is
// the same chart with both exercised:
//
//   <SunburstBreadcrumb><Crumbs /></SunburstBreadcrumb>
//   <SunburstHint>{(ctx) => …}</SunburstHint>
//
// Everything else (data, size, settle arm, focus wiring) is copied from
// `bklit-sunburst.tsx` unchanged, so any diff this scenario shows is the
// chrome's and nothing else's.
//
// ONE DELIBERATE API DIVERGENCE, gated for its RENDERED result rather than
// its call shape: bklit's `useSunburstBreadcrumbItems()` takes no arguments
// and pulls `data`/`focus`/`zoomTo` off a sunburst context. Migrated has no
// such context (lead ruling D323), so its hook takes `(data, focusId)` and
// the caller navigates through the `onFocusChange` it already controls. The
// crumb markup below is therefore written out identically on both sides and
// fed by each side's own hook — what is being compared is the trail the two
// hooks produce, which is the part that has to match.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SunburstBreadcrumb,
  SunburstChart,
  SunburstCenter,
  SunburstHint,
  SunburstLabels,
  SunburstSegment,
  buildArcs,
  buildSunburstEnterTiming,
  useSunburstBreadcrumbItems,
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

// Drill hooks, verbatim from `bklit-sunburst.tsx` (see that file's header for
// why a zoom must be driven by a replicated CLICK and not by setting the
// controlled `focusId`). Needed here because at the root the trail is a single
// crumb: the branch that distinguishes a LINK from the current PAGE only
// appears once something is drilled into.
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

function sunburstSettleMs(arcs: ArcDatum[]): number {
  const { maxDelay } = buildSunburstEnterTiming(arcs, 1);
  return maxDelay * 1000 + 935 + 1100;
}

// --- Crumb markup (byte-identical to the migrated scenario's copy) ---------
// bklit's own docs demo renders the crumbs through the app's shadcn
// `Breadcrumb*` primitives, which live in `apps/web` and are not available to
// the bench. Plain inline-styled markup instead — the gate is the ITEMS the
// hook produces, not the design system that draws them.

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

/** Context-fed on this side: the hook reads `data`/`focus`/`zoomTo` itself. */
function BklitCrumbs() {
  const { items, zoomTo } = useSunburstBreadcrumbItems();
  return <CrumbList items={items} onNavigate={zoomTo} />;
}

export default function BklitSunChrome({ n }: { n: number }) {
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
          <BklitCrumbs />
        </SunburstBreadcrumb>
        {arcs.map((arc) => (
          <SunburstSegment index={arc.arcIndex} key={arc.id} />
        ))}
        <SunburstCenter />
        <SunburstLabels />
        {/* The SB4 surface: a FUNCTION child, resolved against live hover
            state. Reads every field of the hint context so a drift in any one
            of them shows up in the diff. */}
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
