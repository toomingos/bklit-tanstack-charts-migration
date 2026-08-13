const SVG_NS = "http://www.w3.org/2000/svg";
const DIM_TRANSITION = "opacity 0.18s ease-out";
const DIM_WRAPPER_ATTR = "data-bkm-dim-wrapper";
const MARKER_VAL = "1";

export interface ChoroplethHoverChrome {
  reconnect(root: HTMLElement, pathElements: Map<string, SVGPathElement>): void;
  detach(): void;
}

export function createChoroplethHoverChrome(
  getDimOpacity: () => number,
  getBaseOpacity: () => number,
  getCentroid: (key: string) => { x: number; y: number } | null,
  onHoverChange: (data: { key: string; x: number; y: number } | null) => void,
  pathElementsRef: { current: Map<string, SVGPathElement> },
): ChoroplethHoverChrome {
  const MARKER = "data-bkm-cp";
  const ROOT_MARKER = "data-bkm-cp-root";
  let hoveredKey: string | null = null;
  let currentRoot: HTMLElement | null = null;
  let svgEl: SVGSVGElement | null = null;

  function getDimWrapper(geoGroup: Element): SVGGElement | null {
    return geoGroup.querySelector<SVGGElement>(`[${DIM_WRAPPER_ATTR}="${MARKER_VAL}"]`);
  }

  function destroyDimWrapper(geoGroup: SVGGElement) {
    const wrapper = getDimWrapper(geoGroup);
    if (!wrapper) return;
    const paths = Array.from(wrapper.querySelectorAll<SVGPathElement>("path"));
    for (const path of paths) {
      if (path.isConnected) geoGroup.appendChild(path);
    }
    wrapper.remove();
  }

  function applyDim(key: string | null) {
    const elements = pathElementsRef.current;
    if (elements.size === 0) return;
    if (key !== null && !elements.has(key)) return;
    const dimOpacity = getDimOpacity();
    const baseOpacity = getBaseOpacity();
    const root = currentRoot ?? document.body;
    const geoGroup = root.querySelector<SVGGElement>(".ts-chart__geo");
    if (!geoGroup) return;
    if (geoGroup.getAnimations().length > 0) return;
    let dimWrapper = getDimWrapper(geoGroup);
    if (key === null) {
      if (dimWrapper) {
        void dimWrapper.getBoundingClientRect().height;
        destroyDimWrapper(geoGroup);
      }
      void geoGroup.getBoundingClientRect().height;
      for (const path of elements.values()) {
        if (!path.isConnected) continue;
        path.style.transition = DIM_TRANSITION;
        path.style.opacity = String(baseOpacity);
      }
      return;
    }
    const prevKey = hoveredKey;
    const isFirstHover = prevKey === null || !elements.has(prevKey) || !dimWrapper;
    if (!dimWrapper) {
      dimWrapper = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
      dimWrapper.setAttribute(DIM_WRAPPER_ATTR, MARKER_VAL);
      dimWrapper.style.transition = DIM_TRANSITION;
      dimWrapper.style.opacity = String(baseOpacity);
      geoGroup.insertBefore(dimWrapper, geoGroup.firstChild);
      void dimWrapper.getBoundingClientRect().height;
      dimWrapper.style.opacity = String(dimOpacity);
    } else {
      dimWrapper.style.opacity = String(dimOpacity);
    }
    if (isFirstHover) {
      for (const [dk, path] of elements) {
        if (!path.isConnected) continue;
        if (dk === key) continue;
        if (path.parentElement === dimWrapper) continue;
        path.style.transition = "";
        path.style.opacity = "1";
        dimWrapper.appendChild(path);
      }
    } else if (prevKey !== key) {
      const prevPath = elements.get(prevKey!);
      if (prevPath && prevPath.isConnected && prevPath.parentElement === geoGroup) {
        prevPath.style.opacity = "1";
        prevPath.style.transition = "";
        dimWrapper.appendChild(prevPath);
      }
      const nextPath = elements.get(key);
      if (nextPath && nextPath.isConnected && nextPath.parentElement === dimWrapper) {
        geoGroup.appendChild(nextPath);
      }
    }
    const hoveredPath = elements.get(key);
    if (hoveredPath && hoveredPath.isConnected && hoveredPath.parentElement !== geoGroup) {
      if (hoveredPath.parentElement === dimWrapper) geoGroup.appendChild(hoveredPath);
      hoveredPath.style.transition = DIM_TRANSITION;
      hoveredPath.style.opacity = "1";
    } else if (hoveredPath && hoveredPath.isConnected) {
      hoveredPath.style.transition = DIM_TRANSITION;
      hoveredPath.style.opacity = "1";
      geoGroup.appendChild(hoveredPath);
    }
  }

  function handleEnter(this: SVGPathElement) {
    const key = this.getAttribute("data-ts-key") ?? "";
    if (hoveredKey === key) return;
    hoveredKey = key;
    applyDim(key);
    const centroid = getCentroid(key);
    if (centroid) onHoverChange({ key, x: centroid.x, y: centroid.y });
  }

  function clearHover() {
    if (hoveredKey === null) return;
    applyDim(null);
    hoveredKey = null;
    onHoverChange(null);
  }

  function handleSvgMove(e: MouseEvent) {
    if (hoveredKey === null) return;
    const target = e.target as Element | null;
    if (target?.closest?.("[data-ts-key]")) return;
    clearHover();
  }

  function wireSvg(svg: SVGSVGElement | null) {
    if (!svg) return;
    svg.addEventListener("mousemove", handleSvgMove);
    svg.addEventListener("mouseleave", clearHover);
    svg.addEventListener("pointerleave", clearHover);
  }

  function install(root: HTMLElement, pathElements: Map<string, SVGPathElement>) {
    for (const path of pathElements.values()) {
      if (!path.isConnected) continue;
      if (path.hasAttribute(MARKER)) continue;
      path.addEventListener("mouseenter", handleEnter);
      path.addEventListener("mouseleave", clearHover);
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
      currentRoot = root;
      const wasHovered = hoveredKey !== null;
      install(root, pathElements);
      if (!wasHovered) {
        const geoGroup = root.querySelector<SVGGElement>(".ts-chart__geo");
        if (!geoGroup || geoGroup.getAnimations().length > 0) return;
        destroyDimWrapper(geoGroup);
        const baseOpacity = getBaseOpacity();
        for (const path of pathElementsRef.current.values()) {
          if (!path.isConnected) continue;
          path.style.opacity = String(baseOpacity);
          path.style.transition = "";
        }
      } else {
        applyDim(hoveredKey);
      }
    },
    detach() {
      hoveredKey = null;
      currentRoot = null;
      svgEl = null;
      applyDim(null);
      onHoverChange(null);
    },
  };
}
