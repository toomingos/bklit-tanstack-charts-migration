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
import type { ReactElement, ReactNode } from "react";
import { ChartHost } from "./internal/chart-host";
import type { ChartRendererRenderContext } from "@tanstack/charts";
import { useFocusInjection } from "./internal/focus-injection";
import type { SunburstNode as TSSunburstNode } from "@tanstack/charts/hierarchy/sunburst";
import {
  buildArcs,
  geometryFor,
  ringOptions,
  geomCentroidAngle,
  geomCentroidRadius,
  defaultSunburstGrowPadding,
  transitionGeometry,
} from "./internal/sunburst-geometry";
import type { ArcDatum, ArcGeometry, Focus, SunburstFlatRow } from "./internal/sunburst-geometry";
import {
  defaultSunburstColors,
} from "./internal/sunburst-colors";
import type { SunburstNode } from "./internal/sunburst-types";
import { maxRevealDelayMs } from "./internal/sunburst-reveal";
import { setRevealDeadline } from "./internal/deferred-reveal";
import {
  cancelLabelAnimations,
  resetLabelsOverlayForReplay,
  startLabelReveal,
} from "./internal/sunburst-label-reveal";
import { usePrefersReducedMotion } from "./internal/use-prefers-reduced-motion";
import { displayNameOf } from "./internal/children-extract";
import { SunburstCenterOverlay } from "./internal/sunburst-center-overlay";
import { SunburstLabelsOverlay } from "./internal/sunburst-labels-overlay";
import type { SunburstSegmentProps } from "./internal/sunburst-segment";
import { resolveSunburstHintContent } from "./internal/sunburst-hint-content";
import { SunburstHintDisplay } from "./internal/sunburst-hint";
import type { SunburstHintProps } from "./internal/sunburst-hint";
import { clipRevealTiming } from "./internal/enter-transition";
import type { EnterTransition } from "./internal/enter-transition";
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
// Label legibility floors: minimum arc length and ring thickness in pixels for a label to render.
const LABEL_MIN_ARC_LENGTH_PX = 26;
const LABEL_MIN_RING_WIDTH_PX = 16;
// SB15 whole-stage fade-in duration, matching legacy motion.svg opacity 0 to 1.
const STAGE_FADE_IN_MS = 350;
// Slack added to sweep plus stagger when scheduling the reveal-phase deadline timer.
const REVEAL_DEADLINE_SLACK_MS = 935;
// Fraction of the sweep duration added to the max stagger delay before labels reveal.
const LABELS_REVEAL_DELAY_FRACTION = 0.85;
// Smallest chart radius in pixels after grow-padding is subtracted.
const MIN_SUNBURST_RADIUS_PX = 8;
// Default chart size and hover pop-out, matching bklit's SunburstChart defaults.
const DEFAULT_SUNBURST_SIZE = 520;
const DEFAULT_HOVER_POP = 8;
// Degree geometry for label rotation: radians-to-degrees half-circle and the flip threshold.
const DEGREES_PER_HALF_CIRCLE = 180;
const LABEL_FLIP_THRESHOLD_DEGREES = 90;

const isRelatedArc = (arc: ReadonlySunburstArc, hovered: ReadonlySunburstArc): boolean =>
  arc.id === hovered.id || arc.id.startsWith(`${hovered.id} / `) || hovered.id.startsWith(`${arc.id} / `);

const resolveSunburstHintText = (hoveredTrail: readonly string[] | undefined, focusDepth: number): string => {
  if (hoveredTrail !== undefined) {
    return hoveredTrail.join("  \u203A  ");
  }
  if (focusDepth === 0) {
    return "Click a segment to zoom in · hover to inspect";
  }
  return "Click the center to zoom out";
};

/*
 * Deep-readonly arc view: `Readonly<ArcDatum>` leaves `trail` mutable; mirrors the unexported helper in sunburst-geometry.ts.
 */
type ReadonlySunburstArc = Readonly<Omit<ArcDatum, "trail">> & {
  readonly trail: readonly string[];
};

// Single label overlay entry, resolved from an arc's zoom-morphed geometry.
interface SunburstLabelEntry {
  readonly deg: number;
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

// Normalizes a centroid angle into a readable label rotation in degrees.
const normalizeLabelRotation = (midAngle: number): number => {
  const rawDegrees = (midAngle * DEGREES_PER_HALF_CIRCLE) / Math.PI - LABEL_FLIP_THRESHOLD_DEGREES;
  if (rawDegrees > LABEL_FLIP_THRESHOLD_DEGREES) {return rawDegrees - DEGREES_PER_HALF_CIRCLE;}
  if (rawDegrees < -LABEL_FLIP_THRESHOLD_DEGREES) {return rawDegrees + DEGREES_PER_HALF_CIRCLE;}
  return rawDegrees;
};

// Builds the zero-or-one label entries for one arc's resolved geometry,
// Applying the hover-cull and minimum-size rules.
const buildLabelEntry = (
  arc: ReadonlySunburstArc,
  base: Readonly<ArcGeometry>,
  hoveredArc: ReadonlySunburstArc | null,
): SunburstLabelEntry[] => {
  if (hoveredArc && !isRelatedArc(arc, hoveredArc)) {return [];}
  const centroidRadius = geomCentroidRadius(base);
  if ((base.a1 - base.a0) * centroidRadius < LABEL_MIN_ARC_LENGTH_PX || base.outerR - base.innerR < LABEL_MIN_RING_WIDTH_PX) {return [];}
  const midAngle = geomCentroidAngle(base);
  const itemX = Math.sin(midAngle) * centroidRadius;
  const itemY = -Math.cos(midAngle) * centroidRadius;
  return [{ deg: normalizeLabelRotation(midAngle), id: arc.id, label: arc.name, x: itemX, y: itemY }];
};

// Fades the chart stage in on mount, returning its teardown, or undefined when
// The stage is not rendered yet.
const fadeInChartStage = (container: HTMLElement): (() => void) | undefined => {
  const stage = container.querySelector<SVGSVGElement>("svg.ts-chart");
  if (!stage) {return undefined;}
  stage.style.opacity = "0";
  const fadeAnimation = stage.animate(
    [{ opacity: "0" }, { opacity: "1" }],
    { duration: STAGE_FADE_IN_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
  );
  return (): void => {
    fadeAnimation.cancel();
    stage.style.opacity = "";
  };
};

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

interface SunburstChartInnerProps {
  readonly ariaDescription?: string;
  readonly ariaLabel?: string;
  readonly data: SunburstNode;
  readonly size: number;
  readonly rootClassName?: string;
  readonly focus: Focus;
  readonly layout: {
    arcs: ArcDatum[];
    maxDepth: number;
    focusById: Map<string, Focus>;
    rootId: string;
  };
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
  readonly children: ReactNode;
}

const SunburstChartInner = ({
  ariaDescription,
  ariaLabel,
  data,
  size,
  rootClassName,
  focus,
  layout,
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
  children,
}: SunburstChartInnerProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Layout (verbatim bklit math) ---
  const { arcs, maxDepth, focusById, rootId } = layout;

  const fullRadius = size / 2;
  const growPadding = paddingProp ?? defaultSunburstGrowPadding(maxDepth, size, hoverPop);
  const radius = Math.max(MIN_SUNBURST_RADIUS_PX, fullRadius - growPadding);

  // --- Hover state (direct React state, no coordinator mediator) ---
  const isHoverControlled = hoveredIndexProp !== undefined;
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const hoveredArcIndex = hoveredIndexProp ?? internalHoveredIndex;

  const setHoveredArcIndex = useCallback(
    (index: number | null) => {
      if (isHoverControlled) {
        onHoverChange?.(index);
      } else {
        setInternalHoveredIndex(index);
      }
    },
    [isHoverControlled, onHoverChange],
  );

  const hoveredArc = useMemo(() => {
    if (hoveredArcIndex === null) {return null;}
    return arcs[hoveredArcIndex] ?? null;
  }, [arcs, hoveredArcIndex]);

  const { captureRenderContext, clearFocus, focusPoint } = useFocusInjection<TSSunburstNode<SunburstFlatRow>, number, number>();

  // Controlled hover paints through package focus, never a definition rebuild.
  // (Zoom-by-click/keyboard stays on definition selection in the hook below.)
  useEffect(() => {
    if (!isHoverControlled) {return;}
    if (hoveredIndexProp === null || hoveredIndexProp < 0 || hoveredIndexProp >= arcs.length) { clearFocus(); return; }
    const targetId = arcs[hoveredIndexProp].id;
    focusPoint((point) => point.datum.id === targetId);
  }, [isHoverControlled, hoveredIndexProp, arcs, focusPoint, clearFocus]);

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

  const getFill = useCallback(
    (arcIndex: number, fillOverride?: string, colorOverride?: string) => {
      if (fillOverride !== undefined && fillOverride !== "") {return fillOverride;}
      if (!Number.isInteger(arcIndex) || arcIndex < 0 || arcIndex >= arcs.length) {return defaultSunburstColors[0];}
      const arc = arcs[arcIndex];
      return colorOverride ?? arc.fill ?? arc.color ?? getColor(arc.categoryIndex);
    },
    [arcs, getColor],
  );

  // Zoom tween plus committed-focus state; hook owns the contiguous group above.
  const { playCycleRef, prevFocus, revealDeadlineTimerRef, zoomT, zoomTo } = useSunburstZoom({
    focus,
    focusById,
    focusId,
    isFocusControlled,
    onFocusChange,
    playKey,
    prefersReducedMotion,
    rootId,
    setHoveredArcIndex,
    setInternalFocusId,
    zoomMs: SUNBURST_ZOOM_MS,
  });

  // TanStack definition plus the native key bridges; hook owns the memos.
  // Activation zooms through the definition selection (stable: see below).
  const zoomToRef = useRef(zoomTo);
  useEffect(() => {
    zoomToRef.current = zoomTo;
  });
  const selectToZoom = useCallback((zoomId: string): void => {
    zoomToRef.current(zoomId);
  }, []);
  const { arcsById, definition } = useSunburstDefinition({
    arcs,
    data,
    enterStaggerScale,
    focus,
    getFill,
    maxDepth,
    onActivateId: selectToZoom,
    playKey,
    radius,
    segmentConfigMap,
    size,
    sweepDurationMs,
    sweepEasingCss,
    zoomEasingCss: SUNBURST_ZOOM_EASE,
    zoomMs: SUNBURST_ZOOM_MS,
  });

  /*
   * Phase reporting only, never animation; deps on `[arcs, playKey, ...]` keep hover/zoom recomputes from restarting the timer.
   */
  useEffect((): (() => void) | undefined => {
    if (prefersReducedMotion) {
      setPhase("ready");
      return undefined;
    }
    setPhase("revealing");
    const maxDelay = maxRevealDelayMs(arcs, enterStaggerScale);
    revealDeadlineTimerRef.current = setRevealDeadline(sweepDurationMs + maxDelay + REVEAL_DEADLINE_SLACK_MS, {
      onDeadline: () => { setPhase("ready"); },
    });
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        globalThis.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
    };
  }, [arcs, playKey, enterStaggerScale, sweepDurationMs, prefersReducedMotion, setPhase, revealDeadlineTimerRef]);

  // Package owns pointer and focus. Hover resolves through native focus;
  // Click/keyboard activation zooms through the definition selection.
  const handleSunburstFocusChange = useCallback(
    (point: { datum: TSSunburstNode<SunburstFlatRow> } | null) => {
      const arc = point ? arcsById.get(point.datum.id) : undefined;
      setHoveredArcIndex(arc ? arc.arcIndex : null);
    },
    [setHoveredArcIndex, arcsById],
  );

  // --- SB15: 350ms fade-in of the whole chart stage on mount ---
  // Legacy: motion.svg opacity 0→1, duration 0.35, ease [0.22,1,0.36,1].
  useLayoutEffect((): (() => void) | undefined => {
    if (prefersReducedMotion) {return undefined;}
    const container = containerRef.current;
    if (!container) {return undefined;}
    return fadeInChartStage(container);
  }, [prefersReducedMotion]);

  // --- Center circle geometry ---
  // Hub radius blends with the in-flight d-morph instead of snapping at commit.
  const liveCenterR = useMemo(() => {
    const toR = ringOptions(focus.depth, maxDepth, radius).centerR;
    const fromR = ringOptions(prevFocus.depth, maxDepth, radius).centerR;
    return toR * zoomT + fromR * (1 - zoomT);
  }, [focus.depth, prevFocus.depth, maxDepth, radius, zoomT]);

  const centerColor = focus.depth === 0
    ? "var(--chart-background)"
    : getColor(focus.categoryIndex);

  // --- Labels: zoom-morphed via transitionGeometry(prevFocus→focus, zoomT);
  // SB12 (legacy parity): unrelated arcs' labels are CULLED on hover (not dimmed).
  const labelItems = useMemo(() => {
    if (labelsCount === 0) {return [];}
    const inZoom = zoomT < 1;
    const fromF = inZoom ? prevFocus : focus;
    return arcs
      .flatMap((arc: ReadonlySunburstArc): SunburstLabelEntry[] => {
        const base = inZoom
          ? transitionGeometry({ arc, fromFocus: fromF, maxDepth, progress: zoomT, radius, toFocus: focus })
          : geometryFor(arc, focus, maxDepth, radius);
        if (!base) {return [];}
        return buildLabelEntry(arc, base, hoveredArc);
      });
  }, [labelsCount, arcs, focus, prevFocus, maxDepth, radius, hoveredArc, zoomT]);

  const maxRevealDelay = useMemo(() => maxRevealDelayMs(arcs, enterStaggerScale), [arcs, enterStaggerScale]);

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
  const hintText = resolveSunburstHintText(hoveredArc?.trail, focus.depth);
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
          width={size}
          height={size}
          initialWidth={size}
          definition={definition}
          renderer={chartMotionRenderer<TSSunburstNode<SunburstFlatRow>, number, number>()}
          onRender={handleHostRender}
          onFocusChange={handleSunburstFocusChange}
        />
        <SunburstCenterOverlay
          visible={centerCount > 0 && liveCenterR > 1}
          liveCenterR={liveCenterR}
          centerColor={centerColor}
          onZoomToParent={zoomParentId !== null && zoomParentId !== "" ? handleZoomToParent : undefined}
        />
        {labelsCount > 0 && (
          <SunburstLabelsOverlay items={labelItems} fullRadius={fullRadius} size={size} />
        )}
      </div>
      {hintCount > 0 && (
        <SunburstHintDisplay hintClassName={hintProps?.className}>
          {resolveSunburstHintContent(hintProps?.children, {
            focus,
            hintText,
            hoveredArc,
          })}
        </SunburstHintDisplay>
      )}
    </div>
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

interface SunburstLayoutState {
  readonly arcs: ArcDatum[];
  readonly focusById: Map<string, Focus>;
  maxDepth: number;
  readonly rootId: string;
}

// Layout derivation (verbatim bklit math), shared by the outer component.
const useSunburstLayout = (data: SunburstNode): SunburstLayoutState => {
  const { arcs, maxDepth, focusById, rootId } = useMemo(
    () => buildArcs(data),
    [data],
  );
  return useMemo(() => ({ arcs, focusById, maxDepth, rootId }), [
    arcs,
    focusById,
    maxDepth,
    rootId,
  ]);
};

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
  readonly layout: SunburstLayoutState;
  readonly rootFocus: Focus | undefined;
}

// Resolves the active focus against the layout and memoizes the inner layout.
const useSunburstResolvedFocus = (
  baseLayout: Readonly<SunburstLayoutState>,
  focusId: string,
): SunburstResolvedFocus => {
  const rootFocus = baseLayout.focusById.get(baseLayout.rootId);
  const focus = baseLayout.focusById.get(focusId) ?? rootFocus;
  const layout = useMemo(() => ({
    arcs: baseLayout.arcs,
    focusById: baseLayout.focusById,
    maxDepth: baseLayout.maxDepth,
    rootId: baseLayout.rootId,
  }), [baseLayout]);
  return { focus, layout, rootFocus };
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
  readonly layout: SunburstLayoutState;
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
    layout,
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
  } = props;
  return (
    <SunburstChartInner
      data={data}
      ariaDescription={ariaDescription}
      ariaLabel={ariaLabel}
      size={size}
      rootClassName={className}
      focus={focus}
      layout={layout}
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
    >
      {children}
    </SunburstChartInner>
  );
};

const SunburstChart = ({
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
  const baseLayout = useSunburstLayout(data);
  const { focusId, isFocusControlled, setInternalFocusId } = useSunburstFocusControl(baseLayout.rootId, focusIdProp);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { focus, layout, rootFocus } = useSunburstResolvedFocus(baseLayout, focusId);
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
    focus,
    focusId,
    hoverPop,
    hoveredIndexProp,
    isFocusControlled,
    layout,
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
export type { ArcDatum, Focus } from "./internal/sunburst-geometry";
export type { SunburstNode } from "./internal/sunburst-types";
export { SunburstChart };
export { SunburstSegment } from "./internal/sunburst-segment";
export type { SunburstChartProps };
export type { SunburstSegmentProps } from "./internal/sunburst-segment";
