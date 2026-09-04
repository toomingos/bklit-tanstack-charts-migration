// Detection-only: reports hover-key transitions. Dim lives in geoShape accessors; tooltip in the native extension.
// Pattern fills (url() paint) can't alpha-blend, so they don't dim — intentional.

const MARKER_VAL = "1";
const PATH_MARKER = "data-bkm-cp";
const ROOT_MARKER = "data-bkm-cp-root";

interface ChoroplethHoverChromeOptions {
  readonly onHoverChange: (key: string | null) => void;
  readonly onFocusChange: (key: string | null) => void;
}

interface ChoroplethHoverChrome {
  readonly reconnect: (root: HTMLElement, pathElements: Map<string, SVGPathElement>) => void
  readonly detach: () => void
}

const maybeWireChoroplethPath = (path: SVGPathElement, onEnter: (this: SVGPathElement) => void, onLeave: () => void): void => {
  if (!path.isConnected) {return;}
  if (path.hasAttribute(PATH_MARKER)) {return;}
  path.addEventListener("mouseenter", onEnter);
  path.addEventListener("mouseleave", onLeave);
  path.setAttribute(PATH_MARKER, MARKER_VAL);
}

const wireChoroplethPaths = (pathElements: Map<string, SVGPathElement>, onEnter: (this: SVGPathElement) => void, onLeave: () => void): void => {
  for (const path of pathElements.values()) {
    maybeWireChoroplethPath(path, onEnter, onLeave);
  }
}

const wireChoroplethSvg = (svg: SVGSVGElement | null, onLeave: () => void): void => {
  if (!svg) {return;}
  svg.addEventListener("mouseleave", onLeave);
  svg.addEventListener("pointerleave", onLeave);
}

interface RootWiringState {
  svgEl: SVGSVGElement | null;
}

const ensureChoroplethRootWiring = (root: HTMLElement, onLeave: () => void, state: RootWiringState): void => {
  if (!root.hasAttribute(ROOT_MARKER)) {
    root.addEventListener("mouseleave", onLeave);
    state.svgEl = root.querySelector<SVGSVGElement>("svg.ts-chart");
    wireChoroplethSvg(state.svgEl, onLeave);
    root.setAttribute(ROOT_MARKER, MARKER_VAL);
    return;
  }
  if (!state.svgEl || !state.svgEl.isConnected) {
    state.svgEl = root.querySelector<SVGSVGElement>("svg.ts-chart");
    wireChoroplethSvg(state.svgEl, onLeave);
  }
}

const createChoroplethHoverChrome = (opts: Readonly<ChoroplethHoverChromeOptions>): ChoroplethHoverChrome => {
  let hoveredKey: string | undefined = undefined;
  // Bklit parity: path mouseleave is ignored (the hovered base unmounts in legacy, so hover sticks); re-entry arms leave.
  let pathLeaveArmed = false;
  const wiring: RootWiringState = { svgEl: null };

  const handleEnter = function handleEnter(this: SVGPathElement): void {
    const key = this.dataset.tsKey ?? "";
    pathLeaveArmed = hoveredKey === key;
    if (hoveredKey === key) {return;}
    hoveredKey = key;
    opts.onHoverChange(key);
    opts.onFocusChange(key);
  }

  const clearHover = (): void => {
    if (hoveredKey === undefined) {return;}
    opts.onHoverChange(null);
    opts.onFocusChange(null);
    hoveredKey = undefined;
    pathLeaveArmed = false;
  }

  const handlePathLeave = (): void => {
    if (!pathLeaveArmed) {return;}
    pathLeaveArmed = false;
    clearHover();
  }

  const install = (root: HTMLElement, pathElements: Map<string, SVGPathElement>): void => {
    wireChoroplethPaths(pathElements, handleEnter, handlePathLeave);
    ensureChoroplethRootWiring(root, clearHover, wiring);
  }

  return {
    detach() {
      hoveredKey = undefined;
      pathLeaveArmed = false;
      wiring.svgEl = null;
      opts.onHoverChange(null);
      opts.onFocusChange(null);
    },
    reconnect(root, pathElements) {
      install(root, pathElements);
    },
  };
}

export { createChoroplethHoverChrome };
export type { ChoroplethHoverChrome, ChoroplethHoverChromeOptions };
