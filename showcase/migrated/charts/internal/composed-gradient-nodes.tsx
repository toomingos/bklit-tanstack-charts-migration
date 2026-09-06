import type { ReactNode } from "react";
import { NOTHING } from "./composed-series";
import type { CrosshairGradientDef } from "./focus-marks";
import type { ProjectionGradientDef } from "./projection-line-mark";
import type { ChartMargin } from "./use-chart-margin";

// Hidden svg sizing: fully static, shared across renders.
const HIDDEN_SVG_STYLE = { position: "absolute" } as const;

// Plain element helpers (not components): called during render, so the element tree
// Keeps the same types/keys and reconciliation is unchanged; they only flatten source nesting.
const renderProjectionGradientStops = (grad: Readonly<ProjectionGradientDef>): ReactNode => (
  <>
    <stop offset="0%" stopColor={grad.gradientStart} />
    <stop offset="100%" stopColor={grad.gradientEnd} />
  </>
);

/*
 * Readonly is shallow, so the nested stops array needs its own readonly wrapper.
 */
type ReadonlyCrosshairGradientDef = Readonly<Omit<CrosshairGradientDef, "stops">> & {
  readonly stops: readonly Readonly<CrosshairGradientDef["stops"][number]>[];
};

const renderCrosshairStops = (def: ReadonlyCrosshairGradientDef): ReactNode => (
  <>
    {def.stops.map((stop: Readonly<CrosshairGradientDef["stops"][number]>) => (
      <stop key={stop.offset} offset={stop.offset} stopColor={def.color} stopOpacity={stop.opacity} />
    ))}
  </>
);

const renderProjectionGradientsNode = (
  defs: readonly Readonly<ProjectionGradientDef>[],
): ReactNode => defs.length > 0 ? (
  <svg
    width={0}
    height={0}
    style={HIDDEN_SVG_STYLE}
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      {defs.map((grad: Readonly<ProjectionGradientDef>) => (
        <linearGradient key={grad.id} id={grad.id} gradientUnits="userSpaceOnUse" x1={grad.startX} y1={grad.startY} x2={grad.endX} y2={grad.endY}>
          {renderProjectionGradientStops(grad)}
        </linearGradient>
      ))}
    </defs>
  </svg>
) : NOTHING;

interface RenderCrosshairNodeParams {
  readonly def: CrosshairGradientDef | undefined;
  readonly heightPx: number;
  readonly margin: Readonly<ChartMargin>;
}

const renderCrosshairNode = (params: Readonly<RenderCrosshairNodeParams>): ReactNode => {
  const { def, heightPx, margin } = params;
  return def ? (
    <svg width={0} height={0} style={HIDDEN_SVG_STYLE} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={def.id} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={margin.top} y2={margin.top + Math.max(0, heightPx - margin.top - margin.bottom)}>
          {renderCrosshairStops(def)}
        </linearGradient>
      </defs>
    </svg>
  ) : NOTHING;
};

export { renderCrosshairNode, renderProjectionGradientsNode };
export type { RenderCrosshairNodeParams };
