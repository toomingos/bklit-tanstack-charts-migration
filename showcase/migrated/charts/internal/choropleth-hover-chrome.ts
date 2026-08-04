// bklit-ui choropleth hover chrome — dim non-hovered features to `dimOpacity`
// (default 0.4), 180ms CSS ease-out transition on both dim and restore.
// Resting state: all features at `baseOpacity` (0.85, matching bklit's
// StaticFeatureLayer `<g opacity={0.85}>` wrapping all paths).
//
// Uses SVG group-based dimming to match bklit's visual behaviour: non-hovered
// features are moved into an SVG `<g opacity={dimOpacity}>` wrapper so that
// overlapping strokes are composited at group level, not per-path. The
// hovered feature is moved out of the wrapper and rendered on top at full
// opacity. This mirrors bklit's StaticFeatureLayer exactly.
//
// Tooltip anchor at projected centroid (precomputed by the chart component,
// keyed by the same string returned by the geoShape `key` function).
//
// All imperative DOM — zero React state updates in the pointer path.
// Receives a cached map of `data-ts-key` → SVGPathElement from onRender,
// scoped to the chart's own container element. Multiple charts on the
// same page don't cross-dim each other's paths.

const SVG_NS = "http://www.w3.org/2000/svg";
const DIM_TRANSITION = "opacity 0.18s ease-out";
const DIM_WRAPPER_ATTR = "data-bkm-dim-wrapper";

export interface ChoroplethHoverChrome {
  /** Reconnect listeners after React re-renders the chart paths.
      Old listeners are cleaned up lazily via the `data-bkm-cp` marker. */
  reconnect(root: HTMLElement, pathElements: Map<string, SVGPathElement>): void;
  /** Remove listeners and reset hover state. */
  detach(): void;
}

/**
 * Create a choropleth hover chrome instance.
 *
 * @param getDimOpacity  Returns the dim opacity for non-hovered features
 *                       (default 0.4 from ChoroplethFeature.fadedOpacity).
 * @param getBaseOpacity  Returns the base/resting opacity for all features
 *                        when no feature is hovered (0.85, matching bklit).
 * @param getCentroid  Called with the `data-ts-key` string of a hovered path;
 *                     returns the precomputed projected centroid in viewport px.
 * @param onHoverChange  Called when hover enters/leaves a feature.
 *                     `null` on leave; `{x, y, key}` on enter.
 */
export function createChoroplethHoverChrome(
  getDimOpacity: () => number,
  getBaseOpacity: () => number,
  getCentroid: (key: string) => { x: number; y: number } | null,
  onHoverChange: (data: { key: string; x: number; y: number } | null) => void,
  pathElementsRef: { current: Map<string, SVGPathElement> },
): ChoroplethHoverChrome {
  const MARKER = "data-bkm-cp";
  let hoveredKey: string | null = null;
  let currentRoot: HTMLElement | null = null;
  let kebab = 0;
  const markerVal = String(++kebab);

  /** Destroy the dim wrapper, restoring paths to the geo group.
      Only restores paths that are still connected to the document.
      Detached paths (e.g. replaced by TanStack re-render) are left
      for garbage collection to prevent polluting the geo group. */
  function destroyDimWrapper(geoGroup: SVGGElement) {
    const wrapper = geoGroup.querySelector<SVGGElement>(`[${DIM_WRAPPER_ATTR}="${markerVal}"]`);
    if (!wrapper) return;
    // Move paths that are still in the wrapper and connected to the document
    // back to the geo group. Paths replaced by TanStack on re-render are
    // detached (isConnected=false) and must NOT be re-attached.
    const paths = Array.from(wrapper.querySelectorAll<SVGPathElement>("path"));
    for (const path of paths) {
      if (path.isConnected) {
        geoGroup.appendChild(path);
      }
    }
    wrapper.remove();
  }

  /** Apply dimming via group-based approach: non-hovered paths are moved
      into an SVG `<g opacity={dimOpacity}>` wrapper matching bklit's
      StaticFeatureLayer group-opacity compositing. The hovered path stays
      outside the wrapper at full opacity and is moved to the end of the
      geo group for z-ordering. */
  function applyDim(key: string | null) {
    const elements = pathElementsRef.current;
    if (elements.size === 0) return;

    const dimOpacity = getDimOpacity();
    const baseOpacity = getBaseOpacity();

    const root = currentRoot ?? document.body;
    const geoGroup = root.querySelector<SVGGElement>(".ts-chart__geo");
    if (!geoGroup) return;

    // Clean up any existing dim wrapper first.
    destroyDimWrapper(geoGroup);

    if (key === null) {
      // No hover — restore all features to baseOpacity.
      for (const path of elements.values()) {
        if (!path.isConnected) continue;
        path.style.transition = "";
        void path.getBoundingClientRect().height;
        path.style.transition = DIM_TRANSITION;
        path.style.opacity = String(baseOpacity);
      }
      return;
    }

    // Hovered: create dim wrapper, move non-hovered into it.
    const dimWrapper = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
    dimWrapper.setAttribute(DIM_WRAPPER_ATTR, markerVal);
    dimWrapper.style.transition = DIM_TRANSITION;

    // Insert dim wrapper as the first child of the geo group so dimmed
    // features appear behind the hovered feature.
    geoGroup.insertBefore(dimWrapper, geoGroup.firstChild);
    void dimWrapper.getBoundingClientRect().height;
    dimWrapper.style.opacity = String(dimOpacity);

    for (const [dk, path] of elements) {
      if (!path.isConnected) continue;
      if (dk !== key) {
        path.style.transition = "";
        path.style.opacity = "1";
        dimWrapper.appendChild(path);
      }
    }

    // Find the hovered path from the elements map.
    const hoveredPath = elements.get(key);
    if (hoveredPath && hoveredPath.isConnected && hoveredPath.parentElement === geoGroup) {
      hoveredPath.style.transition = "";
      void hoveredPath.getBoundingClientRect().height;
      hoveredPath.style.transition = DIM_TRANSITION;
      hoveredPath.style.opacity = "1";
      // Move to end so it renders on top of the dim wrapper.
      geoGroup.appendChild(hoveredPath);
    }
  }

  function handleEnter(this: SVGPathElement) {
    const key = this.getAttribute("data-ts-key") ?? "";
    if (hoveredKey === key) return;
    hoveredKey = key;
    applyDim(key);
    const centroid = getCentroid(key);
    if (centroid) {
      onHoverChange({ key, x: centroid.x, y: centroid.y });
    }
  }

  function handleLeave() {
    hoveredKey = null;
    applyDim(null);
  }

  function handleRootLeave() {
    hoveredKey = null;
    applyDim(null);
    onHoverChange(null);
  }

  function install(root: HTMLElement, pathElements: Map<string, SVGPathElement>) {
    for (const path of pathElements.values()) {
      if (!path.isConnected) continue;
      if (path.hasAttribute(MARKER)) continue;
      path.addEventListener("mouseenter", handleEnter);
      path.addEventListener("mouseleave", handleLeave);
      path.setAttribute(MARKER, markerVal);
    }
    if (!root.hasAttribute(`${MARKER}-root`)) {
      root.addEventListener("mouseleave", handleRootLeave);
      root.setAttribute(`${MARKER}-root`, markerVal);
    }
  }

  function setBaseOpacity(root: HTMLElement) {
    const elements = pathElementsRef.current;
    const geoGroup = root.querySelector<SVGGElement>(".ts-chart__geo");
    if (!geoGroup) return;
    // Clean up any stale dim wrapper from a previous hover that wasn't restored.
    destroyDimWrapper(geoGroup);

    const baseOpacity = getBaseOpacity();
    for (const path of elements.values()) {
      if (!path.isConnected) continue;
      path.style.transition = "";
      path.style.opacity = String(baseOpacity);
    }
  }

  function cleanup() {
    applyDim(null);
  }

  return {
    reconnect(root, pathElements) {
      currentRoot = root;
      const wasHovered = hoveredKey !== null;
      if (!wasHovered) {
        setBaseOpacity(root);
      }
      install(root, pathElements);
      if (wasHovered) {
        applyDim(hoveredKey);
      }
    },
    detach() {
      hoveredKey = null;
      currentRoot = null;
      cleanup();
      onHoverChange(null);
    },
  };
}
