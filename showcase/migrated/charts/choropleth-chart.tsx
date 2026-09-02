// Migrated bklit-ui ChoroplethChart — same public API, rendered by TanStack
// Charts geoShape mark + a local port of @visx/zoom for zoom GESTURE INPUT
// (T19 — `internal/zoom-engine.tsx`; see that file's header for why the
// gesture engine can't stay a `@visx/zoom` import).
//
// C6 (06-brush-zoom.md, "Choropleth 2-D zoom" row): the APPLICATION half —
// how the gesture's transform matrix reaches the screen — no longer writes a
// raw SVG `transform` attribute onto `g.ts-chart__marks` + the graticule.
// `geoShape`'s `projection` option takes a FACTORY the mark calls per render
// (`GeoProjectionInput`, dist/geo.d.ts:16, @tanstack/charts@0.15.0), so
// zoom scale/translate become projection PARAMETERS, rebuilt each committed
// animation frame — see `projection`'s useMemo and `stepZoomFrame` below.
// The gesture INPUT path (internal/zoom-engine.tsx: @use-gesture wiring,
// matrix math, `transformMatrix`/`isDragging` state) is UNCHANGED — this
// file only changed what it DOES with that state.
//
// Principles (bklit native, tanstack gap):
//   - bklit uses @visx/zoom <Zoom> with svg ref=zoom.containerRef as gesture
//     target and single <g transform={zoom.toString()}> for content. This
//     port keeps <Zoom> as the gesture source; the <g transform> half is
//     retired (C6) in favor of per-frame reprojection (see above).
//   - TanStack has no geo zoom primitive (interaction-zoom is 1D zoomX for
//     time series only). Gap stays consumer-owned, ported verbatim from bklit.
//   - No wrapper CSS transform, no viewBox fight. Host width/viewBox stable;
//     the projection itself now carries the zoomed scale/translate, so both
//     the marks and the graticule (fed the SAME `projection` value) redraw
//     already-zoomed — no group transform, no second write to keep in sync.

import React, {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { FeatureCollection, type Feature, type Geometry } from "geojson";
import { geoCentroid, geoMercator, geoPath, type GeoProjection } from "d3-geo";
import type { TransformMatrix, ProvidedZoom, ZoomState } from "./internal/zoom-engine";
import { identityMatrix } from "./internal/zoom-engine";
import { Zoom } from "./internal/zoom-engine";
import { RendererChart } from "@tanstack/react-charts/tooltip";
import {
  type ChartPoint,
  type ChartRendererRenderContext,
  type ChartValue,
  type StaticChartDefinition,
} from "@tanstack/charts";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import { geoShape } from "@tanstack/charts/geo";
import { chartMotionRenderer } from "./internal/motion-renderer";
import { CHART_ROLE } from "./children";
import {
  createChoroplethHoverChrome,
  type ChoroplethHoverChrome,
} from "./internal/choropleth-hover-chrome";
import { intFmt } from "./internal/formatters";
import { ChoroplethGraticuleOverlay } from "./internal/choropleth-graticule";
import { findRevealRoot, isRevealed, markRevealed, onPostPaint, setRevealDeadline } from "./internal/deferred-reveal";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { useContainerWidth } from "./internal";
import { clipRevealTiming, type EnterTransition } from "./internal/enter-transition";
import "./styles.css";

// ---------------------------------------------------------------------------
// Types (matching bklit's public API exactly)
// ---------------------------------------------------------------------------

export interface ChoroplethFeatureProperties {
  name?: string;
  id?: string | number;
  [key: string]: unknown;
}

export type ChoroplethFeature = Feature<Geometry, ChoroplethFeatureProperties>;

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChoroplethChartProps {
  data: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  margin?: Partial<Margin>;
  animationDuration?: number;
  /** P5.5 CP1 — bklit `choropleth-chart.tsx:41`. Was typed `unknown` and read
      by nothing; now drives the feature-group enter fade's duration/easing
      (spring coerced to tween, bklit `animation.ts:18`). */
  enterTransition?: EnterTransition;
  /** P5.5 CP2 — bklit `choropleth-chart.tsx:43`. Replay epoch input; bklit
      bumps its epoch from `[animationDuration, revealSignature]`
      (`choropleth-chart.tsx:389-397`). Was forwarded to the body and never
      read inside it. */
  revealSignature?: string;
  aspectRatio?: string;
  scale?: number;
  center?: [number, number];
  translate?: [number, number];
  zoomEnabled?: boolean;
  zoomMin?: number;
  zoomMax?: number;
  initialZoom?: TransformMatrix;
  className?: string;
  children: ReactNode;
}

export interface ChoroplethFeatureProps {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fadedOpacity?: number;
  getFeatureColor?: (feature: ChoroplethFeature, index: number) => string;
  patterns?: ReactNode;
  getFeaturePattern?: (feature: ChoroplethFeature, index: number) => string | null | undefined;
}

export interface ChoroplethTooltipProps {
  content?: (props: { feature: ChoroplethFeature; index: number }) => ReactNode;
  formatValue?: (value: number) => string;
  getFeatureName?: (feature: ChoroplethFeature, index: number) => string;
  getFeatureValue?: (feature: ChoroplethFeature, index: number) => number | undefined;
  valueLabel?: string;
  className?: string;
  panelStyle?: React.CSSProperties;
  backgroundColor?: string;
}

export interface ChoroplethGraticuleProps {
  stroke?: string;
  strokeWidth?: number;
  step?: [number, number];
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

// P5.6 CP10 — legacy's `ZoomInstance<E> = ProvidedZoom<E> & ZoomState`
// (`repos/bklit-ui/.../choropleth-context.tsx:17-28`, which hand-declares
// `ZoomState` because it predates visx exporting one). visx DOES export it now
// (`@visx/zoom/lib/types.d.ts`), and — decisive here — its `<Zoom>` render prop
// already HANDS the child object with `initialTransformMatrix`,
// `transformMatrix` and `isDragging` on it. So this was never missing state:
// the `as unknown as ProvidedZoom<SVGSVGElement>` casts below were narrowing
// three live runtime fields out of the type. Pure type widening, no plumbing.
export type ChoroplethZoomInstance<E extends Element> = ProvidedZoom<E> & ZoomState;

export interface ChoroplethZoomContextValue {
  zoom: ChoroplethZoomInstance<SVGSVGElement> | null;
}

export const ChoroplethZoomContext = createContext<ChoroplethZoomContextValue>({ zoom: null });

export function useChoroplethZoom(): ChoroplethZoomContextValue {
  return useContext(ChoroplethZoomContext);
}

// P5.6 CP9 — this was `{ width, height }`. Legacy's
// `ChoroplethStableContextValue` (`choropleth-context.tsx:68-100`) is far
// wider, and the fields below are the ones legacy's OWN consumers read:
// `containerRef, width, height, features` (choropleth-tooltip.tsx:51),
// `rawPathGenerator` (choropleth-graticule.tsx:21), `enterTransition,
// animationDuration` (choropleth-feature.tsx:161) and `features,
// pathGenerator, projectPoint, isLoaded, revealEpoch, width, height`
// (choropleth-feature.tsx:222-229). All of them are things migrated already
// computes internally; exposing them costs nothing new.
//
// TWO legacy fields are deliberately NOT restored:
//   - `featurePaths` — legacy precomputes one path string per feature because
//     its own `<ChoroplethFeature>` renders them; migrated's features are
//     TanStack `geoShape` marks, so materialising that array would be pure
//     per-render cost for an array nothing reads. `pathGenerator` is exposed,
//     so a caller that wants them can build them.
//   - `animationDuration`'s sibling `margin` IS restored, but legacy's
//     `innerWidth`/`innerHeight` are recomputed here rather than threaded.
export interface ChoroplethContextValue {
  features: ChoroplethFeature[];
  featureCollection: FeatureCollection<Geometry, ChoroplethFeatureProperties>;
  /** Projected SVG path for one feature, or `undefined` before the projection
      exists (width/height still 0). */
  pathGenerator: (feature: ChoroplethFeature) => string | undefined;
  /** Same projection, any GeoJSON object — legacy's graticule path source. */
  // biome-ignore lint/suspicious/noExplicitAny: GeoJSON types are complex
  rawPathGenerator: (geo: any) => string | null;
  projectPoint: (coords: [number, number]) => [number, number] | null;
  /** C6 — the sanctioned replacement for matrix-inverting the zoom gesture's
      transform to hit-test a screen point: this calls the CURRENT (already
      zoomed, see `projection`'s useMemo) projection's own `.invert()`
      (standard d3-geo `GeoProjection` API). Pair with a click handler's
      `host.interaction.clientToScene` (client coords -> scene coords; scene
      coords ARE plot-local here since choropleth's `margin: 0`) to build a
      click-to-geo picker without touching `internal/zoom-engine.tsx`'s
      matrix math. No current consumer needs this (see final report) — added
      for symmetry with `projectPoint` and because it's what C6 replaces the
      retired inverse-matrix hit-testing capability WITH. */
  unprojectPoint: (point: [number, number]) => [number, number] | null;
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margin;
  containerRef: RefObject<HTMLDivElement | null>;
  isLoaded: boolean;
  animationDuration: number;
  enterTransition?: EnterTransition;
  revealEpoch: number;
}

const EMPTY_FEATURE_COLLECTION: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: [],
};

const CHOROPLETH_CONTEXT_DEFAULT: ChoroplethContextValue = {
  features: [],
  featureCollection: EMPTY_FEATURE_COLLECTION,
  pathGenerator: () => undefined,
  rawPathGenerator: () => null,
  projectPoint: () => null,
  unprojectPoint: () => null,
  width: 0,
  height: 0,
  innerWidth: 0,
  innerHeight: 0,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  containerRef: { current: null },
  isLoaded: false,
  animationDuration: 0,
  revealEpoch: 0,
};

const ChoroplethContext = createContext<ChoroplethContextValue>(CHOROPLETH_CONTEXT_DEFAULT);

export function useChoropleth(): ChoroplethContextValue {
  return useContext(ChoroplethContext);
}

// bklit choropleth-context.tsx: defaultChoroplethColors = [...CHART_SCALE_VARS]
const DEFAULT_CHOROPLETH_COLORS = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export { type TransformMatrix } from "./internal/zoom-engine";

const DEFAULT_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 };

const DEFAULT_INITIAL_ZOOM: TransformMatrix = identityMatrix();

const ANIMATION_DURATION_MS = 800;
const FEATURE_ENTER_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
// C2: matches legacy `design-tokens.ts`'s `BOX_OFFSET` (16px) — the retired
// `positionBox` placed the panel to the right of the anchor by this offset,
// flipping left only on overflow (`internal/tooltip-chrome.ts:448-449`).
const CHOROPLETH_TOOLTIP_OFFSET = 16;

// ---------------------------------------------------------------------------
// Config-carrier children
// ---------------------------------------------------------------------------

type RoleCarrier = { [CHART_ROLE]?: string };

function _ChoroplethFeatureComponent(_props: ChoroplethFeatureProps): null { return null; }
(_ChoroplethFeatureComponent as unknown as RoleCarrier)[CHART_ROLE] = "choroplethFeature";

function _ChoroplethTooltip(_props: ChoroplethTooltipProps): null { return null; }
(_ChoroplethTooltip as unknown as RoleCarrier)[CHART_ROLE] = "choroplethTooltip";

function _ChoroplethGraticule(_props: ChoroplethGraticuleProps): null { return null; }
(_ChoroplethGraticule as unknown as RoleCarrier)[CHART_ROLE] = "choroplethGraticule";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveFeatureFill(
  feature: ChoroplethFeature,
  index: number,
  baseFill: string | undefined,
  getFeatureColor: ChoroplethFeatureProps["getFeatureColor"],
  getFeaturePattern: ChoroplethFeatureProps["getFeaturePattern"],
): string {
  const patternId = getFeaturePattern?.(feature, index);
  if (patternId) return `url(#${patternId})`;
  if (baseFill) return baseFill;
  if (getFeatureColor) return getFeatureColor(feature, index);
  return DEFAULT_CHOROPLETH_COLORS[index % DEFAULT_CHOROPLETH_COLORS.length] ?? "var(--chart-1)";
}

// Same key a rendered path is stamped with (`data-ts-key`, via geoShape's
// `key` option below) — shared so the hover-dim accessors below can compare
// against the chart's `hoveredKey` React state without recomputing it
// differently in two places.
function choroplethFeatureKey(feature: ChoroplethFeature): string {
  return feature.properties?.name ?? String(feature.id ?? "");
}

// E2-followup: `geoShape`'s per-node key is NOT `${id}:${key}` verbatim —
// dist/geo.js's `render()` computes `key = \`${id}:${valueKey(keys[datumIndex])}\``
// (`keys` = `inferredKeyValues(data, options.key)`, i.e. `choroplethFeatureKey`
// run per feature), where `valueKey` (dist/scales.js, not publicly exported —
// package.json `exports` has no `./scales` entry) tags every value with its
// `typeof` for cross-type uniqueness: a string `s` becomes
// `string:${s.length}:${s}`. The original E2 fix stamped `choropleth:${name}`
// here, missing that wrapping — so `resolveFeatureAlpha` below NEVER matched
// `hoveredKey` (which comes from the real DOM `data-ts-key`, which DOES carry
// the wrapping) for any feature, silently no-op'ing the highlight (every
// feature fell through to `dimOpacity`) while hover DETECTION and the native
// tooltip stayed correct (those compare against `scene.points[].key` / the
// raw DOM attribute directly, never through this helper). Invisible on most
// countries (both the wrongly-dimmed "hovered" one and its dimmed neighbors
// render close to the same alpha), but large enough on the USA's
// Mercator-inflated Alaska+mainland+islands footprint to fail the QA pixel
// gate. Same bug shape as radar-chart.tsx's `polarValueKey` fix (`valueKey`
// wrapping a z-channel group key there instead of a geo feature key here).
function geoValueKey(value: string): string {
  return `string:${value.length}:${value}`;
}

function choroplethSceneKey(feature: ChoroplethFeature): string {
  return `choropleth:${geoValueKey(choroplethFeatureKey(feature))}`;
}

// C1 states+legend: `geoShape`'s `fillOpacity`/`strokeOpacity`/`opacity`
// options are plain per-call numbers (see GeoShapeOptions in
// @tanstack/charts' geo.d.ts), not per-datum channels — only `fill` and
// `stroke` accept a per-row accessor. Hover dim is therefore baked into
// those two channels' alpha via `color-mix`, same technique as
// radar-chart.tsx's `withAlpha`.
function withAlpha(color: string, alphaPercent: number): string {
  const pct = Math.max(0, Math.min(100, alphaPercent));
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

// bklit dim values (internal/choropleth-hover-chrome.ts's retired applyDim):
// nothing hovered → baseOpacity (0.85) for every feature; something hovered
// → the hovered feature at full opacity (1), everything else at dimOpacity
// (default 0.4).
function resolveFeatureAlpha(
  key: string,
  hoveredKey: string | null,
  baseOpacity: number,
  dimOpacity: number,
): number {
  if (hoveredKey === null) return baseOpacity;
  if (hoveredKey === key) return 1;
  return dimOpacity;
}


// C6 — throttle + release-ease for the zoom APPLICATION path (see
// `stepZoomFrame` inside ChoroplethChartBody). 180ms matches the retired
// `transition: transform 0.18s ease-out` (the old `syncZoomTransform`,
// deleted); the easing is now applied to the matrix VALUES each committed
// rAF frame (feeding a projection rebuild) instead of to a CSS `transform`.
const ZOOM_EASE_MS = 180;

// Numeric solve of CSS `ease-out` (`cubic-bezier(0, 0, 0.58, 1)`, the timing
// function the retired transition used) via Newton's method on the bezier's
// x(u), so `cubicBezierEaseOut(t)` for a given elapsed-time fraction `t`
// returns the same eased progress CSS would have painted.
function cubicBezierEaseOut(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const x1 = 0, y1 = 0, x2 = 0.58, y2 = 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const sampleDX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  let u = t;
  for (let i = 0; i < 8; i++) {
    const dx = sampleDX(u);
    if (Math.abs(dx) < 1e-6) break;
    u -= (sampleX(u) - t) / dx;
  }
  return sampleY(u);
}

function lerpMatrix(from: TransformMatrix, to: TransformMatrix, p: number): TransformMatrix {
  return {
    scaleX: from.scaleX + (to.scaleX - from.scaleX) * p,
    scaleY: from.scaleY + (to.scaleY - from.scaleY) * p,
    translateX: from.translateX + (to.translateX - from.translateX) * p,
    translateY: from.translateY + (to.translateY - from.translateY) * p,
    skewX: from.skewX + (to.skewX - from.skewX) * p,
    skewY: from.skewY + (to.skewY - from.skewY) * p,
  };
}

function matricesEqual(a: TransformMatrix, b: TransformMatrix): boolean {
  return (
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY &&
    a.translateX === b.translateX &&
    a.translateY === b.translateY &&
    a.skewX === b.skewX &&
    a.skewY === b.skewY
  );
}

interface ExtractedConfig {
  featureConfig: ChoroplethFeatureProps | null;
  tooltipConfig: ChoroplethTooltipProps | null;
  graticuleConfig: ChoroplethGraticuleProps | null;
  overlayChildren: ReactNode[];
}

function extractChoroplethChildren(children: ReactNode): ExtractedConfig {
  let featureConfig: ChoroplethFeatureProps | null = null;
  let tooltipConfig: ChoroplethTooltipProps | null = null;
  let graticuleConfig: ChoroplethGraticuleProps | null = null;
  const overlayChildren: ReactNode[] = [];

  const visit = (node: ReactNode): void => {
    for (const child of Children.toArray(node)) {
      if (!isValidElement(child)) {
        overlayChildren.push(child);
        continue;
      }
      const role = (child.type as unknown as RoleCarrier)?.[CHART_ROLE];
      if (role === "choroplethFeature") featureConfig = child.props as ChoroplethFeatureProps;
      else if (role === "choroplethTooltip") tooltipConfig = child.props as ChoroplethTooltipProps;
      else if (role === "choroplethGraticule") graticuleConfig = child.props as ChoroplethGraticuleProps;
      else overlayChildren.push(child);
    }
  };
  visit(children);
  return { featureConfig, tooltipConfig, graticuleConfig, overlayChildren };
}

// ===========================================================================
// Inner body — owns projection, definition, hover, tooltip, zoom wiring
// ===========================================================================

function ChoroplethChartBody({
  data,
  margin: marginProp,
  animationDuration = ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature = "",
  aspectRatio = "16 / 9",
  scale: scaleProp,
  center = [0, 20],
  translate: translateProp,
  zoomEnabled = false,
  zoomMin = 0.5,
  zoomMax = 4,
  initialZoom = DEFAULT_INITIAL_ZOOM,
  children,
  width,
  height,
}: ChoroplethChartProps & { width: number; height: number }) {
  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const ratio = useMemo(() => parseAspectRatio(aspectRatio), [aspectRatio]);

  const { featureConfig, tooltipConfig, graticuleConfig, overlayChildren } =
    useMemo(() => extractChoroplethChildren(children), [children]);

  const dimOpacity = featureConfig?.fadedOpacity ?? 0.4;
  const baseOpacity = 0.85;
  // C2: whether a <ChoroplethTooltip> child is present gates both the native
  // `tooltip` extension option below and the hover→focus bridge; needs to be
  // known before `definition`'s useMemo.
  const hasTooltipChild = tooltipConfig !== null;

  // C1 states+legend: replaces the old DOM-reparenting dim-wrapper scheme.
  // `hoveredKey` drives geoShape's per-datum fill/stroke alpha below; the
  // chrome reports hover-key changes via `onHoverChange` (C1 dim) and
  // `onFocusChange` (C2 native tooltip, see internal/choropleth-hover-chrome.ts).
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // C6: read-only ref the <Zoom> render prop (below, unchanged gesture
  // machinery) writes to on every gesture tick. Only used for the
  // `containerRef` binding + `isDragging` cursor state in `handleRender` now
  // — the tooltip no longer forward-applies this (see the native tooltip's
  // `anchor` fn below: points arrive already zoomed, since `projection`
  // itself now carries the zoom).
  const zoomRefForChrome = useRef<ProvidedZoom<SVGSVGElement> | null>(null);

  // C6 — application path. `displayMatrix` is what actually reaches the
  // projection below; it is throttled to at most one commit per animation
  // frame and, when not dragging, eased toward the gesture engine's target
  // matrix over `ZOOM_EASE_MS` — the same 180ms the retired
  // `transition: transform 0.18s ease-out` used, just computed against the
  // matrix VALUES each frame instead of applied as a CSS transition on a
  // `transform` attribute (which doesn't make sense once there's no longer a
  // <g transform> to transition — an SVG `d` attribute doesn't tween).
  // `motion: false` on `geoShape` below (unchanged) keeps dist/motion.js's
  // per-mark animate() from also firing on these redraws (dist/motion.js:612,
  // @tanstack/charts@0.15.0 — animates on every non-resize reconcile).
  const [displayMatrix, setDisplayMatrix] = useState<TransformMatrix>(() => initialZoom);
  const targetMatrixRef = useRef<TransformMatrix>(initialZoom);
  const isDraggingRef = useRef(false);
  const committedMatrixRef = useRef<TransformMatrix>(initialZoom);
  const committedDraggingRef = useRef(false);
  const easeRef = useRef<{ from: TransformMatrix; start: number } | null>(null);
  const zoomRafRef = useRef<number | null>(null);
  // `refreshTooltipAnchor` (declared later, near the hover-chrome wiring —
  // it closes over `renderContextRef`/`hoveredKeyRef`, both declared after
  // this point) is mirrored into a ref so `stepZoomFrame` above it can call
  // the LATEST version without a forward reference in a `useCallback` deps
  // array (which would be a TDZ error — this file's `const`s all share one
  // function-body scope). Assigned unconditionally on every render, right
  // after `refreshTooltipAnchor`'s own declaration, below.
  const refreshTooltipAnchorRef = useRef<() => void>(() => {});

  const stepZoomFrame = useCallback((now: number) => {
    zoomRafRef.current = null;
    const dragging = isDraggingRef.current;
    const target = targetMatrixRef.current;
    let next: TransformMatrix;
    if (dragging) {
      // "except during drag" (retired CSS rule) — instant 1:1 follow.
      next = target;
    } else if (easeRef.current) {
      const { from, start } = easeRef.current;
      const t = Math.min((now - start) / ZOOM_EASE_MS, 1);
      next = t >= 1 ? target : lerpMatrix(from, target, cubicBezierEaseOut(t));
      if (t >= 1) easeRef.current = null;
    } else {
      next = target;
    }
    const matrixChanged = !matricesEqual(next, committedMatrixRef.current);
    const draggingChanged = dragging !== committedDraggingRef.current;
    if (matrixChanged || draggingChanged) {
      committedMatrixRef.current = next;
      committedDraggingRef.current = dragging;
      setDisplayMatrix(next);
      // C2 parity: keep the native tooltip glued to its feature through the
      // gesture (see `refreshTooltipAnchor`'s own doc comment below for why
      // this repeated call is needed — dist/tooltip.js caches the anchor
      // point and does not re-run `anchor` on its own).
      refreshTooltipAnchorRef.current();
    }
    // Keep animating while dragging (target moves every frame) or mid-ease;
    // otherwise stop — no idle per-frame cost once settled.
    if (dragging || easeRef.current) {
      zoomRafRef.current = requestAnimationFrame(stepZoomFrame);
    }
  }, []);

  const scheduleZoomFrame = useCallback(() => {
    if (zoomRafRef.current !== null) return;
    zoomRafRef.current = requestAnimationFrame(stepZoomFrame);
  }, [stepZoomFrame]);

  // Called from the <Zoom> render prop below on every gesture tick (a new
  // `transformMatrix`/`isDragging` from zoom-engine.tsx's unchanged gesture
  // state). This only updates refs + schedules a frame; the actual React
  // state commit (`setDisplayMatrix`) happens inside `stepZoomFrame`, a rAF
  // callback — never synchronously here, since this runs during <Zoom>'s own
  // render pass and calling a state setter owned by THIS component from
  // inside a child's render is exactly what the old code's SSR/first-paint
  // `requestAnimationFrame` guard was already dodging.
  const onZoomTick = useCallback((zoom: ChoroplethZoomInstance<SVGSVGElement>) => {
    targetMatrixRef.current = zoom.transformMatrix;
    isDraggingRef.current = zoom.isDragging;
    if (typeof window === "undefined") return; // SSR: no rAF, nothing to gesture against
    if (zoom.isDragging) {
      easeRef.current = null;
    } else if (!matricesEqual(zoom.transformMatrix, committedMatrixRef.current)) {
      // Drag just ended, or a discrete wheel/pinch step landed a new target
      // while idle: (re)ease from whatever is currently on screen toward it
      // — if an ease was already in flight, this redirects it smoothly
      // rather than restarting from the old start point.
      easeRef.current = { from: committedMatrixRef.current, start: performance.now() };
    }
    scheduleZoomFrame();
  }, [scheduleZoomFrame]);

  const projection = useMemo<GeoProjection | null>(() => {
    if (width <= 0 || height <= 0) return null;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const baseScale = scaleProp ?? (innerW > 0 ? (innerW / 630) * 100 : 100);
    const baseTranslate: [number, number] = translateProp ?? [
      innerW / 2 + margin.left,
      innerH / 2 + margin.top + 50,
    ];
    // C6: zoom/pan used to be a `<g transform={matrix}>` wrapped around the
    // rendered marks (the retired `syncZoomTransform`). `geoShape` has no
    // group node for the app to wrap, so scale/translate become projection
    // PARAMETERS instead — `displayMatrix` is identity when !zoomEnabled (no
    // <Zoom> mounted to ever change it), so this reduces exactly to the
    // pre-C6 formula in that case.
    //
    // Composing is exact because d3's own scale/translate composition is
    // itself affine (`x_screen = k * x_raw + translate[0]`, d3-geo
    // internals) — the same algebraic shape as the retired SVG `matrix()` —
    // AS LONG AS the matrix carries no skew and scaleX === scaleY. That is
    // the only shape internal/zoom-engine.tsx's gesture handlers produce
    // here (`wheelDelta`/`pinchDelta` below are symmetric; nothing calls
    // `zoom.scale({scaleX, scaleY})` asymmetrically), so this is not
    // currently reachable as a fidelity gap, but is a documented
    // approximation: an anisotropic scaleX !== scaleY matrix would need a
    // `GeoStreamWrapper` (d3-geo `geoTransform`) instead of `.scale()` (a
    // `GeoProjection` has one scalar `k`) — not done here because a
    // `GeoStreamWrapper` has no `.invert()`, which `unprojectPoint` above
    // and `pathGenerator`/`projectPoint` below need.
    const m = displayMatrix;
    return geoMercator()
      .center(center)
      .scale(baseScale * m.scaleX)
      .translate([
        m.scaleX * baseTranslate[0] + m.translateX,
        m.scaleY * baseTranslate[1] + m.translateY,
      ]);
  }, [width, height, margin, scaleProp, center, translateProp, displayMatrix]);

  // P5.6 CP9 — legacy's `isLoaded`/`revealEpoch` state machine, verbatim
  // (`repos/bklit-ui/.../choropleth-chart.tsx:371-397`): epoch bumps and
  // `isLoaded` re-arms on `[animationDuration, revealSignature]`. Nothing in
  // migrated reads either (the reveal is imperative WAAPI) — they exist so
  // `useChoropleth()` reports the same lifecycle legacy's consumers gate on.
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
    setIsLoaded(false);
    const timeout = setTimeout(() => setIsLoaded(true), animationDuration);
    return () => clearTimeout(timeout);
  }, [animationDuration, revealSignature]);

  // CP9 — the three geo accessors, all off the projection this component
  // already builds. `geoPath` is d3's own; legacy reaches the same generator
  // through visx's `<Mercator>` render prop.
  const geoPathGenerator = useMemo(
    () => (projection ? geoPath(projection) : null),
    [projection],
  );
  const pathGenerator = useCallback(
    (feature: ChoroplethFeature) => geoPathGenerator?.(feature) ?? undefined,
    [geoPathGenerator],
  );
  const rawPathGenerator = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: GeoJSON types are complex
    (geo: any) => geoPathGenerator?.(geo) ?? null,
    [geoPathGenerator],
  );
  const projectPoint = useCallback(
    (coords: [number, number]): [number, number] | null => {
      const p = projection?.(coords);
      return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [p[0], p[1]] : null;
    },
    [projection],
  );

  // C6: replaces the retired forward-application `applyZoomToPoint`
  // (legacy `applyZoom`/`choropleth-tooltip.tsx`, ported then removed here).
  // That function existed because the tooltip's anchor points used to come
  // from the UNZOOMED projection, needing a forward zoom-matrix apply to
  // land in final screen space. Now `projection` itself already carries the
  // zoom (see above), so `geoShape`'s reported anchor points are already
  // final screen coordinates — the native tooltip's `anchor` fn below no
  // longer needs to transform them at all (double-application otherwise).
  //
  // `unprojectPoint` is the sanctioned replacement for what the brief calls
  // "inverse-matrix hit-testing": the CURRENT (already zoomed) projection's
  // own `.invert()` (a standard d3-geo `GeoProjection` method — see
  // `@types/d3-geo@3.1.1`). A caller with a screen point in plot-local
  // coordinates (e.g. via `host.interaction.clientToScene`, margin-inclusive
  // scene coords — choropleth's `margin: 0` makes those plot-local here)
  // gets back `[lon, lat]`. No current consumer needs this (see final
  // report) — exposed on `useChoropleth()` for symmetry with `projectPoint`.
  const unprojectPoint = useCallback(
    (point: [number, number]): [number, number] | null => {
      const p = projection?.invert?.(point);
      return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [p[0], p[1]] : null;
    },
    [projection],
  );

  const definition = useMemo(() => {
    if (width <= 0 || height <= 0 || !projection)
      return null as unknown as StaticChartDefinition<ChoroplethFeature, ChartValue, ChartValue, "dom">;
    const projForMark = projection;
    const d = defineChart({
      marks: [
        geoShape(data.features, {
          id: "choropleth",
          key: choroplethFeatureKey,
          projection: () => projForMark,
          // Hover dim (base 0.85 / dimmed 0.4 / hovered 1) is baked into the
          // fill color's alpha via `color-mix` — see `resolveFeatureAlpha`/
          // `withAlpha` above. Pattern fills (`url(#id)`) can't be
          // alpha-blended this way, so they're returned as-is (documented
          // fidelity gap: pattern-filled features no longer dim on hover).
          fill: (f: ChoroplethFeature, { index }) => {
            const resolved = resolveFeatureFill(
              f, index,
              featureConfig?.fill,
              featureConfig?.getFeatureColor,
              featureConfig?.getFeaturePattern,
            );
            if (featureConfig?.getFeaturePattern?.(f, index)) return resolved;
            const alpha = resolveFeatureAlpha(choroplethSceneKey(f), hoveredKey, baseOpacity, dimOpacity);
            return withAlpha(resolved, alpha * 100);
          },
          stroke: (f: ChoroplethFeature) => {
            const alpha = resolveFeatureAlpha(choroplethSceneKey(f), hoveredKey, baseOpacity, dimOpacity);
            return withAlpha(featureConfig?.stroke ?? "var(--background)", alpha * 100);
          },
          strokeOpacity: 1,
          strokeWidth: featureConfig?.strokeWidth ?? 0.5,
          // D6: the enter reveal stays the app-owned group-level WAAPI fade
          // below (`.ts-chart__geo`'s single `.animate()` in `handleRender`,
          // unchanged from legacy — no per-feature stagger to reproduce, so
          // no native-motion coordinator correction applies here the way one
          // did for heatmap's per-cell reveal). Native motion is suppressed
          // per-mark so the renderer's own default per-path enter-opacity
          // fade (`motion({initial:"always"})`, internal/motion-renderer.ts)
          // doesn't race/double-apply against that group fade.
          motion: false,
        }),
      ],
      scales: { x: null, y: null },
      guides: false,
      margin: 0,
      // P3.3/T-D2 CSS-suppression-cleanup: choropleth owns its own hover
      // feedback (internal/choropleth-hover-chrome.ts), same as every other
      // custom-mark chart in this migration — suppress TanStack's native
      // focus ring natively instead of relying solely on the
      // `[data-ts-chart-focus] {display:none}` CSS rule.
      focusRing: false,
      // E1: the library's own pointer handler (dist/renderer.js) resolves
      // hover to the nearest geoShape centroid (dist/geo.js), which can
      // disagree with the app-owned hover DETECTION in
      // internal/choropleth-hover-chrome.ts (path `mouseenter`, driving
      // `setControlledFocus` via `onFocusChange` below). Disabling the
      // library's pointer handling here leaves this chart's own controlled
      // focus as the single source of truth for hover, same rationale as
      // `focusRing: false` above.
      pointer: false,
      // C2: native tooltip extension, only when a <ChoroplethTooltip> child
      // is present (mirrors legacy's opt-in — no child, no box). `sticky:
      // false`/`motion: false` match the retired box's INSTANT unmount (CP7:
      // "bklit ChoroplethTooltip returns null the moment tooltipData clears;
      // no exit fade"). C6: `anchor` no longer forward-applies the zoom
      // matrix (retired `applyZoomToPoint`, née the old chrome's `applyZoom`)
      // — reprojecting through `projForMark` (closed over above, already
      // carries the zoom) below lands directly in final zoomed screen space.
      //
      // (coordinator fix, choropleth tooltip-x offset on multi-polygon
      // features) `points[0].{x,y}` — the library's own per-feature anchor —
      // is `path.centroid(datum)` (dist/geo.js render(): centroid of the
      // PROJECTED SVG path, area-weighted in projected/screen space). Legacy
      // (`choropleth-feature.tsx:236-242`) instead anchors at
      // `projectPoint(geoCentroid(feature))` — d3-geo's SPHERICAL centroid
      // (true-surface-area-weighted, computed BEFORE projection) then
      // projected. For a single-polygon feature the two agree closely enough
      // to stay under the QA gate. For a MultiPolygon whose parts have
      // wildly different Mercator-projected areas — the USA, where Alaska's
      // high-latitude parts balloon far beyond their true geographic size
      // under Mercator — `path.centroid` skews hard toward the inflated part
      // (Alaska) while `geoCentroid` stays anchored near the true
      // (mainland-dominated) centroid, producing a visible x divergence
      // between the two tooltips. Reproducing legacy's rule here (not
      // patchable in dist/geo.js, which is read-only) fixes it: fall back to
      // the library's own point only if `geoCentroid` is
      // unavailable/non-finite for the feature (e.g. degenerate geometry).
      tooltip: hasTooltipChild
        ? {
            use: tooltip,
            className: "bkm-native-tooltip",
            sticky: false,
            motion: false,
            placement: ["right", "left"],
            offset: CHOROPLETH_TOOLTIP_OFFSET,
            anchor: (points: readonly ChartPoint<ChoroplethFeature, ChartValue, ChartValue>[]) => {
              const p = points[0];
              if (!p) return null;
              const centroid = geoCentroid(p.datum);
              const projected =
                centroid && Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])
                  ? projForMark(centroid)
                  : null;
              return projected && Number.isFinite(projected[0]) && Number.isFinite(projected[1])
                ? { x: projected[0], y: projected[1] }
                : { x: p.x, y: p.y };
            },
          }
        : false,
    });
    return d as StaticChartDefinition<ChoroplethFeature, ChartValue, ChartValue, "dom">;
  }, [
    width, height, projection, data.features,
    featureConfig?.getFeatureColor, featureConfig?.getFeaturePattern,
    featureConfig?.fill, featureConfig?.stroke, featureConfig?.strokeWidth,
    hoveredKey, baseOpacity, dimOpacity, hasTooltipChild,
  ]);

  // --- Hover chrome (owns hover DETECTION only; C2 moved tooltip building +
  //     positioning to the native `tooltip` extension above) ---
  const hoverChromeRef = useRef<ChoroplethHoverChrome | null>(null);
  // C2: render-context bridge (mirrors internal/focus-injection.ts's capture
  // pattern, source 'pointer' instead of 'programmatic' so C1's legend-dim
  // mark states never fire from map hover). `hoveredKeyRef` mirrors
  // `hoveredKey` React state imperatively so `refreshTooltipAnchor` (used by
  // C6's zoom code below) can read the current focus target without a stale
  // closure over `[]`-deps callbacks.
  const renderContextRef = useRef<Pick<
    ChartRendererRenderContext<ChoroplethFeature, ChartValue, ChartValue>,
    "scene" | "interaction"
  > | null>(null);
  const hoveredKeyRef = useRef<string | null>(null);

  // Tooltip config resolution — bklit defaults (OQ parity 8): formatValue =
  // intFmt (CP4), name fallback `Feature ${index}` + real index arg (CP5/CP6)
  // — applied inside `renderTooltipBody` (JSX below) against this config.
  const formatValue = tooltipConfig?.formatValue ?? intFmt;
  const tooltipContent = tooltipConfig?.content;
  const getFeatureName = tooltipConfig?.getFeatureName;
  const getFeatureValue = tooltipConfig?.getFeatureValue;
  const valueLabel = tooltipConfig?.valueLabel ?? "Value";
  const getTooltipConfig = useCallback(() => {
    if (!hasTooltipChild) return null;
    return {
      content: tooltipContent,
      formatValue,
      getFeatureName,
      getFeatureValue,
      valueLabel,
      className: tooltipConfig?.className,
      panelStyle: tooltipConfig?.panelStyle,
      backgroundColor: tooltipConfig?.backgroundColor,
    };
  }, [hasTooltipChild, tooltipContent, formatValue, getFeatureName, getFeatureValue, valueLabel, tooltipConfig]);

  // C2: pointer-source focus bridge — looks up the scene ChartPoint whose
  // `key` matches the hover-chrome's `data-ts-key` (same key `geoShape`
  // stamped the path with, see `choroplethFeatureKey`) and drives the native
  // tooltip via `setControlledFocus`. CRITICAL: source 'pointer', never
  // 'programmatic' (that triggers C1's legend-dim mark states).
  const onFocusChange = useCallback((key: string | null) => {
    hoveredKeyRef.current = key;
    const ctx = renderContextRef.current;
    if (!ctx) return;
    const point = key === null ? null : (ctx.scene.points.find((p) => p.key === key) ?? null);
    ctx.interaction.setControlledFocus(point, { source: "pointer" });
  }, []);

  const revealAnimsRef = useRef<Animation[]>([]);
  const revealDeadlineTimerRef = useRef<number | null>(null);
  const revealPostPaintCancelRef = useRef<(() => void) | null>(null);
  // CP1/CP2 — reveal timing + replay key. `seenRevealedRef` was a BOOLEAN, so
  // once set it snapped forever and a caller bumping `revealSignature` would
  // get nothing (D311). It now carries sankey's key shape; `null` = never
  // revealed.
  const enterType = enterTransition?.type;
  const enterDurationSec = enterTransition?.duration;
  const enterEaseKey = enterTransition?.ease?.join(",");
  const { durationMs: revealDurationMs, easingCss: revealEasingCss } = useMemo(
    () => clipRevealTiming(enterTransition, FEATURE_ENTER_MS, REVEAL_EASING),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterType, enterDurationSec, enterEaseKey],
  );
  const revealKeyRef = useRef({ signature: revealSignature, duration: animationDuration });
  revealKeyRef.current = { signature: revealSignature, duration: animationDuration };
  const seenRevealedRef = useRef<{ signature: string; duration: number } | null>(null);

  const ensureHoverChrome = useCallback(() => {
    if (hoverChromeRef.current) return hoverChromeRef.current;
    hoverChromeRef.current = createChoroplethHoverChrome({
      onHoverChange: setHoveredKey,
      onFocusChange,
    });
    return hoverChromeRef.current;
  }, [onFocusChange]);

  // C2: re-invokes `setControlledFocus` with the SAME already-focused point
  // to force the native tooltip to repaint (renderer.js's `setControlledFocus`
  // takes the `sameChartPointIdentity` fast path straight to `paintFocus` →
  // `paintTooltip`, which recomputes the `anchor` fn above against the
  // point's LATEST scene position). Native tooltip position is frozen to
  // whatever `anchor` returned at the last paint (dist/tooltip.js
  // `position()` reuses the cached `anchor` object — it does not re-run the
  // `anchor` fn on its own), so without this call the tooltip would
  // visually detach from the feature mid-gesture. Replaces the retired
  // box's `refreshTooltipPosition`; C6 moved its call site from the old
  // `syncZoomTransform` (deleted) to `stepZoomFrame`'s commit branch, above
  // (via `refreshTooltipAnchorRef`, mirrored right below).
  const refreshTooltipAnchor = useCallback(() => {
    const ctx = renderContextRef.current;
    const key = hoveredKeyRef.current;
    if (!ctx || key === null) return;
    const point = ctx.scene.points.find((p) => p.key === key) ?? null;
    if (!point) return;
    ctx.interaction.setControlledFocus(point, { source: "pointer" });
  }, []);
  refreshTooltipAnchorRef.current = refreshTooltipAnchor;

  // C6: widened to accept `surface` — `context.surface.element` (below) is
  // the sanctioned equivalent of the manual `container.querySelector("svg.ts
  // -chart")` reach-in this callback used to do for EVERY purpose (zoom
  // binding, hover-chrome path lookup, reveal animation). `dist/svg-
  // surface.js`'s `ChartSurface.element` getter (@tanstack/charts@0.15.0)
  // is internally `container.querySelector("svg.ts-chart")` verbatim, so
  // using it here is not a behavior change — it just goes through the
  // library's own handle instead of re-deriving it. The raw querySelector
  // fallback survives ONLY for the synthetic call below (the reveal-recovery
  // `useLayoutEffect`, which calls `handleRender({container: c})` with no
  // `surface` — there is no real render pass to hand one).
  const handleRender = useCallback((
    context: { container: HTMLElement } & Partial<
      Pick<ChartRendererRenderContext<ChoroplethFeature, ChartValue, ChartValue>, "scene" | "interaction" | "surface">
    >,
  ) => {
    const { container, scene, interaction, surface } = context;
    if (scene && interaction) renderContextRef.current = { scene, interaction };
    const c = container as HTMLElement;
    const svg = (surface?.element as SVGSVGElement | undefined) ??
      (c.querySelector("svg.ts-chart") as unknown as SVGSVGElement | null);

    // C6: gesture binding + cursor/touch-action chrome. No more `<g
    // transform>` writes (`syncZoomTransform`, retired) — zoom now reaches
    // the screen via `projection` (a real React value, see above), which
    // repaints through the ordinary render path. `containerRef` binds to
    // `c` (the outer container `@use-gesture` listens on), not the `<svg>`
    // specifically: zoom-engine.tsx's `localPoint` resolves coordinates
    // from `event.target`, not the listener-bound element, so any ancestor
    // works and this needs no svg lookup at all.
    const zoom = zoomRefForChrome.current;
    if (zoom) {
      (zoom.containerRef as { current: SVGSVGElement | null }).current = c as unknown as SVGSVGElement;
      c.style.touchAction = "none";
      c.style.cursor = isDraggingRef.current ? "grabbing" : "grab";
      (c.style as unknown as { contain: string }).contain = "layout style paint";
    }

    const elements = new Map<string, SVGPathElement>();
    const paths = svg?.querySelectorAll<SVGPathElement>(".ts-chart__geo path[data-ts-key]");
    if (paths) {
      for (const path of paths) {
        const key = path.getAttribute("data-ts-key") ?? "";
        elements.set(key, path);
      }
    }
    ensureHoverChrome().reconnect(c, elements);

    if (animationDuration <= 0) return;
    // CP2: the replay KEY is tested before both the ref and the DOM stamp.
    const seenKey = seenRevealedRef.current;
    const revealKey = revealKeyRef.current;
    const revealKeyChanged =
      seenKey === null ||
      seenKey.signature !== revealKey.signature ||
      seenKey.duration !== revealKey.duration;
    if (!revealKeyChanged) return;
    const svgForBkm = svg as SVGElement | null;
    if (!svgForBkm) return;
    if (isRevealed(svgForBkm) && !revealKeyChanged) return;
    seenRevealedRef.current = { ...revealKey };
    markRevealed(svgForBkm);

    const geoGroup = c.querySelector<SVGGElement>(".ts-chart__geo");
    if (!geoGroup) return;
    geoGroup.classList.add("ts-chart__marks--revealing");

    revealDeadlineTimerRef.current = setRevealDeadline(revealDurationMs, {
      animationsRef: revealAnimsRef,
      onDeadline: () => {},
    });

    revealPostPaintCancelRef.current = onPostPaint(() => {
      const liveSvg = c.querySelector<SVGElement>("svg.ts-chart") as SVGElement | null;
      const liveGeo = c.querySelector<SVGGElement>(".ts-chart__geo");
      if (!liveSvg || !liveGeo) return;
      liveGeo.classList.remove("ts-chart__marks--revealing");
      if ((liveGeo as unknown as HTMLElement).style) (liveGeo as unknown as HTMLElement).style.opacity = "";
      const anim = liveGeo.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: revealDurationMs, easing: revealEasingCss, fill: "backwards" },
      );
      revealAnimsRef.current.push(anim);
      anim.onfinish = () => { try { anim.cancel(); } catch { /* teardown race — already cancelled */ } };
      anim.oncancel = () => { try { anim.cancel(); } catch { /* teardown race — already cancelled */ } };
    });
  }, [animationDuration, revealDurationMs, revealEasingCss, ensureHoverChrome]);

  useEffect(() => {
    return () => {
      if (revealDeadlineTimerRef.current !== null) {
        window.clearTimeout(revealDeadlineTimerRef.current);
        revealDeadlineTimerRef.current = null;
      }
      revealPostPaintCancelRef.current?.();
      revealPostPaintCancelRef.current = null;
      for (const a of revealAnimsRef.current) try { a.cancel(); } catch { /* teardown race — already cancelled */ }
      revealAnimsRef.current = [];
      hoverChromeRef.current?.detach();
      hoverChromeRef.current = null;
    };
  }, []);

  const containerRefForFallback = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (seenRevealedRef.current !== null) return;
    if (animationDuration <= 0) return;
    const c = containerRefForFallback.current;
    if (!c) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (seenRevealedRef.current !== null) return;
        if (!c.querySelector(".ts-chart__marks")) return;
        if (isRevealed(findRevealRoot(c, "svg.ts-chart"))) return;
        if (c.getAnimations().length > 0) return;
        handleRender({ container: c });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [animationDuration, handleRender]);

  const chartNode = (
    <>
      {/* P5.5 CP3 — bklit choropleth-feature.tsx:327 renders
          `{patterns ? <defs>{patterns}</defs> : null}` inside its feature
          group. Migrated's marks <svg> is owned by TanStack's renderer, so
          there is no in-tree injection point; the defs go in a zero-size
          sibling <svg> instead. That is equivalent, not a workaround: SVG
          paint servers resolve `url(#id)` by DOCUMENT id, so the fills
          `resolveFeatureFill` emits from `getFeaturePattern` still bind.
          RENDERING rather than stripping is the choice the charter left open —
          `patterns` is public bklit API, and `getFeaturePattern` (already
          wired) is useless without it, so stripping would retire a live prop
          pair rather than a dangling one. */}
      {featureConfig?.patterns ? (
        <svg
          aria-hidden="true"
          focusable="false"
          width={0}
          height={0}
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <defs>{featureConfig.patterns}</defs>
        </svg>
      ) : null}
      <RendererChart
        renderer={chartMotionRenderer<ChoroplethFeature, ChartValue, ChartValue>()}
        ariaLabel="Choropleth chart"
        aspectRatio={ratio}
        definition={definition}
        onRender={handleRender}
        renderTooltipBody={(ctx) => {
          const cfg = getTooltipConfig();
          if (!cfg) return ctx.defaultBody;
          const p = ctx.points[0];
          if (!p) return null;
          const feature = p.datum as ChoroplethFeature;
          const index = p.datumIndex;
          // bklit choropleth-tooltip.tsx defaults (OQ parity 8): formatValue =
          // intFmt, valueLabel = "Value", name fallback `Feature ${index}`.
          // `.bkm-tooltip-panel`/`.bkm-tooltip-content`/`.bkm-tooltip-row*`
          // reproduce the retired imperative box's exact markup
          // (internal/tooltip-chrome.ts's `buildBox`/`applyBoxContent`) so
          // existing panel CSS keeps applying unchanged; the native
          // tooltip's own element (className "bkm-native-tooltip") now owns
          // positioning/layering instead of `.bkm-tooltip-layer`.
          if (cfg.content) {
            return (
              <div
                className="bkm-tooltip-panel"
                style={{
                  ...(cfg.backgroundColor ? { backgroundColor: cfg.backgroundColor } : null),
                  ...cfg.panelStyle,
                }}
              >
                {cfg.content({ feature, index })}
              </div>
            );
          }
          const name = cfg.getFeatureName
            ? cfg.getFeatureName(feature, index)
            : (feature.properties?.name ?? `Feature ${index}`);
          const value = cfg.getFeatureValue?.(feature, index);
          return (
            <div
              className={cfg.className ? `bkm-tooltip-panel ${cfg.className}` : "bkm-tooltip-panel"}
              style={{
                ...(cfg.backgroundColor ? { backgroundColor: cfg.backgroundColor } : null),
                ...cfg.panelStyle,
              }}
            >
              <div className="bkm-tooltip-content">
                <div className="bkm-tooltip-title">{name}</div>
                {value !== undefined ? (
                  <div className="bkm-tooltip-rows">
                    <div className="bkm-tooltip-row">
                      <div className="bkm-tooltip-row-label">
                        <span className="bkm-tooltip-swatch" style={{ backgroundColor: "var(--chart-1)" }} />
                        <span className="bkm-tooltip-series">{cfg.valueLabel}</span>
                      </div>
                      <span className="bkm-tooltip-value">{cfg.formatValue(value)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        }}
      />
      {graticuleConfig && projection ? (
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          {/* C6: no more ref/group transform write here (retired
              `graticuleGRef`/`syncZoomTransform`) — `projection` is already
              zoomed (see the `projection` useMemo above), so this overlay's
              own internal `useMemo([projection, step])` naturally redraws
              already-zoomed graticule lines with zero changes to that
              component. */}
          <g>
            <ChoroplethGraticuleOverlay
              projection={projection}
              stroke={graticuleConfig.stroke}
              strokeWidth={graticuleConfig.strokeWidth}
              step={graticuleConfig.step}
            />
          </g>
        </svg>
      ) : null}
    </>
  );

  // CP9 — one memoised value for both provider sites below (the zoom-enabled
  // and zoom-disabled branches), so consumers don't see a new object identity
  // on every render of this body.
  const choroplethContextValue = useMemo<ChoroplethContextValue>(
    () => ({
      features: data.features,
      featureCollection: data,
      pathGenerator,
      rawPathGenerator,
      projectPoint,
      unprojectPoint,
      width,
      height,
      innerWidth: Math.max(0, width - margin.left - margin.right),
      innerHeight: Math.max(0, height - margin.top - margin.bottom),
      margin,
      containerRef: containerRefForFallback,
      isLoaded,
      animationDuration,
      enterTransition,
      revealEpoch,
    }),
    [
      data, pathGenerator, rawPathGenerator, projectPoint, unprojectPoint,
      width, height, margin, isLoaded, animationDuration,
      enterTransition, revealEpoch,
    ],
  );

  const inner = (
    <div
      ref={(el) => { (containerRefForFallback as unknown as { current: HTMLDivElement | null }).current = el; }}
      style={{ position: "absolute", inset: 0 }}
    >
      {chartNode}
      {overlayChildren}
    </div>
  );

  if (!zoomEnabled) {
    return (
      <ChoroplethContext.Provider value={choroplethContextValue}>
        {inner}
      </ChoroplethContext.Provider>
    );
  }

  return (
    <Zoom<SVGSVGElement>
      height={height}
      width={width}
      initialTransformMatrix={initialZoom}
      scaleXMin={zoomMin}
      scaleXMax={zoomMax}
      scaleYMin={zoomMin}
      scaleYMax={zoomMax}
      wheelDelta={(event) => {
        const s = event.deltaY > 0 ? 0.95 : 1.05;
        return { scaleX: s, scaleY: s };
      }}
    >
      {(zoom) => {
        zoomRefForChrome.current = zoom as unknown as ProvidedZoom<SVGSVGElement>;
        // C6: was `requestAnimationFrame(() => syncZoomTransform(...))` (a
        // raw DOM `<g transform>` write, deferred one frame purely to dodge
        // the SSR/first-paint edge — see the old comment this replaced).
        // `onZoomTick` replaces BOTH the defer trick and the DOM write: it
        // updates refs synchronously (safe — refs, not state) and schedules
        // `stepZoomFrame` (rAF-throttled), which is the ONLY place that
        // calls `setDisplayMatrix`, and always outside this render.
        // CP10: keep the state fields visx already put on this object.
        const z = zoom as unknown as ChoroplethZoomInstance<SVGSVGElement>;
        onZoomTick(z);
        return (
          <ChoroplethZoomContext.Provider value={{ zoom: z }}>
            <ChoroplethContext.Provider value={choroplethContextValue}>
              {inner}
            </ChoroplethContext.Provider>
          </ChoroplethZoomContext.Provider>
        );
      }}
    </Zoom>
  );
}

// ===========================================================================
// Public wrapper — sizing (mirrors bklit ParentSize) + body
// ===========================================================================

export function ChoroplethChart({
  data,
  margin: marginProp,
  animationDuration = ANIMATION_DURATION_MS,
  enterTransition,
  revealSignature = "",
  aspectRatio = "16 / 9",
  scale: scaleProp,
  center = [0, 20],
  translate: translateProp,
  zoomEnabled = false,
  zoomMin = 0.5,
  zoomMax = 4,
  initialZoom = DEFAULT_INITIAL_ZOOM,
  className = "",
  children,
}: ChoroplethChartProps) {
  const margin = useMemo(() => ({ ...DEFAULT_MARGIN, ...marginProp }), [marginProp]);
  const ratio = useMemo(() => parseAspectRatio(aspectRatio), [aspectRatio]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(containerRef);

  const height = Math.max(0, width / ratio);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: String(ratio), overflow: "hidden" }}
      data-bkm-chart="choropleth"
    >
      {width > 0 && height > 0 ? (
        <ChoroplethChartBody
          data={data}
          margin={margin}
          animationDuration={animationDuration}
          enterTransition={enterTransition}
          revealSignature={revealSignature}
          aspectRatio={aspectRatio}
          scale={scaleProp}
          center={center}
          translate={translateProp}
          zoomEnabled={zoomEnabled}
          zoomMin={zoomMin}
          zoomMax={zoomMax}
          initialZoom={initialZoom}
          className={className}
          width={width}
          height={height}
        >
          {children}
        </ChoroplethChartBody>
      ) : null}
    </div>
  );
}

ChoroplethChart.displayName = "ChoroplethChart";

export const ChoroplethFeatureComponent = _ChoroplethFeatureComponent;
export const ChoroplethTooltip = _ChoroplethTooltip;
export const ChoroplethGraticule = _ChoroplethGraticule;

export default ChoroplethChart;
