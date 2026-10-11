// The cartesian host's scoped stylesheet and inline style, as pure functions of the built definition.
import type { CSSProperties } from "react";
import { bklitSurfaceStyle } from "../theme";
import type { ChartMargin } from "../theme";
import type { CartesianBuild } from "./definition";
import { hoverStaticCss } from "./definition";
import { pillTickStaticCss } from "./date-pill";
import { loadingCss } from "./loading-css";
import type { ResolvedSeries } from "./series";
import { readyGateCss } from "./gate-css";
import { typedAttr } from "../css-hooks";
import { MARKER_BUCKETS } from "./series-marks";

/** Scoped CSS of the host: loading, pre-ready hiding, marker blur, pill tick blanking, hover visuals and brush extent. */
export function cartesianStaticCss(uid: string, built: CartesianBuild, hasBrush: boolean, series: readonly ResolvedSeries[]): string {
  const scope = `[data-bkm-kit="${uid}"]`;
  const pill = built.pillTicks.active ? pillTickStaticCss(scope, built.pillTicks.times, built.pillTicks.reachPx) : null;
  // bklit draws the brush hatch and pills from visx's committed extent, widened by SAFE_PIXEL (2px) per side by getDomainFromExtent and clamped to [0, innerWidth]; the controlled range stays raw and the native rects widen from their plot-local x/width.
  // Fixed text here because the stylesheet pipeline drops attr(type()); Chromium-only (133+), under `@supports` (unguarded, the var() invalidates at computed time: `x:0` / `width:auto` pin both handles to the plot's left edge), other browsers skip the widening.
  const brushExtent = hasBrush
    ? typedAttr(`${scope} [data-chart-brush-selection]{x:max(var(--bkm-brush-ml),calc(attr(x type(<number>))*1px - 2px));width:calc(min(calc(var(--bkm-brush-ml) + var(--bkm-brush-w)),calc(attr(x type(<number>))*1px + attr(width type(<number>))*1px + 2px)) - max(var(--bkm-brush-ml),calc(attr(x type(<number>))*1px - 2px)))}` +
      `${scope} [data-chart-brush-handle=start]{x:max(calc(var(--bkm-brush-ml) - 3px),calc(attr(x type(<number>))*1px - 2px))}` +
      `${scope} [data-chart-brush-handle=end]{x:min(calc(var(--bkm-brush-ml) + var(--bkm-brush-w) - 3px),calc(attr(x type(<number>))*1px + 2px))}`)
    : "";
  // bklit SeriesPointMarker tweens `blur(enterBlur)` -> 0 with the opacity (enterBlur 2px, `--bkm-enter-blur`): the renderer writes the in-flight fade as an opacity attribute, so a fading marker is blurred in proportion; markers are addressed by mark id through data-ts-key (gap #36: dot marks have no className option).
  // Here because the stylesheet pipeline drops attr(type()); typed attr() is Chromium-only (133+), under `@supports` (unguarded, the var() invalidates at computed time: `filter:none`), other browsers enter without the blur.
  const markerBlur = (sel: string, attr: string): string => `${scope} .ts-chart__dot[data-ts-key*="${sel}"] circle[${attr}]:not([${attr}="1"]){filter:blur(calc((1 - attr(${attr} type(<number>), 1)) * var(--bkm-enter-blur, 2) * 1px))}`;
  const markerFade = [":marker:", ":marker-ring:", ":marker-out:"].flatMap((sel) => ["fill-opacity", "stroke-opacity", "opacity"].map((a) => markerBlur(sel, a))).concat([":marker:", ":marker-ring:", ":marker-out:"].map((sel) => `${scope} .ts-chart__dot[data-ts-key*="${sel}"][opacity]:not([opacity="1"]){filter:blur(calc((1 - attr(opacity type(<number>), 1)) * var(--bkm-enter-blur, 2) * 1px))}`)).join("");
  // Bucket ids run 0..MARKER_BUCKETS-1 (series-marks.ts), so one generated rule per bucket covers every id the marks can carry.
  const markerStagger = Array.from({ length: MARKER_BUCKETS }, (_, i) => `${scope} .ts-chart__marks>:is([data-ts-key$=":marker:${i}"],[data-ts-key$=":marker-ring:${i}"],[data-ts-key$=":marker-out:${i}"]){--bkm-mk:${(i / MARKER_BUCKETS).toFixed(4)}}`).join("");
  return [loadingCss(scope, series), markerStagger, readyGateCss(scope, true), typedAttr(markerFade), pill, hoverStaticCss(scope, built.hover), brushExtent, built.backgroundCss(scope)].filter(Boolean).join("");
}

interface BrushVars {
  readonly shownStart: number;
  readonly shownEnd: number;
  readonly blurPx: number | undefined;
}

interface HostStyleInput {
  readonly animationDuration: number;
  readonly margin: ChartMargin;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly xStart: number;
  readonly xSpanMs: number;
  /** Set with a Brush child (and a non-empty x span): the shown range in ms and the pane blur. */
  readonly brush: BrushVars | undefined;
  readonly clipped: boolean;
  readonly style: CSSProperties | undefined;
}

/** The host's inline style: size, the `--bkm-*` custom properties the scoped CSS reads, and the caller's style last. */
export function cartesianHostStyle({ animationDuration, margin, innerWidth, innerHeight, xStart, xSpanMs, brush, clipped, style }: HostStyleInput): CSSProperties {
  return {
    width: "100%",
    position: "relative",
    ...({
      "--bkm-enter-ms": `${animationDuration}ms`,
      // bklit clips the series group (point markers included) to the plot rect plus 20px below (time-series-chart-shell.tsx:658, innerHeight + 20).
      "--bkm-plot-clip": `inset(${margin.top}px ${margin.right}px ${margin.bottom - 20}px ${margin.left}px)`,
      ...(brush && xSpanMs > 0
        ? {
            "--bkm-brush-ml": `${margin.left}px`,
            "--bkm-brush-mt": `${margin.top}px`,
            "--bkm-brush-h": `${innerHeight}px`,
            "--bkm-brush-w": `${innerWidth}px`,
            // bklit's track overlay reads the same 2px-widened (SAFE_PIXEL), plot-clamped extent as the pills and hatch.
            "--bkm-brush-x0": `${Math.max(0, Math.min(innerWidth, ((brush.shownStart - xStart) / xSpanMs) * innerWidth - 2))}px`,
            "--bkm-brush-x1": `${Math.max(0, Math.min(innerWidth, ((brush.shownEnd - xStart) / xSpanMs) * innerWidth + 2))}px`,
            "--bkm-brush-blur": `${Math.min(5, Math.max(0, brush.blurPx ?? 1.5))}px`,
          }
        : null),
    } satisfies Record<string, string>),
    ...(clipped
      ? ({
          "--bkm-clip": `inset(${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px)`,
          "--bkm-clip-t": `${margin.top}px`,
          "--bkm-clip-r": `${margin.right}px`,
          "--bkm-clip-b": `${margin.bottom}px`,
          "--bkm-clip-l": `${margin.left}px`,
        } satisfies Record<string, string>)
      : null),
    userSelect: "none",
    WebkitUserSelect: "none",
    ...bklitSurfaceStyle,
    ...style,
  };
}
