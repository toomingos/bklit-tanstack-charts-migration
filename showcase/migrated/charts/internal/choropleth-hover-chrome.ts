// C1 states+legend: hover dim VALUES (base 0.85 / dim 0.4 / hovered 1) are no
// longer applied here via DOM reparenting into a wrapper `<g>` — they are
// baked into `geoShape`'s per-datum `fill`/`stroke` VisualChannel accessors
// in choropleth-chart.tsx (color-mix alpha blend, same technique as
// radar-chart.tsx's `withAlpha`), rebuilt whenever the chart's `hoveredKey`
// React state changes. `SceneStyle` has no `transition` field, so the CSS
// transition that makes that value change animate smoothly is declared once
// per path element (choropleth-chart.tsx's handleRender) using this
// constant, targeting `fill`/`stroke` instead of the old `opacity`. This
// module now owns ONLY hover-DETECTION (mouseenter/leave wiring, the D423
// hover-persistence quirk) — it reports hover-key transitions via two
// separate callbacks instead of writing styles/DOM/tooltip content itself:
// `onHoverChange` (C1's dim wiring) and `onFocusChange` (C2 — drives the
// native TanStack tooltip extension via `interaction.setControlledFocus`,
// wired in choropleth-chart.tsx). The bespoke TooltipBox this module used to
// own (`showTooltip`/`hideTooltip`/`buildBox`) is gone: panel building and
// zoom-aware positioning now live entirely in the native `tooltip` extension
// (`className: "bkm-native-tooltip"`, a custom `anchor` fn, `renderTooltipBody`).
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

export interface ChoroplethHoverChromeOptions {
  /** Reports hover-key changes so the chart can rebuild its `geoShape`
      definition with new per-datum fill/stroke alpha. Replaces the old
      DOM-mutation `applyDim`. */
  onHoverChange: (key: string | null) => void;
  /** C2: reports the same hover-key transitions so the chart can drive the
      native tooltip's focus via `interaction.setControlledFocus(point,
      {source: 'pointer'})` — kept as a separate callback from
      `onHoverChange` so C1's dim wiring and C2's focus/tooltip wiring stay
      independent call sites (neither owns the other). */
  onFocusChange: (key: string | null) => void;
}

export interface ChoroplethHoverChrome {
  reconnect(root: HTMLElement, pathElements: Map<string, SVGPathElement>): void;
  detach(): void;
}

export function createChoroplethHoverChrome(
  opts: ChoroplethHoverChromeOptions,
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
  let svgEl: SVGSVGElement | null = null;

  function handleEnter(this: SVGPathElement) {
    const key = this.getAttribute("data-ts-key") ?? "";
    // Re-entering the hovered feature arms its leave: bklit's highlight path
    // is live, so its mouseleave clears the hover (see pathLeaveArmed above).
    pathLeaveArmed = hoveredKey === key;
    if (hoveredKey === key) return;
    hoveredKey = key;
    opts.onHoverChange(key);
    opts.onFocusChange(key);
  }

  function clearHover() {
    if (hoveredKey === null) return;
    opts.onHoverChange(null);
    opts.onFocusChange(null);
    hoveredKey = null;
    pathLeaveArmed = false;
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
  }

  return {
    reconnect(root, pathElements) {
      install(root, pathElements);
    },
    detach() {
      hoveredKey = null;
      pathLeaveArmed = false;
      svgEl = null;
      opts.onHoverChange(null);
      opts.onFocusChange(null);
    },
  };
}
