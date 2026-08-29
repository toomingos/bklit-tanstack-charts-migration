import { createElement, Fragment, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  applyBoxContent,
  buildBox,
  hideBoxContent,
  positionBox,
  type BoxConfig,
} from "./tooltip-chrome";
import { BOX_OFFSET, TOOLTIP_BOX_SPRING } from "./design-tokens";

// C1 states+legend: hover dim VALUES (base 0.85 / dim 0.4 / hovered 1) are no
// longer applied here via DOM reparenting into a wrapper `<g>` — they are
// baked into `geoShape`'s per-datum `fill`/`stroke` VisualChannel accessors
// in choropleth-chart.tsx (color-mix alpha blend, same technique as
// radar-chart.tsx's `withAlpha`), rebuilt whenever the chart's `hoveredKey`
// React state changes. `SceneStyle` has no `transition` field, so the CSS
// transition that makes that value change animate smoothly is declared once
// per path element (choropleth-chart.tsx's handleRender) using this
// constant, targeting `fill`/`stroke` instead of the old `opacity`. This
// module now owns only hover-DETECTION (mouseenter/leave wiring, the D423
// hover-persistence quirk) and the tooltip box; it reports hover changes via
// `opts.onHoverChange` instead of writing styles/reparenting DOM itself.
//
// Fidelity note: the old wrapper scheme also reparented the hovered path to
// the END of `.ts-chart__geo` (paint-order-last, i.e. on top), so its border
// was never occluded by an adjacent dimmed feature at shared edges. The
// reactive fill/stroke replacement does not reorder the DOM, so paint order
// is now purely data order — for touching polygons this can very rarely let
// a neighboring stroke render over part of the hovered one. Also: a
// pattern-filled feature (`getFeaturePattern`) cannot be alpha-blended via
// `color-mix` (it's a `url(#id)` paint-server reference, not a color), so
// pattern fills do not dim on hover under the new mechanism — the old
// element-opacity approach dimmed everything uniformly, patterns included.
// The dim's 0.18s ease-out fill/stroke transition lives in styles.css
// (`[data-bkm-chart="choropleth"]` rule), not as an inline style write.
const MARKER_VAL = "1";

// bklit choropleth-tooltip.tsx defaults: formatValue = intFmt, valueLabel =
// "Value", name fallback `Feature ${index}` — resolved by the chart before it
// hands us this config (OQ parity 8 / CP4–CP6).
export interface ChoroplethTooltipChromeConfig<F> {
  className?: string;
  panelStyle?: CSSProperties;
  backgroundColor?: string;
  content?: (props: { feature: F; index: number }) => ReactNode;
  formatValue: (value: number) => string;
  getFeatureName?: (feature: F, index: number) => string;
  getFeatureValue?: (feature: F, index: number) => number | undefined;
  valueLabel: string;
}

export interface ChoroplethHoverChromeOptions<F> {
  getCentroid: (key: string) => { x: number; y: number } | null;
  getFeatureAt: (key: string) => { feature: F; index: number } | null;
  getTooltip: () => ChoroplethTooltipChromeConfig<F> | null;
  getSize: () => { width: number; height: number };
  applyZoom: (point: { x: number; y: number }) => { x: number; y: number };
  /** Reports hover-key changes so the chart can rebuild its `geoShape`
      definition with new per-datum fill/stroke alpha. Replaces the old
      DOM-mutation `applyDim`. */
  onHoverChange: (key: string | null) => void;
}

export interface ChoroplethHoverChrome {
  reconnect(root: HTMLElement, pathElements: Map<string, SVGPathElement>): void;
  refreshTooltipPosition(): void;
  detach(): void;
}

export function createChoroplethHoverChrome<F extends { properties?: { name?: string } }>(
  opts: ChoroplethHoverChromeOptions<F>,
): ChoroplethHoverChrome {
  const MARKER = "data-bkm-cp";
  const ROOT_MARKER = "data-bkm-cp-root";
  let hoveredKey: string | null = null;
  // bklit hover-persistence parity (T-W1-9 CP7 follow-up): bklit's React
  // layer UNMOUNTS the hovered base path on hover (base- → highlight- remount,
  // choropleth-feature.tsx StaticFeatureLayer), so when the pointer then
  // leaves the feature for empty svg space (ocean) no mouseleave is ever
  // delivered — the hover + tooltip STICK until another feature is entered or
  // the pointer exits the svg. Our paths stay connected, so their mouseleave
  // would fire and wrongly clear the hover. We therefore ignore path
  // mouseleave by default; bklit DOES clear when the pointer re-enters the
  // hovered feature (the highlight path is live and its mouseleave fires) and
  // then leaves it — replicated via this armed flag set on re-entry.
  let pathLeaveArmed = false;
  let currentRoot: HTMLElement | null = null;
  let svgEl: SVGSVGElement | null = null;

  // ── Shared TooltipBox (CP7 restore: legacy flip + clamp + entrance +
  //    INSTANT unmount — bklit ChoroplethTooltip returns null the moment
  //    tooltipData clears; no exit fade) ─────────────────────────────────
  const doc = typeof document !== "undefined" ? document : null;
  const boxBuild = doc
    ? buildBox(doc, {} as BoxConfig, TOOLTIP_BOX_SPRING, false)
    : null;
  const boxFadeRef: { current: Animation | null } = { current: null };
  let boxVisible = false;
  let prevFlip: boolean | null = null;
  let lastHoverKey: string | null = null;

  function hideTooltip() {
    if (!boxVisible || !boxBuild) return;
    boxVisible = false;
    lastHoverKey = null;
    prevFlip = null;
    boxBuild.layer.style.display = "none";
    boxBuild.leftSpring?.stop();
    boxBuild.topSpring?.stop();
    boxBuild.entranceSpring.stop();
    boxFadeRef.current?.cancel();
    boxFadeRef.current = null;
    hideBoxContent(boxBuild);
  }

  function showTooltip(key: string) {
    if (!boxBuild || !doc) return;
    const cfg = opts.getTooltip();
    if (!cfg) return;
    const found = opts.getFeatureAt(key);
    if (!found) return;
    const raw = opts.getCentroid(key);
    const p = opts.applyZoom(raw ?? { x: 0, y: 0 });
    const { width, height } = opts.getSize();
    const showing = !boxVisible;
    boxVisible = true;
    lastHoverKey = key;
    const { feature, index } = found;

    const name = cfg.getFeatureName
      ? cfg.getFeatureName(feature, index)
      : (feature.properties?.name ?? `Feature ${index}`);
    const value = cfg.getFeatureValue?.(feature, index);

    // Per-show styling (mirrors buildBox's build-time application; config is
    // read live so prop changes take effect without a chrome rebuild).
    boxBuild.layer.className = cfg.className
      ? `bkm-tooltip-layer ${cfg.className}`
      : "bkm-tooltip-layer";
    if (cfg.backgroundColor) boxBuild.panel.style.backgroundColor = cfg.backgroundColor;
    if (cfg.panelStyle) Object.assign(boxBuild.panel.style, cfg.panelStyle);

    if (cfg.content) {
      boxBuild.content.style.display = "none";
      boxBuild.custom.style.display = "";
      if (boxBuild.childrenWrap) boxBuild.childrenWrap.style.display = "none";
      const doRender = () => {
        if (!boxBuild!.customRoot.current) {
          boxBuild!.customRoot.current = createRoot(boxBuild!.custom);
        }
        boxBuild!.customRoot.current.render(
          createElement(Fragment, null, cfg.content!({ feature, index })),
        );
      };
      boxBuild.contentScheduler?.schedule(doRender, `cp:${key}:${index}`);
    } else {
      boxBuild.lastContentKey.current = null;
      boxBuild.custom.style.display = "none";
      const rows =
        value === undefined
          ? []
          : [
              {
                color: "var(--chart-1)",
                label: cfg.valueLabel,
                value: cfg.formatValue(value),
              },
            ];
      applyBoxContent(boxBuild, doc, name, rows, null, index, {});
    }

    boxBuild.layer.style.display = "";
    const flip = positionBox(
      boxBuild, p.x, p.y, width, height, BOX_OFFSET, showing, prevFlip, boxFadeRef,
    );
    prevFlip = flip;
  }

  function refreshTooltipPosition() {
    if (!boxBuild || !boxVisible || !lastHoverKey) return;
    const raw = opts.getCentroid(lastHoverKey);
    if (!raw) return;
    const p = opts.applyZoom(raw);
    const { width, height } = opts.getSize();
    const flip = positionBox(
      boxBuild, p.x, p.y, width, height, BOX_OFFSET, false, prevFlip, boxFadeRef,
    );
    prevFlip = flip;
  }

  function handleEnter(this: SVGPathElement) {
    const key = this.getAttribute("data-ts-key") ?? "";
    // Re-entering the hovered feature arms its leave: bklit's highlight path
    // is live, so its mouseleave clears the hover (see pathLeaveArmed above).
    pathLeaveArmed = hoveredKey === key;
    if (hoveredKey === key) return;
    hoveredKey = key;
    opts.onHoverChange(key);
    showTooltip(key);
  }

  function clearHover() {
    if (hoveredKey === null) return;
    opts.onHoverChange(null);
    hoveredKey = null;
    pathLeaveArmed = false;
    hideTooltip();
  }

  function handlePathLeave() {
    // Empty svg space (ocean) does NOT clear: bklit's hovered base path is
    // unmounted on hover, so its mouseleave never fires there and the hover
    // sticks. Clearing happens on svg exit, a different feature, or the
    // armed re-entry leave below.
    if (!pathLeaveArmed) return;
    pathLeaveArmed = false;
    clearHover();
  }

  function wireSvg(svg: SVGSVGElement | null) {
    if (!svg) return;
    svg.addEventListener("mouseleave", clearHover);
    svg.addEventListener("pointerleave", clearHover);
  }

  function install(root: HTMLElement, pathElements: Map<string, SVGPathElement>) {
    for (const path of pathElements.values()) {
      if (!path.isConnected) continue;
      if (path.hasAttribute(MARKER)) continue;
      path.addEventListener("mouseenter", handleEnter);
      path.addEventListener("mouseleave", handlePathLeave);
      path.setAttribute(MARKER, MARKER_VAL);
    }
    if (!root.hasAttribute(ROOT_MARKER)) {
      root.addEventListener("mouseleave", clearHover);
      svgEl = root.querySelector<SVGSVGElement>("svg.ts-chart");
      wireSvg(svgEl);
      root.setAttribute(ROOT_MARKER, MARKER_VAL);
    } else if (!svgEl || !svgEl.isConnected) {
      svgEl = root.querySelector<SVGSVGElement>("svg.ts-chart");
      wireSvg(svgEl);
    }
    if (boxBuild && boxBuild.layer.parentElement !== root) {
      root.appendChild(boxBuild.layer);
    }
  }

  return {
    reconnect(root, pathElements) {
      currentRoot = root;
      install(root, pathElements);
      // Dim VALUES no longer need reconciling here — `geoShape`'s fill/stroke
      // accessors already baked the correct alpha for `hoveredKey` into every
      // path on this render (React state, read in choropleth-chart.tsx). Only
      // the tooltip position (screen coords can shift on reconnect/resize)
      // still needs an imperative nudge.
      if (hoveredKey !== null && boxVisible) refreshTooltipPosition();
    },
    refreshTooltipPosition,
    detach() {
      hideTooltip();
      hoveredKey = null;
      pathLeaveArmed = false;
      currentRoot = null;
      svgEl = null;
      opts.onHoverChange(null);
      if (boxBuild) {
        boxBuild.layer.remove();
        boxBuild.rowByKey.clear();
        boxBuild.customRoot.current?.unmount();
        boxBuild.childrenRoot.current?.unmount();
        boxBuild.contentScheduler?.dispose();
      }
    },
  };
}
