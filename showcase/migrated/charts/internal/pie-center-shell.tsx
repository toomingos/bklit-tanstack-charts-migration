"use client";

// P5.6 Strand 4 — port of bklit `pie-center-shell.tsx`: `PieCenter` rendered
// over a MINIMAL pie context, so a caller can reuse the donut center readout
// without mounting slices or a whole `<PieChart>`.
//
// The one structural divergence from legacy is forced by migrated's own split:
// legacy's single `PieContextValue` carries hover state (`hoveredIndex`,
// `setHoveredIndex`, `animationKey`, `isLoaded`, `containerRef`), migrated's
// `PieStableValue` does not — hover lives in `PieHoverCoordinatorContext`, and
// `PieCenter` reads BOTH (`pie-center.tsx:85-86`, each throwing outside a
// provider). So this shell provides two contexts where legacy provides one.
// Legacy's `hoveredIndex: null` + `setHoveredIndex: () => undefined`
// (`pie-center-shell.tsx:143-144`) become the inert coordinator below: the
// shell is never hovered, so `PieCenter` always shows the total.

import { useCallback, useMemo } from "react";
import { useIntroFlowValue } from "./center-stat";
import {
  PieCenter,
  PieHoverCoordinatorContext,
  PieStableContext,
  type PieCenterProps,
  type PieStableValue,
} from "./pie-center";
import type { PieHoverCoordinator } from "./pie-hover-chrome";
import { defaultPieColors, type PieArcData, type PieData } from "../pie-chart";

// repos/bklit-ui/packages/ui/src/charts/pie-center-shell.tsx:14
const SHELL_HOVER_OFFSET = 10;

/** Legacy's `hoveredIndex: null` / `setHoveredIndex: () => undefined` pair,
    expressed in migrated's coordinator shape. Module-level and frozen: its
    identity never changes, so `PieCenter`'s `useSyncExternalStore` subscription
    never re-subscribes and never fires. */
const INERT_HOVER_COORDINATOR: PieHoverCoordinator = {
  getHovered: () => null,
  requestHover: () => undefined,
  requestUnhover: () => undefined,
  setHovered: () => undefined,
  subscribe: () => () => undefined,
};

export type PieCenterShellProps = Omit<PieCenterProps, "children"> & {
  /** Value shown with NumberFlow (same role as pie total when not hovering) */
  centerValue: number;
  /** Square reference size for pie context (matches `PieChart` `size`) */
  contextSize: number;
  /** Inner radius in px — must be > 0 so `PieCenter` renders */
  innerRadiusPx: number;
  /**
   * When true (default), the first paint uses `0` then updates to `centerValue`
   * on the next frame so NumberFlow can run an entrance transition. Subsequent
   * `centerValue` updates animate as usual.
   */
  animateEntrance?: boolean;
};

/**
 * Renders {@link PieCenter} with a minimal pie context so you can reuse the
 * same center layout as a donut pie without mounting slices or a full
 * `<PieChart>`.
 */
export function PieCenterShell({
  centerValue,
  contextSize,
  innerRadiusPx,
  animateEntrance = true,
  ...pieCenterProps
}: PieCenterShellProps) {
  // Legacy re-implements the 0 → double-rAF → value entrance inline
  // (`pie-center-shell.tsx:44-70`). That state machine was already centralized
  // into `center-stat.tsx`'s `useIntroFlowValue` for T-C4, verbatim including
  // the cleanup re-arm — so this reuses it rather than shipping a second copy.
  const flowTotal = useIntroFlowValue(centerValue, animateEntrance);

  const data: PieData[] = useMemo(
    () => [{ label: "_pieCenterShell", value: Math.max(flowTotal, 0) }],
    [flowTotal],
  );

  const totalValue = flowTotal;

  // Legacy runs d3's `pie()` here (`:79-112`), but with a SINGLE datum the
  // generator can only return the full sweep it was configured with
  // (`startAngle -π/2`, `endAngle 3π/2`, `padAngle 0`), and its `v <= 0`
  // fallback hand-writes those very angles. Both branches therefore collapse
  // to this one arc; only `value` differs, exactly as legacy has it.
  const arcs = useMemo((): PieArcData[] => {
    const d0 = data[0];
    if (!d0) return [];
    return [
      {
        data: d0,
        index: 0,
        startAngle: -Math.PI / 2,
        endAngle: (3 * Math.PI) / 2,
        padAngle: 0,
        value: d0.value > 0 ? d0.value : 0,
      },
    ];
  }, [data]);

  const getColor = useCallback((index: number) => {
    return defaultPieColors[index % defaultPieColors.length] as string;
  }, []);

  const getFill = useCallback(
    (index: number) => {
      const item = data[index];
      if (item?.fill) return item.fill;
      return getColor(index);
    },
    [data, getColor],
  );

  const center = contextSize / 2;
  const outerRadius = center - SHELL_HOVER_OFFSET;

  const contextValue: PieStableValue = useMemo(
    () => ({
      data,
      arcs,
      size: contextSize,
      center,
      outerRadius,
      innerRadius: innerRadiusPx,
      padAngle: 0,
      cornerRadius: 0,
      hoverOffset: SHELL_HOVER_OFFSET,
      enterStaggerScale: 1,
      totalValue,
      getColor,
      getFill,
      geometryScrubbing: false,
      scrubSlicePaths: null,
    }),
    [
      data,
      arcs,
      contextSize,
      center,
      outerRadius,
      innerRadiusPx,
      totalValue,
      getColor,
      getFill,
    ],
  );

  // The `data-bkm-chart` wrapper is NOT cosmetic. Legacy's center typography
  // rides on Tailwind utility classes, which resolve anywhere; migrated's ports
  // them to `.ts-bkm-center-stat*` rules that are ALL scoped under
  // `[data-bkm-chart]` (styles.css:512-560). Inside `<PieChart>` that ancestor
  // exists (`pie-chart.tsx:762,775`); a standalone shell has none, so every
  // one of those rules drops and the readout renders as unstyled 16px text —
  // caught in the Strand 4 gate captures (bklit bold ~30px vs migrated plain).
  // `display: contents` keeps the wrapper out of layout entirely, so it only
  // supplies the selector ancestor and changes nothing else: `CenterShell`
  // already sizes and centers itself with an inline px box
  // (internal/center-stat.tsx:343-355).
  return (
    <PieStableContext.Provider value={contextValue}>
      <PieHoverCoordinatorContext.Provider value={INERT_HOVER_COORDINATOR}>
        <div data-bkm-chart="pie" style={{ display: "contents" }}>
          <PieCenter {...pieCenterProps} />
        </div>
      </PieHoverCoordinatorContext.Provider>
    </PieStableContext.Provider>
  );
}

PieCenterShell.displayName = "PieCenterShell";
