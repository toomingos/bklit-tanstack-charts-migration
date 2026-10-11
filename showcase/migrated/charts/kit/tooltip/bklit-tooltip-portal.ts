// The documented `tooltip.portal` extension point: a position-only portal placing the native tooltip with bklit's TooltipBox rules.
// The native resolver's fixed 8px edge cannot reproduce bklit's `offset` clamp (top pinned at `offset`, flip past containerWidth).
import { trackPanelSize } from "./track-panel-size";
import type { PanelSize } from "./track-panel-size";
import type { ChartTooltipPortalExtension, ChartTooltipPortalInput } from "@tanstack/charts/tooltip/portal";

interface BklitPortalOptions {
  /** Pixels trimmed from the bottom of the scene before the vertical clamp (bklit's chart height excludes the cell inset). */
  readonly bottomInset?: number;
  /** bklit's cartesian TooltipBox passes `top={margin.top}`: the panel top sits at the anchor's y (the plot top) instead of centring on the anchor. */
  readonly pinTop?: boolean;
  /** bklit TooltipBox `animate` (default true). `false` is its static path: the layout effect sets the measured position before the first paint. */
  readonly animate?: boolean;
}

// gap #37 (docs/UPSTREAM-GAPS.md): `className`/`content`/`placement` are static options, so the first-anchor "settle" glide
// (bklit tooltip-box.tsx:94-135) is driven by toggling `data-bkm-settle` on the portal's own element and reading its style once.
const SETTLE_ATTR = "data-bkm-settle";

/** bklit TooltipBox `tooltipWidthRef` / `tooltipHeightRef` initial values. */
const BKLIT_INITIAL_SIZE: PanelSize = { width: 180, height: 80 };

const bklitTooltipPortal: ChartTooltipPortalExtension = {
  id: "bklit-tooltip-portal",
  create: ({ element }, initialOptions) => {
    // SAFETY: `use: bklitTooltipPortal` is only reachable through `bklitTooltipPlacement`, which supplies BklitPortalOptions.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see SAFETY above
    let options = initialOptions as BklitPortalOptions;
    // bklit TooltipBox places the first render with the default size and picks the entrance side, then its layout effect retargets
    // the spring to the measured size (the glide); the side stays the first decision until the next pointer move.
    let showFlip: boolean | null = null;
    let anchorX = Number.NaN;
    let anchorY = Number.NaN;
    Object.assign(element.style, { bottom: "auto", margin: "0", position: "absolute", right: "auto", width: "max-content", zIndex: "1" });
    const panel = trackPanelSize(element);
    const place = (x: number, y: number, { width, height }: PanelSize, offset: number, scene: PanelSize): boolean => {
      const flipped = x + width + offset > scene.width;
      element.style.left = `${flipped ? x - offset - width : x + offset}px`;
      element.style.top = options.pinTop === true
        ? `${y}px`
        : `${Math.max(offset, Math.min(y - height / 2, scene.height - (options.bottomInset ?? 0) - height - offset))}px`;
      return flipped;
    };
    return {
      destroy: panel.destroy,
      hide: () => {
        showFlip = null;
        element.removeAttribute(SETTLE_ATTR);
      },
      position: ({ anchor, offset = 16, scene }) => {
        const measured = panel.size();
        const sameAnchor = anchor.x === anchorX && anchor.y === anchorY;
        anchorX = anchor.x;
        anchorY = anchor.y;
        if (options.animate === false) {
          // Static path: the layout effect's setState re-renders before paint, so position and side both use the measured size.
          showFlip = place(anchor.x, anchor.y, measured, offset, scene);
        } else if (showFlip === null) {
          // First paint of the show: the render's default-size placement, then the layout effect's measured retarget (the glide).
          element.removeAttribute(SETTLE_ATTR);
          showFlip = place(anchor.x, anchor.y, BKLIT_INITIAL_SIZE, offset, scene);
          // gap #37: no documented per-show state hook on the tooltip element. The forced style read commits the default-size
          // placement as the transition's start value before `data-bkm-settle` (styles.css, 900ms spring) and the measured placement land.
          getComputedStyle(element).getPropertyValue("left");
          element.setAttribute(SETTLE_ATTR, "");
          place(anchor.x, anchor.y, measured, offset, scene);
        } else if (sameAnchor) {
          // Re-measure at the same anchor (the body rendering, the ResizeObserver): the layout effect retargets the spring again.
          place(anchor.x, anchor.y, measured, offset, scene);
        } else {
          // A pointer move renders with the measured sizes; the native tooltip motion glides between anchors.
          element.removeAttribute(SETTLE_ATTR);
          showFlip = place(anchor.x, anchor.y, measured, offset, scene);
        }
        element.dataset.placement = showFlip ? "left" : "right";
        return true;
      },
      update: (next) => {
        options = next;
      },
    };
  },
};

/** `tooltip.portal` value: bklit's container-relative flip and clamp instead of the native 8px-edge resolver. */
const bklitTooltipPlacement = (options: BklitPortalOptions = {}): ChartTooltipPortalInput => ({ ...options, use: bklitTooltipPortal });

export { bklitTooltipPlacement };
