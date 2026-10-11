// Laid-out size of a tooltip panel from a ResizeObserver, shared by the portal placements (UPSTREAM-GAPS #21: no offsetWidth/Height per move).
// A hidden panel reports 0x0 and keeps the last shown size, the stale body a show starts from.
export interface PanelSize {
  readonly width: number;
  readonly height: number;
}

interface PanelSizeTracker {
  /** Last laid-out size; before any layout, one `offsetWidth`/`offsetHeight` read (first show only). */
  readonly size: () => PanelSize;
  readonly destroy: () => void;
}

export const trackPanelSize = (element: HTMLElement): PanelSizeTracker => {
  let size: PanelSize | null = null;
  const view = element.ownerDocument.defaultView;
  const observer = view?.ResizeObserver
    ? new view.ResizeObserver((entries) => {
        const box = entries.at(-1)?.borderBoxSize[0];
        if (box !== undefined && box.inlineSize > 0 && box.blockSize > 0) {
          size = { width: Math.round(box.inlineSize), height: Math.round(box.blockSize) };
        }
      })
    : null;
  observer?.observe(element);
  return {
    destroy: () => observer?.disconnect(),
    size: () => (size ??= { width: element.offsetWidth, height: element.offsetHeight }),
  };
};
