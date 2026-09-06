/*
 * TanStack-native redo (D102). Architecture, the C5d angle-parity conditions verified against
 * d3-hierarchy 3.1.2, and the deliberate hover-pop deviation: ./sunburst-architecture.md
 */

import {
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode, RefObject } from "react";
import { ChartHost } from "./internal/chart-host";
import { useSanitizedId } from "./internal/use-sanitized-id";
import { createChartScene } from "@tanstack/charts";
import type { ChartRendererRenderContext } from "@tanstack/charts";
import { useFocusInjection } from "./internal/focus-injection";
import type { SunburstNode as TSSunburstNode } from "@tanstack/charts/hierarchy/sunburst";
import {
  buildSunburstFlatRows,
  buildSunburstSectors,
  sunburstCenterHole,
  sunburstGrowPadding,
} from "./internal/sunburst-rows";
import type { SunburstFlatRow, SunburstModel } from "./internal/sunburst-rows";
import type { ArcDatum, Focus, SunburstNode } from "./internal/sunburst-types";
import {
  defaultSunburstColors,
  opacityForRelativeDepth,
} from "./internal/sunburst-colors";
import { buildSunburstEnterTiming } from "./internal/parity/sunburst";
import type { SunburstEnterTiming } from "./internal/parity/sunburst";
import { hoverGrowForPathSegment, ringOptions } from "./internal/parity/sunburst-geometry";
import { SunburstProvider } from "./internal/sunburst-context";
import type { SunburstContextValue } from "./internal/sunburst-context";
import { maxRevealDelayMs } from "./internal/sunburst-reveal";
import {
  cancelLabelAnimations,
  resetLabelsOverlayForReplay,
  startLabelReveal,
} from "./internal/sunburst-label-reveal";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { displayNameOf } from "./internal/children-extract";
import { SunburstCenterOverlay } from "./internal/sunburst-center-overlay";
import {
  SunburstLabelsOverlay,
  buildSunburstLabelItems,
  extractSunburstLabelSnap,
} from "./internal/sunburst-labels-overlay";
import type { SunburstSegmentProps } from "./internal/sunburst-segment";
import { resolveSunburstHintContent } from "./internal/sunburst-hint-content";
import { SunburstHintDisplay } from "./internal/sunburst-hint";
import type { SunburstHintProps } from "./internal/sunburst-hint";
import { clipRevealTiming } from "./internal/parity/animation";
import type { EnterTransition } from "./internal/parity/animation";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { useSunburstZoom } from "./internal/use-sunburst-zoom";
import { useSunburstDefinition } from "./internal/use-sunburst-definition";
import "./styles.css";

// Bklit sunburst arc sweep: 1100ms cubic-bezier(.85,0,.15,1) (was inlined at
// The two call sites below before P5.5 SB2 gave `enterTransition` a home).
const SUNBURST_SWEEP_MS = 1100;
const SUNBURST_SWEEP_EASE = "cubic-bezier(0.85,0,0.15,1)";
// Legacy zoom timing, now the arc mark's native update transition.
const SUNBURST_ZOOM_MS = 750;
const SUNBURST_ZOOM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// Slack added to sweep plus stagger when scheduling the reveal-phase deadline timer.
const REVEAL_DEADLINE_SLACK_MS = 935;
// Fraction of the sweep duration added to the max stagger delay before labels reveal.
const LABELS_REVEAL_DELAY_FRACTION = 0.85;
// Smallest chart radius in pixels after grow-padding is subtracted.
const MIN_SUNBURST_RADIUS_PX = 8;
// Default chart size and hover pop-out, matching bklit's SunburstChart defaults.
const DEFAULT_SUNBURST_SIZE = 520;
const DEFAULT_HOVER_POP = 8;

// Branch palette index of a focus: the depth-1 ancestor's category.
const focusBranchIndex = (focusId: string, sectorById: ReadonlyMap<string, ArcDatum>): number => {
  let current = sectorById.get(focusId);
  while (current !== undefined && current.depth > 1) {
    const next = current.parentId === null ? undefined : sectorById.get(current.parentId);
    if (next === undefined) {return current.categoryIndex;}
    current = next;
  }
  if (current === undefined) {return 0;}
  return current.categoryIndex;
};

const resolveSunburstHintText = (hoveredTrail: readonly string[] | undefined, focusDepth: number): string => {
  if (hoveredTrail !== undefined) {
    return hoveredTrail.join("  \u203A  ");
  }
  if (focusDepth === 0) {
    return "Click a segment to zoom in · hover to inspect";
  }
  return "Click the center to zoom out";
};

// Fades the chart stage in on mount: retired, arcs enter through the renderer.
const fadeInChartStage = (_container: HTMLElement): (() => void) | undefined => undefined;

// Sunburst reveal phase, shared by the phase plumbing below.
type SunburstPhase = "loading" | "revealing" | "ready";

interface SunburstChartProps {
  readonly data: SunburstNode;
  readonly size?: number;
  readonly playKey?: number;
  readonly className?: string;
  readonly focusId?: string;
  readonly onFocusChange?: (focusId: string) => void;
  hoveredIndex?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly hoverPop?: number;
  readonly padding?: number;
  readonly onPhaseChange?: (phase: SunburstPhase) => void;
  /** P5.5 SB2 — bklit `sunburst-chart.tsx:101`. Overrides the per-arc angular
      sweep's duration/easing (spring coerced to tween, bklit `animation.ts:18`;
      the sweep animates path `d`, which springs cannot drive natively). */
  readonly enterTransition?: EnterTransition;
  /** P5.5 SB2 — bklit `sunburst-chart.tsx:102`, default 1. Multiplies the
      ring-stagger spread; `internal/sunburst-reveal.ts`'s `buildRevealTiming`
      / `maxRevealDelayMs` already take it (clamped at 0.25) — it was simply
      never plumbed from the prop. */
  readonly enterStaggerScale?: number;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
  readonly ariaDescription?: string;
}

/*
 * Match bklit: accept function or object types so memoised carriers still classify by displayName alone.
 */
const isDisplayNameCarrier = (type: ReactElement["type"]): type is ReactElement["type"] & { displayName?: string } =>
  typeof type === "function" || typeof type === "object";

const isChildOfKind = (child: ReactNode, displayName: string): boolean => {
  if (!isValidElement(child)) {return false;}
  const type: ReactElement["type"] = child.type;
  if (!isDisplayNameCarrier(type)) {return false;}
  return displayNameOf(type) === displayName;
}

interface SunburstSegmentConfig {
  arcIndex: number;
  readonly color?: string;
  readonly fill?: string;
  readonly fillOpacity?: number;
}

interface ClassifiedChildren {
  readonly centerCount: number;
  readonly labelsCount: number;
  readonly hintCount: number;
  /** P5.5 SB4 — the last `<SunburstHint>`'s own props, so the chart can
      resolve its render-prop `children` against live state. */
  readonly hintProps: SunburstHintProps | undefined;
  /** P5.5 SB8 — bklit's `isOutsideSvgComponent` (`sunburst-chart.tsx:56-58`)
      pulls `SunburstBreadcrumb` out of the SVG and renders it ABOVE the square
      chart box (`:449-454`). Unlike the other carriers this one draws its own
      markup, so the elements are kept as-is and re-emitted in that slot. */
  readonly breadcrumbChildren: readonly ReactNode[];
  readonly segmentConfigs: readonly SunburstSegmentConfig[];
}

const classifyChildren = (children: ReactNode): ClassifiedChildren => {
  let centerCount = 0;
  let labelsCount = 0;
  let hintCount = 0;
  let hintProps: SunburstHintProps | undefined = undefined;
  const breadcrumbChildren: ReactNode[] = [];
  const segmentConfigs: SunburstSegmentConfig[] = [];

  // Flatten nested child arrays without React.Children; key assignment is unused here.
  for (const child of [children].flat(Infinity)) {
    if (isChildOfKind(child, "SunburstCenter")) {
      centerCount += 1;
    } else if (isChildOfKind(child, "SunburstLabels")) {
      labelsCount += 1;
    } else if (isChildOfKind(child, "SunburstHint")) {
      hintCount += 1;
      if (isValidElement<SunburstHintProps>(child)) {
        hintProps = child.props;
      }
    } else if (isChildOfKind(child, "SunburstBreadcrumb")) {
      breadcrumbChildren.push(child);
    } else if (isChildOfKind(child, "SunburstSegment")) {
      if (isValidElement<SunburstSegmentProps>(child)) {
        const { index, color, fill, fillOpacity } = child.props;
        segmentConfigs.push({
          arcIndex: index,
          color,
          fill,
          fillOpacity,
        });
      }
    } else {
      // Non-carrier child (e.g. plain text) — nothing to classify.
    }
  };

  return {
    breadcrumbChildren,
    centerCount,
    hintCount,
    hintProps,
    labelsCount,
    segmentConfigs,
  };
}

interface SunburstChartModel extends SunburstModel {
  readonly flatRows: SunburstFlatRow[];
}

interface SunburstChartInnerProps {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly data: SunburstNode;
  readonly size: number;
  readonly rootClassName?: string;
  readonly focus: Focus;
  readonly model: SunburstChartModel;
  readonly focusId: string;
  readonly isFocusControlled: boolean;
  readonly setInternalFocusId: (id: string) => void;
  readonly setPhase: (phase: SunburstPhase) => void;
  readonly onFocusChange?: (focusId: string) => void;
  readonly hoveredIndexProp?: number | null;
  readonly onHoverChange?: (index: number | null) => void;
  readonly hoverPop: number;
  readonly paddingProp?: number;
  readonly prefersReducedMotion: boolean;
  readonly playKey: number;
  /** SB2 — resolved arc-sweep timing, computed once in the outer component. */
  readonly sweepDurationMs: number;
  readonly sweepEasingCss: string;
  readonly enterStaggerScale: number;
  readonly enterTransition?: EnterTransition;
  readonly children: ReactNode;
}

interface SunburstLegacyContextInputs {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly data: SunburstNode;
  readonly enterStaggerScale: number;
  readonly enterTransition?: EnterTransition;
  readonly focus: Focus;
  readonly focusId: string;
  readonly getColor: (categoryIndex: number, nodeColor?: string) => string;
  readonly hoveredIndex: number | null;
  readonly hoveredSector: ArcDatum | null;
  readonly hoverPop: number;
  readonly maxDepth: number;
  readonly playKey: number;
  readonly prefersReducedMotion: boolean;
  readonly radius: number;
  readonly sectorById: ReadonlyMap<string, ArcDatum>;
  readonly sectors: ArcDatum[];
  readonly setHoveredIndex: (index: number | null) => void;
  readonly size: number;
  readonly zoomTo: (nextId: string) => void;
}

// Legacy context value over held chart state (verbatim bklit shapes).
const useSunburstLegacyContextValue = (
  inputs: Readonly<SunburstLegacyContextInputs>
): SunburstContextValue => {
  const {
    containerRef, data, enterStaggerScale, enterTransition, focus, focusId,
    getColor, hoveredIndex, hoveredSector, hoverPop, maxDepth, playKey,
    prefersReducedMotion, radius, sectorById, sectors, setHoveredIndex, size, zoomTo,
  } = inputs;
  // eslint-disable-next-line react-doctor/no-derived-state -- tracks the pre-zoom focus across commits; render-time adjustment like useSunburstFocusControl.
  const lastFocusIdRef = useRef(focusId);
  const [prevFocusId, setPrevFocusId] = useState(focusId);
  if (lastFocusIdRef.current !== focusId) {
    setPrevFocusId(lastFocusIdRef.current);
    lastFocusIdRef.current = focusId;
  }
  const prevFocus = sectorById.get(prevFocusId) ?? focus;
  const enterTiming = useMemo<SunburstEnterTiming>(
    () => buildSunburstEnterTiming(sectors, enterStaggerScale),
    [sectors, enterStaggerScale],
  );
  const getFill = useCallback(
    (arcIndex: number, fillOverride?: string, colorOverride?: string): string => {
      if (fillOverride !== undefined && fillOverride !== "") {return fillOverride;}
      const arc = sectors.at(arcIndex);
      if (!arc) {return defaultSunburstColors[0];}
      return colorOverride ?? arc.fill ?? arc.color ?? getColor(arc.categoryIndex);
    },
    [sectors, getColor],
  );
  const getFillOpacity = useCallback(
    (relativeDepth: number, override?: number): number => override ?? opacityForRelativeDepth(relativeDepth),
    [],
  );
  const isDescendant = useCallback(
    (arc: Readonly<ArcDatum>, ancestorId: string): boolean =>
      arc.id === ancestorId || arc.id.startsWith(`${ancestorId} / `),
    [],
  );
  const isRelated = useCallback(
    (arc: Readonly<ArcDatum>): boolean => {
      if (!hoveredSector) {return true;}
      return isDescendant(arc, hoveredSector.id) || hoveredSector.id.startsWith(`${arc.id} / `);
    },
    [hoveredSector, isDescendant],
  );
  const focusById = useMemo(() => new Map(sectorById), [sectorById]);
  // Commit-only zoom stays settled; hover grow was dropped, so amounts are 0.
  const [zoomT] = useState(1);
  const growAmountForArc = useCallback((_arcId: string): number => 0, []);
  const maxExpandedThickness = useMemo(() => {
    const { ringWidth } = ringOptions(1, maxDepth, radius);
    return ringWidth + hoverGrowForPathSegment(hoverPop, ringWidth, 1);
  }, [maxDepth, radius, hoverPop]);
  const skipEnterAnimation = prefersReducedMotion;
  const setHoveredArcIndex = useCallback(
    (index: number | null): void => {
      setHoveredIndex(index);
    },
    [setHoveredIndex],
  );
  const setHoveredArc = useCallback(
    (arc: Readonly<ArcDatum> | null): void => {
      setHoveredArcIndex(arc ? arc.arcIndex : null);
    },
    [setHoveredArcIndex],
  );
  return useMemo<SunburstContextValue>(
    () => ({
      arcs: sectors,
      containerRef,
      data,
      enterStaggerScale,
      enterTiming,
      enterTransition,
      focus,
      focusById,
      focusId,
      getColor,
      getFill,
      getFillOpacity,
      growAmountForArc,
      hoverPop,
      hoveredArc: hoveredSector,
      hoveredArcIndex: hoveredIndex,
      isDescendant,
      isRelated,
      maxDepth,
      maxExpandedThickness,
      playKey,
      prevFocus,
      radius,
      rootId: data.name,
      setHoveredArc,
      setHoveredArcIndex,
      size,
      skipEnterAnimation,
      zoomT,
      zoomTo,
    }),
    [
      sectors, containerRef, data, enterStaggerScale, enterTiming, enterTransition,
      focus, focusById, focusId, getColor, getFill, getFillOpacity, growAmountForArc,
      hoveredSector, hoveredIndex, hoverPop, isDescendant, isRelated, maxDepth,
      maxExpandedThickness, playKey, prevFocus, radius, setHoveredArc,
      setHoveredArcIndex, size, skipEnterAnimation, zoomT, zoomTo,
    ],
  );
};

const SunburstChartInner = ({
  ariaDescription,
  ariaLabel,
  data,
  size,
  rootClassName,
  focus,
  model,
  focusId,
  isFocusControlled,
  setInternalFocusId,
  setPhase,
  onFocusChange,
  hoveredIndexProp,
  onHoverChange,
  hoverPop,
  paddingProp,
  prefersReducedMotion,
  playKey,
  sweepDurationMs,
  sweepEasingCss,
  enterStaggerScale,
  enterTransition,
  children,
}: SunburstChartInnerProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  // One prefix per mount scopes renderer ids; two mounts resolve distinct ids.
  const idPrefix = useSanitizedId();

  // --- Pre-package inputs: sector index plus the chart-level package inputs.
  const { sectors, sectorById, maxDepth, flatRows } = model;

  const fullRadius = size / 2;
  const growPadding = paddingProp ?? sunburstGrowPadding(maxDepth, size, hoverPop);
  const radius = Math.max(MIN_SUNBURST_RADIUS_PX, fullRadius - growPadding);
  const visibleDepth = Math.max(1, maxDepth - focus.depth);
  const holeR = sunburstCenterHole(focus.depth, maxDepth, radius);

  // --- Hover state (direct React state, no coordinator mediator) ---
  const isHoverControlled = hoveredIndexProp !== undefined;
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const hoveredIndex = hoveredIndexProp ?? internalHoveredIndex;

  const setHoveredIndex = useCallback(
    (index: number | null) => {
      if (isHoverControlled) {
        onHoverChange?.(index);
      } else {
        setInternalHoveredIndex(index);
      }
    },
    [isHoverControlled, onHoverChange],
  );

  const hoveredSector = useMemo(() => {
    if (hoveredIndex === null) {return null;}
    return sectors[hoveredIndex] ?? null;
  }, [sectors, hoveredIndex]);

  const { captureRenderContext, clearFocus, focusPoint, sceneRef } = useFocusInjection<TSSunburstNode<SunburstFlatRow>, number, number>();

  // Stable scene getter for the focus strategy's settled-paint tests.
  const getScene = useCallback(() => sceneRef.current, [sceneRef]);

  // Controlled hover paints through package focus, never a definition rebuild.
  // (Zoom-by-click/keyboard stays on definition selection in the hook below.)
  useEffect(() => {
    if (!isHoverControlled) {return;}
    if (hoveredIndexProp === null || hoveredIndexProp < 0 || hoveredIndexProp >= sectors.length) { clearFocus(); return; }
    const targetId = sectors[hoveredIndexProp]?.id ?? "";
    if (targetId === "") { clearFocus(); return; }
    focusPoint((point) => point.datum.id === targetId);
  }, [isHoverControlled, hoveredIndexProp, sectors, focusPoint, clearFocus]);

  const handleHostRender = useCallback((context: Readonly<ChartRendererRenderContext<TSSunburstNode<SunburstFlatRow>, number, number>>): void => {
    captureRenderContext(context);
  }, [captureRenderContext]);

  // --- Children classification ---
  const {
    centerCount,
    labelsCount,
    hintCount,
    hintProps,
    breadcrumbChildren,
    segmentConfigs,
  } = useMemo(() => classifyChildren(children), [children]);

  const segmentConfigMap = useMemo(
    () => new Map(segmentConfigs.map((config) => [config.arcIndex, config])),
    [segmentConfigs],
  );

  // --- Color helpers ---
  const getColor = useCallback(
    (categoryIndex: number, nodeColor?: string) =>
      nodeColor ?? defaultSunburstColors[categoryIndex % defaultSunburstColors.length],
    [],
  );

  // Drill-down commits the new root; the package owns the zoom morph.
  const { playCycleRef, revealDeadlineTimerRef, zoomTo } = useSunburstZoom({
    focusId,
    isFocusControlled,
    onFocusChange,
    playKey,
    sectorById,
    setHoveredIndex,
    setInternalFocusId,
  });

  // TanStack definition from pre-package inputs; hook owns the memos.
  // Activation zooms through the definition selection (stable: see below).
  const zoomToRef = useRef(zoomTo);
  useEffect(() => {
    zoomToRef.current = zoomTo;
  });


  const selectToZoom = useCallback((zoomId: string): void => {
    zoomToRef.current(zoomId);
  }, []);
  const sunburstContextValue = useSunburstLegacyContextValue({
    containerRef,
    data,
    enterStaggerScale,
    enterTransition,
    focus,
    focusId,
    getColor,
    hoverPop,
    hoveredIndex,
    hoveredSector,
    maxDepth,
    playKey,
    prefersReducedMotion,
    radius,
    sectorById,
    sectors,
    setHoveredIndex,
    size,
    zoomTo,
  });
  const { definition } = useSunburstDefinition({
    enterStaggerScale,
    flatRows,
    focus,
    getScene,
    holeR,
    onActivateId: selectToZoom,
    playKey,
    radius,
    sectorById,
    sectors,
    segmentConfigMap,
    sweepDurationMs,
    sweepEasingCss,
    visibleDepth,
    zoomEasingCss: SUNBURST_ZOOM_EASE,
    zoomMs: SUNBURST_ZOOM_MS,
  });

  /*
   * Phase reporting only, never animation; deps on `[sectors, playKey, ...]` keep hover/zoom recomputes from restarting the timer.
   */
  useEffect((): (() => void) | undefined => {
    if (prefersReducedMotion) {
      setPhase("ready");
      return undefined;
    }
    setPhase("revealing");
    const maxDelay = maxRevealDelayMs(sectors, enterStaggerScale);
    revealDeadlineTimerRef.current = window.setTimeout(() => {
      revealDeadlineTimerRef.current = null;
      setPhase("ready");
    }, sweepDurationMs + maxDelay + REVEAL_DEADLINE_SLACK_MS);
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        globalThis.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
  }, [sectors, playKey, enterStaggerScale, sweepDurationMs, prefersReducedMotion, setPhase, revealDeadlineTimerRef]);

  // Package owns pointer and focus. Hover resolves through native focus;
  // Click/keyboard activation zooms through the definition selection.
  const handleSunburstFocusChange = useCallback(
    (point: { datum: TSSunburstNode<SunburstFlatRow> } | null) => {
      const sector = point ? sectorById.get(point.datum.id) : undefined;
      setHoveredIndex(sector ? sector.arcIndex : null);
    },
    [setHoveredIndex, sectorById],
  );

  // Label geometry reads the package scene so SSR and first paint agree.
  const labelSnap = useMemo(() => {
    if (labelsCount === 0) {return null;}
    return extractSunburstLabelSnap(createChartScene(definition, { height: size, width: size }), focus.id);
  }, [definition, focus.id, labelsCount, size]);

  // --- SB15: 350ms fade-in of the whole chart stage on mount ---
  // Legacy: motion.svg opacity 0→1, duration 0.35, ease [0.22,1,0.36,1].
  useLayoutEffect((): (() => void) | undefined => {
    if (prefersReducedMotion) {return undefined;}
    const container = containerRef.current;
    if (!container) {return undefined;}
    return fadeInChartStage(container);
  }, [prefersReducedMotion]);

  // --- Center circle geometry ---
  // Hub radius is the package `innerRadius` input, matching the hole.
  const centerColor = focus.depth === 0
    ? "var(--chart-background)"
    : getColor(focusBranchIndex(focus.id, sectorById));

  // Labels use the settled scene; the overlay remounts per root.
  const labelItems = useMemo(() => {
    if (labelsCount === 0 || !labelSnap) {return [];}
    return buildSunburstLabelItems(labelSnap, sectorById, hoveredSector?.id ?? null, size);
  }, [labelsCount, labelSnap, sectorById, hoveredSector, size]);

  const maxRevealDelay = useMemo(() => maxRevealDelayMs(sectors, enterStaggerScale), [sectors, enterStaggerScale]);

  const labelsRevealDelayMs = maxRevealDelay + SUNBURST_SWEEP_MS * LABELS_REVEAL_DELAY_FRACTION;

  const labelRevealAnimsRef = useRef<Animation[]>([]);

  const runLabelsReveal = useCallback(() => {
    const container = containerRef.current;
    if (!container) {return null;}
    const svg = container.querySelector<SVGSVGElement>("svg.ts-bkm-sunburst-labels");
    if (!svg) {return null;}
    cancelLabelAnimations(labelRevealAnimsRef.current);
    labelRevealAnimsRef.current = [];
    return startLabelReveal(svg, labelsRevealDelayMs, SUNBURST_SWEEP_MS);
  }, [labelsRevealDelayMs]);

  // Redundant dep omitted: runLabelsReveal already changes identity exactly
  // When labelsRevealDelayMs changes (its useCallback dep, above).
  useLayoutEffect((): (() => void) | undefined => {
    if (labelsCount === 0) {return undefined;}
    if (prefersReducedMotion) {return undefined;}
    return runLabelsReveal() ?? undefined;
  }, [labelsCount, prefersReducedMotion, runLabelsReveal]);

  // --- Latest-ref so the SB1 replay can re-drive labels without adding ---
  // --- runLabelsReveal as an effect dep (which would loop). ---
  const runLabelsRevealRef = useRef(runLabelsReveal);
  useLayoutEffect(() => {
    runLabelsRevealRef.current = runLabelsReveal;
  });

  /*
   * Arcs and phase already replay via the mark key and reveal-phase effect; this effect replays only the WAAPI labels overlay.
   */
  useEffect(() => {
    const next = `${playKey}`;
    if (next === playCycleRef.current) {return;}
    playCycleRef.current = next;

    const container = containerRef.current;
    if (!container) {return;}
    const rerunReveal = (): void => {
      runLabelsRevealRef.current();
    };
    resetLabelsOverlayForReplay(container, rerunReveal);
  }, [playKey, playCycleRef]);


  useEffect(
    () => (): void => {
      cancelLabelAnimations(labelRevealAnimsRef.current);
      labelRevealAnimsRef.current = [];
    },
    [],
  );

  // --- Hint text ---
  const hintText = resolveSunburstHintText(hoveredSector?.trail, focus.depth);
  // Hoisted so the zoom-to-parent closure below captures a narrowed string.
  const zoomParentId = focus.parentId;
  const handleZoomToParent = useCallback(() => {
    if (zoomParentId !== null && zoomParentId !== "") {zoomTo(zoomParentId);}
  }, [zoomParentId, zoomTo]);
  const { boxStyle, outerStyle } = useMemo(() => ({
    boxStyle: { aspectRatio: "1 / 1", maxWidth: size, position: "relative" } as const,
    outerStyle: { maxWidth: "100%", position: "relative", width: size } as const,
  }), [size]);

  return (
    <SunburstProvider value={sunburstContextValue}>
    <div
      className={rootClassName}
      data-bkm-chart="sunburst"
      ref={containerRef}
      style={outerStyle}
    >
      {breadcrumbChildren}
      <div style={boxStyle}>
        <ChartHost
          ariaLabel={ariaLabel ?? `Sunburst chart of ${data.name}`}
          ariaDescription={ariaDescription}
          idPrefix={idPrefix}
          width={size}
          height={size}
          initialWidth={size}
          definition={definition}
          renderer={chartMotionRenderer<TSSunburstNode<SunburstFlatRow>, number, number>()}
          onRender={handleHostRender}
          onFocusChange={handleSunburstFocusChange}
        />
        <SunburstCenterOverlay
          visible={centerCount > 0 && holeR > 1}
          liveCenterR={holeR}
          centerColor={centerColor}
          onZoomToParent={zoomParentId !== null && zoomParentId !== "" ? handleZoomToParent : undefined}
        />
        {labelsCount > 0 && (
          <SunburstLabelsOverlay key={`${focusId}:${playKey}`} items={labelItems} fullRadius={fullRadius} size={size} />
        )}
      </div>
      {hintCount > 0 && (
        <SunburstHintDisplay hintClassName={hintProps?.className}>
          {resolveSunburstHintContent(hintProps?.children, {
            focus,
            hintText,
            hoveredArc: hoveredSector,
          })}
        </SunburstHintDisplay>
      )}
    </div>
    </SunburstProvider>
  );
};

/*
 * Small hooks keep the outer component under its statement and line budgets; all are called unconditionally in order.
 */

/*
 * Only `type`/`duration`/`ease` are read and the primitives stay value-stable, so inline-object identity changes retrigger nothing.
 */
const useSunburstSweepTiming = (
  enterTransition: Readonly<EnterTransition> | undefined,
): { durationMs: number; easingCss: string } =>
  clipRevealTiming(enterTransition, SUNBURST_SWEEP_MS, SUNBURST_SWEEP_EASE);

// Phase tracking with last-value dedup so repeated commits stay silent.
const useSunburstPhase = (
  onPhaseChange: ((phase: SunburstPhase) => void) | undefined,
): ((phase: SunburstPhase) => void) => {
  const phaseRef = useRef<SunburstPhase>("revealing");
  return useCallback((nextPhase: SunburstPhase): void => {
    if (phaseRef.current === nextPhase) {return;}
    phaseRef.current = nextPhase;
    onPhaseChange?.(nextPhase);
  }, [onPhaseChange]);
};

// Pre-package sector index plus flat rows, shared by the outer component.
const useSunburstModel = (data: SunburstNode): SunburstChartModel => useMemo(() => {
  const { maxDepth, rootId, sectorById, sectors } = buildSunburstSectors(data);
  return { flatRows: buildSunburstFlatRows(data), maxDepth, rootId, sectorById, sectors };
}, [data]);

interface SunburstFocusControl {
  readonly focusId: string;
  readonly isFocusControlled: boolean;
  readonly setInternalFocusId: (id: string) => void;
}

// Uncontrolled-focus state plus the data-shape reset, kept together.
const useSunburstFocusControl = (
  rootId: string,
  focusIdProp: string | undefined,
): SunburstFocusControl => {
  const isFocusControlled = focusIdProp !== undefined;
  const [internalFocusId, setInternalFocusId] = useState(rootId);
  const focusId = focusIdProp ?? internalFocusId;
  /*
   * Re-seed during render so no stale-focus commit flashes first; a mode toggle resyncs the same way.
   */
  const [prevFocusReset, setPrevFocusReset] = useState({ isControlled: isFocusControlled, rootId });
  if (prevFocusReset.rootId !== rootId || prevFocusReset.isControlled !== isFocusControlled) {
    setPrevFocusReset({ isControlled: isFocusControlled, rootId });
    if (!isFocusControlled) {setInternalFocusId(rootId);}
  }
  return { focusId, isFocusControlled, setInternalFocusId };
};

interface SunburstResolvedFocus {
  readonly focus: Focus | undefined;
  readonly model: SunburstChartModel;
  readonly rootFocus: Focus | undefined;
}

// Resolves the active focus against the sector index.
const useSunburstResolvedFocus = (
  baseModel: SunburstChartModel,
  data: SunburstNode,
  focusId: string,
): SunburstResolvedFocus => {
  const rootFocus: Focus = {
    a0: 0,
    a1: 0,
    categoryIndex: 0,
    depth: 0,
    id: baseModel.rootId,
    name: data.name,
    parentId: null,
  };
  const focus = baseModel.sectorById.get(focusId) ?? rootFocus;
  return { focus, model: baseModel, rootFocus };
};

interface SunburstInnerRenderProps {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly data: SunburstNode;
  readonly enterStaggerScale: number;
  readonly focus: Focus;
  readonly focusId: string;
  readonly hoverPop: number;
  readonly hoveredIndexProp?: number | null;
  readonly isFocusControlled: boolean;
  readonly model: SunburstChartModel;
  readonly onFocusChange?: (focusId: string) => void;
  readonly onHoverChange?: (index: number | null) => void;
  readonly paddingProp?: number;
  readonly playKey: number;
  readonly prefersReducedMotion: boolean;
  readonly setInternalFocusId: (id: string) => void;
  readonly setPhase: (phase: SunburstPhase) => void;
  readonly size: number;
  readonly sweepDurationMs: number;
  readonly sweepEasingCss: string;
  readonly enterTransition?: EnterTransition;
}

// Renders the inner chart as a plain function call (not a component), so the
// Element tree — and therefore reconciliation — is unchanged.
const renderSunburstInner = (props: Readonly<SunburstInnerRenderProps>): ReactElement => {
  const {
    ariaDescription,
    ariaLabel,
    children,
    className,
    data,
    enterStaggerScale,
    focus,
    focusId,
    hoverPop,
    hoveredIndexProp,
    isFocusControlled,
    model,
    onFocusChange,
    onHoverChange,
    paddingProp,
    playKey,
    prefersReducedMotion,
    setInternalFocusId,
    setPhase,
    size,
    sweepDurationMs,
    sweepEasingCss,
    enterTransition,
  } = props;
  return (
    <SunburstChartInner
      data={data}
      ariaDescription={ariaDescription}
      ariaLabel={ariaLabel}
      size={size}
      rootClassName={className}
      focus={focus}
      model={model}
      focusId={focusId}
      isFocusControlled={isFocusControlled}
      setInternalFocusId={setInternalFocusId}
      setPhase={setPhase}
      onFocusChange={onFocusChange}
      hoveredIndexProp={hoveredIndexProp}
      onHoverChange={onHoverChange}
      hoverPop={hoverPop}
      paddingProp={paddingProp}
      prefersReducedMotion={prefersReducedMotion}
      playKey={playKey}
      sweepDurationMs={sweepDurationMs}
      sweepEasingCss={sweepEasingCss}
      enterStaggerScale={enterStaggerScale}
      enterTransition={enterTransition}
    >
      {children}
    </SunburstChartInner>
  );
};

const SunburstChartBody = ({
  data,
  size = DEFAULT_SUNBURST_SIZE,
  playKey = 0,
  className,
  focusId: focusIdProp,
  onFocusChange,
  hoveredIndex: hoveredIndexProp,
  onHoverChange,
  hoverPop = DEFAULT_HOVER_POP,
  padding: paddingProp,
  onPhaseChange,
  enterTransition,
  enterStaggerScale = 1,
  children,
  ariaLabel,
  ariaDescription,
}: SunburstChartProps): ReactElement | null => {
  const { durationMs: sweepDurationMs, easingCss: sweepEasingCss } =
    useSunburstSweepTiming(enterTransition);
  const setPhase = useSunburstPhase(onPhaseChange);
  const baseModel = useSunburstModel(data);
  const { focusId, isFocusControlled, setInternalFocusId } = useSunburstFocusControl(baseModel.rootId, focusIdProp);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { focus, model, rootFocus } = useSunburstResolvedFocus(baseModel, data, focusId);
  if (!(focus && rootFocus)) {return null;}

  // The subtree below needs non-null focus/rootFocus; render it through an inner
  // Component so every hook stays unconditional (react-hooks/rules-of-hooks).
  return renderSunburstInner({
    ariaDescription,
    ariaLabel,
    children,
    className,
    data,
    enterStaggerScale,
    enterTransition,
    focus,
    focusId,
    hoverPop,
    hoveredIndexProp,
    isFocusControlled,
    model,
    onFocusChange,
    onHoverChange,
    paddingProp,
    playKey,
    prefersReducedMotion,
    setInternalFocusId,
    setPhase,
    size,
    sweepDurationMs,
    sweepEasingCss,
  });
};

SunburstChartBody.displayName = "SunburstChartBody";

const SunburstChart = ({
  ariaDescription,
  ariaLabel,
  children,
  className,
  data,
  enterStaggerScale,
  enterTransition,
  focusId,
  hoverPop,
  hoveredIndex,
  onFocusChange,
  onHoverChange,
  onPhaseChange,
  padding,
  playKey,
  size,
}: SunburstChartProps): ReactElement => (
  <SunburstChartBody
    ariaDescription={ariaDescription}
    ariaLabel={ariaLabel}
    className={className}
    data={data}
    enterStaggerScale={enterStaggerScale}
    enterTransition={enterTransition}
    focusId={focusId}
    hoverPop={hoverPop}
    hoveredIndex={hoveredIndex}
    onFocusChange={onFocusChange}
    onHoverChange={onHoverChange}
    onPhaseChange={onPhaseChange}
    padding={padding}
    playKey={playKey}
    size={size}
  >
    {children}
  </SunburstChartBody>
);

SunburstChart.displayName = "SunburstChart";

export { SunburstCenter } from "./internal/sunburst-center";
export { SunburstLabels } from "./internal/sunburst-labels";
export type { SunburstLabelsProps } from "./internal/sunburst-labels";
export { SunburstHint } from "./internal/sunburst-hint";
export type { SunburstHintContext, SunburstHintProps } from "./internal/sunburst-hint";
export {
  SunburstBreadcrumb,
} from "./internal/sunburst-breadcrumb";
export { buildSunburstBreadcrumbItems, useSunburstBreadcrumbItems } from "./internal/sunburst-breadcrumb-items";
export type {
  SunburstBreadcrumbProps,
} from "./internal/sunburst-breadcrumb";
export type { SunburstBreadcrumbItem } from "./internal/sunburst-breadcrumb-items";
export type { ArcDatum, Focus, SunburstNode } from "./internal/sunburst-types";
export { SunburstChart };
export { SunburstSegment } from "./internal/sunburst-segment";
export type { SunburstChartProps };
export type { SunburstSegmentProps } from "./internal/sunburst-segment";
