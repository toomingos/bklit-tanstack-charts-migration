import * as React from "react";
import { BACKGROUND_ENTER_FADE_MS } from "./design-tokens";
import { edgeFadeMaskStops } from "./fade-mask";
import { useSanitizedId } from "./use-sanitized-id";
import { renderPatternPreset } from './pattern-preset-render';
import type { PatternPresetId, PatternPresetOptions } from './pattern-preset';

type BackgroundPatternPreset = PatternPresetId;

interface BackgroundProps extends PatternPresetOptions {
  pattern?: BackgroundPatternPreset;
  color?: string;
  showFill?: boolean;
  opacity?: number;
  fadeHorizontal?: boolean;
  fadeVertical?: boolean;
  fadeHorizontalLength?: number;
  fadeVerticalLength?: number;
  width: number;
  height: number;
  isLoaded?: boolean;
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
  const hStops = React.useMemo(() => edgeFadeMaskStops(fadeHorizontalLength), [fadeHorizontalLength]);
  const vStops = React.useMemo(() => edgeFadeMaskStops(fadeVerticalLength), [fadeVerticalLength]);
  return [hStops, vStops];
}

const resolveBackgroundPattern = (options: Readonly<{ preset: BackgroundPatternPreset; patternId: string; presetOptions: Readonly<PatternPresetOptions>; showFill: boolean; width: number; height: number }>): React.ReactNode => {
  const { preset, patternId, presetOptions, showFill, width, height } = options;
  if (preset === "none" || !showFill || width <= 0 || height <= 0) {return undefined;}
  return renderPatternPreset(preset, patternId, presetOptions);
}

interface FadeStop {
  readonly offset: string;
  readonly opacity: number;
}

const renderFadeStops = (stops: readonly FadeStop[]): React.ReactNode =>
  stops.map((stop) => (
    <stop key={stop.offset} offset={stop.offset} style={{ stopColor: "white", stopOpacity: stop.opacity }} />
  ));

const renderHorizontalFade = (options: Readonly<{ hGradientId: string; hMaskId: string; hStops: readonly FadeStop[]; width: number; height: number }>): React.ReactNode => {
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

const renderVerticalFade = (options: Readonly<{ vGradientId: string; vMaskId: string; vStops: readonly FadeStop[]; width: number; height: number }>): React.ReactNode => {
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

const renderCombinedFadeInner = (options: Readonly<{ hMaskId: string; vGradientId: string; width: number; height: number }>): React.ReactNode => {
  const { hMaskId, vGradientId, width, height } = options;
  return (
    <g mask={`url(#${hMaskId})`}>
      <rect fill={`url(#${vGradientId})`} height={height} width={width} x={0} y={0} />
    </g>
  );
}

const renderCombinedFadeMask = (options: Readonly<{ combinedMaskId: string; hMaskId: string; vGradientId: string; width: number; height: number }>): React.ReactNode => {
  const { combinedMaskId, hMaskId, vGradientId, width, height } = options;
  return (
    <mask id={combinedMaskId}>
      {renderCombinedFadeInner({ hMaskId, height, vGradientId, width })}
    </mask>
  );
}

const renderFadeDefs = (options: Readonly<{ fadeHorizontal: boolean; fadeVertical: boolean; mask: Readonly<BackgroundMask>; hStops: readonly FadeStop[]; vStops: readonly FadeStop[]; width: number; height: number }>): React.ReactNode => {
  const { fadeHorizontal, fadeVertical, mask, hStops, vStops, width, height } = options;
  if (!mask.fadeMask) {return undefined;}
  return (
    <defs>
      {fadeHorizontal ? renderHorizontalFade({ hGradientId: mask.hGradientId, hMaskId: mask.hMaskId, hStops, height, width }) : undefined}
      {fadeVertical ? renderVerticalFade({ height, vGradientId: mask.vGradientId, vMaskId: mask.vMaskId, vStops, width }) : undefined}
      {fadeHorizontal && fadeVertical ? renderCombinedFadeMask({ combinedMaskId: mask.combinedMaskId, hMaskId: mask.hMaskId, height, vGradientId: mask.vGradientId, width }) : undefined}
    </defs>
  );
}

const renderBackgroundRect = (options: Readonly<{ patternId: string; width: number; height: number; maskRef: string | undefined; opacity: number; isLoaded: boolean }>): React.ReactNode => {
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
      style={
        isLoaded
          ? { transition: `opacity ${BACKGROUND_ENTER_FADE_MS}ms ease-out` }
          : undefined
      }
    />
  );
}


const Background = ({
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
  width,
  height,
  isLoaded = true,
}: Readonly<BackgroundProps>): React.ReactElement | undefined => {
  const uniqueId = useSanitizedId();
  const patternId = `chart-background-${uniqueId}`;
  const [hStops, vStops] = useFadeMaskStops(fadeHorizontalLength, fadeVerticalLength);

  const patternNode = resolveBackgroundPattern({
    height, patternId, preset: pattern,
    presetOptions: { color, complement, dotFill, fill, radius, scale, strokeWidth, tileBackground },
    showFill, width,
  });
  if (patternNode === null || patternNode === undefined) {return undefined;}

  const mask = resolveBackgroundMask({ fadeHorizontal, fadeVertical, uniqueId });

  return (
    <g aria-hidden="true" className="chart-background">
      {renderFadeDefs({ fadeHorizontal, fadeVertical, hStops, height, mask, vStops, width })}
      <defs>{patternNode}</defs>
      {renderBackgroundRect({ height, isLoaded, maskRef: mask.maskRef, opacity, patternId, width })}
    </g>
  );
}

// Public alias under the legacy default-export contract.
const ChartBackground = Background;

export type { BackgroundPatternPreset, BackgroundProps };
export { Background, ChartBackground };
export default Background;
