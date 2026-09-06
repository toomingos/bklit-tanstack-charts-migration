"use client";

import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { BACKGROUND_ENTER_FADE_MS } from "./design-tokens";
import { edgeFadeMaskStops } from "./fade-mask";
import { useSanitizedId } from "./use-sanitized-id";
import { useChartStable } from "./chart-context";
import { renderPatternPreset } from './pattern-preset-render';
import type { PatternPresetId, PatternPresetOptions } from './pattern-preset';

type BackgroundPatternPreset = PatternPresetId;

interface BackgroundProps extends PatternPresetOptions {
  /** Pattern preset. `"none"` renders nothing. */
  readonly pattern?: BackgroundPatternPreset;
  /** Pattern stroke color. Default: `var(--chart-grid)` */
  readonly color?: string;
  /** Apply the pattern texture to the plot area. Default: true */
  readonly showFill?: boolean;
  /** Pattern fill opacity. Default: 1 */
  readonly opacity?: number;
  /** Fade pattern at the left and right chart edges. Default: true */
  readonly fadeHorizontal?: boolean;
  /** Fade pattern at the top and bottom chart edges. Default: true */
  readonly fadeVertical?: boolean;
  /** Horizontal fade zone as % of plot width per edge. Default: 10 */
  readonly fadeHorizontalLength?: number;
  /** Vertical fade zone as % of plot height per edge. Default: 10 */
  readonly fadeVerticalLength?: number;
  /** Forced loaded flag; defaults to the chart context `isLoaded`. */
  readonly isLoaded?: boolean;
  /** Mount prefix scoping mask and pattern ids; defaults to a per-mount id. */
  readonly idPrefix?: string;
}


interface BackgroundMaskIds {
  readonly hMaskId: string;
  readonly hGradientId: string;
  readonly vMaskId: string;
  readonly vGradientId: string;
  readonly combinedMaskId: string;
}

interface BackgroundMask extends BackgroundMaskIds {
  readonly fadeMask: boolean;
  readonly maskRef: string | undefined;
}

const buildBackgroundMaskIds = (uniqueId: string): BackgroundMaskIds => {
  const hMaskId = `chart-background-fade-h-${uniqueId}`;
  const hGradientId = `${hMaskId}-gradient`;
  const vMaskId = `chart-background-fade-v-${uniqueId}`;
  const vGradientId = `${vMaskId}-gradient`;
  const combinedMaskId = `chart-background-fade-${uniqueId}`;
  return { combinedMaskId, hGradientId, hMaskId, vGradientId, vMaskId };
}

const resolveBackgroundMaskRef = (options: Readonly<{ fadeHorizontal: boolean; fadeVertical: boolean; ids: Readonly<BackgroundMaskIds> }>): string | undefined => {
  const { fadeHorizontal, fadeVertical, ids } = options;
  if (fadeHorizontal && fadeVertical) {return `url(#${ids.combinedMaskId})`;}
  if (fadeHorizontal) {return `url(#${ids.hMaskId})`;}
  if (fadeVertical) {return `url(#${ids.vMaskId})`;}
  return undefined;
}

const resolveBackgroundMask = (options: Readonly<{ fadeHorizontal: boolean; fadeVertical: boolean; uniqueId: string }>): BackgroundMask => {
  const { fadeHorizontal, fadeVertical, uniqueId } = options;
  const ids = buildBackgroundMaskIds(uniqueId);
  const maskRef = resolveBackgroundMaskRef({ fadeHorizontal, fadeVertical, ids });
  return { ...ids, fadeMask: fadeHorizontal || fadeVertical, maskRef };
}

const useFadeMaskStops = (fadeHorizontalLength: number, fadeVerticalLength: number): readonly [readonly FadeStop[], readonly FadeStop[]] => {
  const hStops = useMemo(() => edgeFadeMaskStops(fadeHorizontalLength), [fadeHorizontalLength]);
  const vStops = useMemo(() => edgeFadeMaskStops(fadeVerticalLength), [fadeVerticalLength]);
  return [hStops, vStops];
}

const resolveBackgroundPattern = (options: Readonly<{ preset: BackgroundPatternPreset; patternId: string; presetOptions: Readonly<PatternPresetOptions>; showFill: boolean; width: number; height: number }>): ReactNode => {
  const { preset, patternId, presetOptions, showFill, width, height } = options;
  if (preset === "none" || !showFill || width <= 0 || height <= 0) {return null;}
  return renderPatternPreset(preset, patternId, presetOptions);
}

interface FadeStop {
  readonly offset: string;
  readonly opacity: number;
}

const renderFadeStops = (stops: readonly FadeStop[]): ReactNode =>
  stops.map((stop) => (
    <stop key={stop.offset} offset={stop.offset} stopColor="white" stopOpacity={stop.opacity} />
  ));

const renderHorizontalFade = (options: Readonly<{ hGradientId: string; hMaskId: string; hStops: readonly FadeStop[]; width: number; height: number }>): ReactNode => {
  const { hGradientId, hMaskId, hStops, width, height } = options;
  return (
    <>
      <linearGradient id={hGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
        {renderFadeStops(hStops)}
      </linearGradient>
      <mask id={hMaskId}>
        <rect fill={`url(#${hGradientId})`} height={height} width={width} x={0} y={0} />
      </mask>
    </>
  );
}

const renderVerticalFade = (options: Readonly<{ vGradientId: string; vMaskId: string; vStops: readonly FadeStop[]; width: number; height: number }>): ReactNode => {
  const { vGradientId, vMaskId, vStops, width, height } = options;
  return (
    <>
      <linearGradient id={vGradientId} x1="0%" x2="0%" y1="0%" y2="100%">
        {renderFadeStops(vStops)}
      </linearGradient>
      <mask id={vMaskId}>
        <rect fill={`url(#${vGradientId})`} height={height} width={width} x={0} y={0} />
      </mask>
    </>
  );
}

const renderCombinedFadeInner = (options: Readonly<{ hMaskId: string; vGradientId: string; width: number; height: number }>): ReactNode => {
  const { hMaskId, vGradientId, width, height } = options;
  return (
    <g mask={`url(#${hMaskId})`}>
      <rect fill={`url(#${vGradientId})`} height={height} width={width} x={0} y={0} />
    </g>
  );
}

const renderCombinedFadeMask = (options: Readonly<{ combinedMaskId: string; hMaskId: string; vGradientId: string; width: number; height: number }>): ReactNode => {
  const { combinedMaskId, hMaskId, vGradientId, width, height } = options;
  return (
    <mask id={combinedMaskId}>
      {renderCombinedFadeInner({ hMaskId, height, vGradientId, width })}
    </mask>
  );
}

const renderFadeDefs = (options: Readonly<{ fadeHorizontal: boolean; fadeVertical: boolean; mask: Readonly<BackgroundMask>; hStops: readonly FadeStop[]; vStops: readonly FadeStop[]; width: number; height: number }>): ReactNode => {
  const { fadeHorizontal, fadeVertical, mask, hStops, vStops, width, height } = options;
  if (!mask.fadeMask) {return null;}
  return (
    <defs>
      {fadeHorizontal ? renderHorizontalFade({ hGradientId: mask.hGradientId, hMaskId: mask.hMaskId, hStops, height, width }) : undefined}
      {fadeVertical ? renderVerticalFade({ height, vGradientId: mask.vGradientId, vMaskId: mask.vMaskId, vStops, width }) : undefined}
      {fadeHorizontal && fadeVertical ? renderCombinedFadeMask({ combinedMaskId: mask.combinedMaskId, hMaskId: mask.hMaskId, height, vGradientId: mask.vGradientId, width }) : undefined}
    </defs>
  );
}

const BACKGROUND_LOADED_STYLE: Readonly<CSSProperties> = {
  transition: `opacity ${BACKGROUND_ENTER_FADE_MS}ms ease-out`,
};

const renderBackgroundRect = (options: Readonly<{ patternId: string; width: number; height: number; maskRef: string | undefined; opacity: number; isLoaded: boolean }>): ReactNode => {
  const { patternId, width, height, maskRef, opacity, isLoaded } = options;
  return (
    <rect
      fill={`url(#${patternId})`}
      height={height}
      width={width}
      x={0}
      y={0}
      mask={maskRef}
      opacity={isLoaded ? opacity : 0}
      style={isLoaded ? BACKGROUND_LOADED_STYLE : undefined}
    />
  );
}


/**
 * Plot-area pattern fill for charts without a grid. Renders behind series layers.
 * @param {BackgroundProps} props - Pattern, fade and opacity options.
 * @returns {ReactElement | null} The pattern layer, or null when there is nothing to paint.
 */
const Background: ((props: BackgroundProps) => ReactElement | null) & {
  displayName: string;
} = Object.assign(
  ({
    pattern = "diagonal",
    color = "var(--chart-grid)",
    scale = 1,
    strokeWidth,
    radius,
    complement,
    fill,
    dotFill,
    tileBackground,
    showFill = true,
    opacity = 1,
    fadeHorizontal = true,
    fadeVertical = true,
    fadeHorizontalLength = 10,
    fadeVerticalLength = 10,
    isLoaded: isLoadedProp,
    idPrefix,
  }: BackgroundProps): ReactElement | null => {
    const { innerWidth, innerHeight, isLoaded: isLoadedContext } = useChartStable();
    const isLoaded = isLoadedProp ?? isLoadedContext;
    // Mount-scoped ids keep two charts from sharing one mask or pattern.
    const fallbackId = useSanitizedId();
    const uniqueId = idPrefix ?? fallbackId;
    const patternId = `chart-background-${uniqueId}`;
    const [hStops, vStops] = useFadeMaskStops(fadeHorizontalLength, fadeVerticalLength);

    const patternNode = resolveBackgroundPattern({
      height: innerHeight, patternId, preset: pattern,
      presetOptions: { color, complement, dotFill, fill, radius, scale, strokeWidth, tileBackground },
      showFill, width: innerWidth,
    });
    if (patternNode === null || patternNode === undefined) {return null;}

    const mask = resolveBackgroundMask({ fadeHorizontal, fadeVertical, uniqueId });

    return (
      <g aria-hidden="true" className="chart-background">
        {renderFadeDefs({ fadeHorizontal, fadeVertical, hStops, height: innerHeight, mask, vStops, width: innerWidth })}
        <defs>{patternNode}</defs>
        {renderBackgroundRect({ height: innerHeight, isLoaded, maskRef: mask.maskRef, opacity, patternId, width: innerWidth })}
      </g>
    );
  },
  { displayName: "Background" },
);

export { Background };
export type { BackgroundPatternPreset, BackgroundProps };
