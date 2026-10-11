// bklit TooltipBox presence on the stock TanStack tooltip: an instant hide, so every show is a fresh mount.
import { tooltip } from "@tanstack/charts/tooltip";
import type { ChartTooltipExtension } from "@tanstack/charts/tooltip";

/** The stock tooltip as a `ChartTooltipExtension` (reference/types.md:352-355) whose `hide()` is instant: bklit's TooltipBox unmounts when data clears (tooltip-box.tsx:64-66) and replays its enter on the next show (:209-227),
 * while 1.0 runs one `motion` for glide and exit (motion.ts:603-630, `resumingExit` :523-548). `hide()` calls `update` once with `motion: false` (:363-366, 604-611) and restores. Module-level. Gap #19. */
export const bklitTooltip: ChartTooltipExtension = {
  ...tooltip,
  id: "bklit-tooltip",
  create(context) {
    const instance = tooltip.create(context);
    let options: Parameters<typeof instance.update>[0] | null = null;
    let hiding = false;
    return {
      ...instance,
      update(next) {
        options = next;
        instance.update(next);
      },
      paint(paintContext) {
        hiding = false;
        instance.paint(paintContext);
      },
      hide() {
        if (hiding) {
          return;
        }
        hiding = true;
        if (options) {
          instance.update({ ...options, motion: false });
          instance.hide();
          instance.update(options);
          return;
        }
        instance.hide();
      },
    };
  },
};
