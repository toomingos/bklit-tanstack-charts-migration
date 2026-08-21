import * as React from "react";
import { BACKGROUND_ENTER_FADE_MS } from "./design-tokens";
import { edgeFadeMaskStops } from "./fade-mask";
import {
  type PatternPresetId,
  type PatternPresetOptions,
  renderPatternPreset,
} from "./pattern-preset";

export type BackgroundPatternPreset = PatternPresetId;

export interface BackgroundProps extends PatternPresetOptions {
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


export function Background({
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
}: BackgroundProps) {
  const uniqueId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const patternId = `chart-background-${uniqueId}`;
  const hStops = React.useMemo(() => edgeFadeMaskStops(fadeHorizontalLength), [fadeHorizontalLength]);
  const vStops = React.useMemo(() => edgeFadeMaskStops(fadeVerticalLength), [fadeVerticalLength]);

  if (pattern === "none" || !showFill || width <= 0 || height <= 0) {
    return null;
  }

  const patternNode = renderPatternPreset(pattern, patternId, {
    color,
    scale,
    strokeWidth,
    radius,
    complement,
    fill,
    dotFill,
    tileBackground,
  });
  if (!patternNode) return null;

  const fadeMask = fadeHorizontal || fadeVertical;
  const hMaskId = `chart-background-fade-h-${uniqueId}`;
  const hGradientId = `${hMaskId}-gradient`;
  const vMaskId = `chart-background-fade-v-${uniqueId}`;
  const vGradientId = `${vMaskId}-gradient`;
  const combinedMaskId = `chart-background-fade-${uniqueId}`;

  let maskRef: string | undefined;
  if (fadeHorizontal && fadeVertical) maskRef = `url(#${combinedMaskId})`;
  else if (fadeHorizontal) maskRef = `url(#${hMaskId})`;
  else if (fadeVertical) maskRef = `url(#${vMaskId})`;

  return (
    <g aria-hidden="true" className="chart-background">
      {fadeMask ? (
        <defs>
          {fadeHorizontal ? (
            <>
              <linearGradient id={hGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
                {hStops.map((stop) => (
                  <stop key={stop.offset} offset={stop.offset} style={{ stopColor: "white", stopOpacity: stop.opacity }} />
                ))}
              </linearGradient>
              <mask id={hMaskId}>
                <rect fill={`url(#${hGradientId})`} height={height} width={width} x={0} y={0} />
              </mask>
            </>
          ) : null}
          {fadeVertical ? (
            <>
              <linearGradient id={vGradientId} x1="0%" x2="0%" y1="0%" y2="100%">
                {vStops.map((stop) => (
                  <stop key={stop.offset} offset={stop.offset} style={{ stopColor: "white", stopOpacity: stop.opacity }} />
                ))}
              </linearGradient>
              <mask id={vMaskId}>
                <rect fill={`url(#${vGradientId})`} height={height} width={width} x={0} y={0} />
              </mask>
            </>
          ) : null}
          {fadeHorizontal && fadeVertical ? (
            <mask id={combinedMaskId}>
              <g mask={`url(#${hMaskId})`}>
                <rect fill={`url(#${vGradientId})`} height={height} width={width} x={0} y={0} />
              </g>
            </mask>
          ) : null}
        </defs>
      ) : null}
      <defs>{patternNode}</defs>
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
    </g>
  );
}

export default Background;
