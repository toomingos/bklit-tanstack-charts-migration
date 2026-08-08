// Migrated bklit-ui LineChart — same public API, rendered by TanStack Charts.
// Architecture per docs/LOG.md D10: children are config carriers compiled into
// one `defineChart` spec; React commits the SVG once (TanStack adapter);
// data changes go through adapter.update(); the mount reveal is a WAAPI
// clip-path animation on the marks group (zero per-frame JS/React).
import * as React from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleTime } from "d3-scale";
import { curveNatural } from "d3-shape";
import { Chart } from "@tanstack/react-charts";
import { d3Curve, defineChart, lineY } from "@tanstack/charts";
import type { ChartMark, ChartPoint, ChartScale } from "@tanstack/charts";
import {
  decimateTimeSeries,
  maxRenderPointsForWidth,
} from "./internal/decimate";
import { extractChildren } from "./children";
import {
  attachHoverChrome,
  type HoverChrome,
  type HoverChromeState,
} from "./internal/hover-chrome";
import { XAxisOverlay } from "./internal/x-axis-overlay";
import { YAxisOverlay } from "./internal/y-axis-overlay";
import type { ChartDatum, ChartPhase, ChartStatus } from "./internal/types";
import { parseAspectRatio } from "./internal/parse-aspect-ratio";
import { bezierEasing } from "./internal/bezier-easing";
import "./styles.css";

// bklit animation constants (animation.ts): reveal 1100ms cubic-bezier(.85,0,.15,1)
const DEFAULT_ANIMATION_DURATION_MS = 1100;
const REVEAL_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
// bklit chart-phase.ts DEFAULT_Y_DOMAIN_TWEEN_MS
const DATA_TWEEN_MS = 500;

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

export interface LineChartProps {
  data: ChartDatum[];
  xDataKey?: string;
  status?: ChartStatus;
  animationDuration?: number;
  margin?: Partial<Margin>;
  aspectRatio?: string;
  className?: string;
  onPhaseChange?: (phase: ChartPhase) => void;
  children?: React.ReactNode;
  loadingLabel?: string;
  style?: React.CSSProperties;
  animationEasing?: string;
  yDomainTween?: boolean;
  yDomainTweenDuration?: number;
}

export function LineChart({
  data,
  xDataKey = "date",
  status = "ready",
  animationDuration = DEFAULT_ANIMATION_DURATION_MS,
  margin: marginProp,
  aspectRatio = "2 / 1",
  className,
  onPhaseChange,
  children,
  loadingLabel,
  style,
  animationEasing = REVEAL_EASING,
  yDomainTween = true,
  yDomainTweenDuration = DATA_TWEEN_MS,
}: LineChartProps) {
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);
  const phaseRef = React.useRef<ChartPhase>(status === "ready" ? "ready" : "loading");
  const revealAnimRef = React.useRef<Animation | null>(null);
  const widthTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWidthRef = React.useRef<number | null>(null);
  const xScaleD3Ref = React.useRef<ScaleTime<number, number> | null>(null);
  const onPhaseChangeRef = React.useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const setPhase = React.useCallback((phase: ChartPhase) => {
    if (phaseRef.current === phase) return;
    phaseRef.current = phase;
    onPhaseChangeRef.current?.(phase);
  }, []);

  // Container measurement — debounced 10ms (bklit ParentSize debounceTime
  // parity; audit §4 C4). Prevents resize-drag thrash rebuilding definition.
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const commitWidth = (w: number) => {
      if (widthTimerRef.current !== null) {
        clearTimeout(widthTimerRef.current);
        widthTimerRef.current = null;
      }
      pendingWidthRef.current = w;
      widthTimerRef.current = setTimeout(() => {
        const pending = pendingWidthRef.current;
        widthTimerRef.current = null;
        if (pending === null) return;
        setWidth((prev) => (Math.abs(prev - pending!) > 0.5 ? pending! : prev));
      }, 10);
    };
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      commitWidth(w);
    });
    ro.observe(el);
    commitWidth(el.getBoundingClientRect().width);
    return () => {
      ro.disconnect();
      if (widthTimerRef.current !== null) {
        clearTimeout(widthTimerRef.current);
        widthTimerRef.current = null;
      }
    };
  }, []);

  const { lines, grid, xAxis, yAxis, tooltip } = React.useMemo(
    () => extractChildren(children),
    [children],
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const renderData = React.useMemo(() => {
    if (innerWidth <= 0) return data;
    return decimateTimeSeries(
      data,
      maxRenderPointsForWidth(innerWidth),
      lines.map((l) => l.dataKey),
    );
  }, [data, innerWidth, lines]);

  // bklit y-domain parity — exact port of time-series-chart-shell.tsx
  // `resolveTimeSeriesYDomain` + `niceYDomain` (d3 .nice() applied by the
  // configured scale below): all-values>=0 -> [0, max*1.1]; mixed-sign ->
  // [min,max] padded 5% each side; empty -> [0,100].
  const yDomain = React.useMemo<[number, number]>(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of data) {
      for (const line of lines) {
        const v = row[line.dataKey];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (!Number.isFinite(min)) return [0, 100];
    if (min >= 0) return [0, max <= 0 ? 100 : max * 1.1];
    const padding = (max - min) * 0.05 || 1;
    return [min - padding, max + padding];
  }, [data, lines]);

  // bklit data-update behavior (chart-phase.ts): new data paints IMMEDIATELY;
  // only a y-DOMAIN change tweens (500ms scale tween). So animate the scene
  // only when the nice domain actually moved — otherwise snap like bklit.
  const nicedYDomain = React.useMemo<[number, number]>(
    () => scaleLinear().domain(yDomain).nice().domain() as [number, number],
    [yDomain],
  );
  const yDomainTweenRef = React.useRef(yDomainTween);
  const yDomainTweenDurationRef = React.useRef(yDomainTweenDuration);
  yDomainTweenRef.current = yDomainTween;
  yDomainTweenDurationRef.current = yDomainTweenDuration;
  const prevNicedYDomainForTweenRef = React.useRef(nicedYDomain);
  const yDomainChangedForTween = React.useMemo(() => {
    const prev = prevNicedYDomainForTweenRef.current;
    const changed = prev[0] !== nicedYDomain[0] || prev[1] !== nicedYDomain[1];
    prevNicedYDomainForTweenRef.current = nicedYDomain;
    return changed;
  }, [nicedYDomain]);

  const marks = React.useMemo<ChartMark<ChartDatum, Date, number>[]>(
    () =>
      lines.map((line) =>
        lineY(renderData, {
          id: line.dataKey,
          x: (d: ChartDatum) => d[xDataKey] as Date,
          y: (d: ChartDatum) => d[line.dataKey] as number,
          curve: d3Curve(line.curve ?? curveNatural),
          stroke: line.stroke,
          strokeWidth: line.strokeWidth ?? 2.5,
        }),
      ),
    [renderData, xDataKey, lines],
  );

  const spec = React.useMemo(() => {
    if (width <= 0) return null;
    // C2: single source for nicedYDomain — avoids twin .nice() drift
    // (audit §4 row 5 duped domain). Reuse the same niced tuple here and
    // pass it through to YAxisOverlay.
    const niced = nicedYDomain;
    // C1: stash real time scale via ChartScale.resolve (mirrors
    // composed-chart.tsx xScale shim: resolve hooks runs after context
    // range is known and persists the mapped instance for xForIndex).
    const xScale: ChartScale = {
      id: "x",
      resolve(context) {
        const [r0, r1] = context.range;
        let minTime = Infinity;
        let maxTime = -Infinity;
        for (const d of renderData) {
          const v = d[xDataKey];
          if (v instanceof Date) {
            const t = v.getTime();
            if (t < minTime) minTime = t;
            if (t > maxTime) maxTime = t;
          }
        }
        if (!Number.isFinite(minTime)) {
          const base = scaleUtc();
          base.domain([0, 0]);
          base.range([r0, r1]);
          xScaleD3Ref.current = base as unknown as ScaleTime<number, number>;
          return {
            id: context.id,
            type: "time",
            domain: base.domain(),
            map: (value: unknown) => {
              const m = base(value as Date);
              return m === undefined ? Number.NaN : m;
            },
            ticks: [],
            bandwidth: 0,
          };
        }
        const base = scaleUtc().domain([minTime, maxTime]).range([r0, r1]);
        xScaleD3Ref.current = base as unknown as ScaleTime<number, number>;
        const ticks = base.ticks(context.tickCount ?? 5);
        return {
          id: context.id,
          type: "time",
          domain: base.domain(),
          map: (value: unknown) => {
            const m = base(value as Date);
            return m === undefined ? Number.NaN : m;
          },
          ticks: ticks.map((value) => ({
            value,
            position: base(value) ?? Number.NaN,
            label: value.toISOString(),
          })),
          bandwidth: 0,
        };
      },
    };
    const yScale = scaleLinear().domain(niced);
    const animate =
      yDomainTweenRef.current && yDomainChangedForTween
        ? { duration: yDomainTweenDurationRef.current, easing: bezierEasing }
        : false;
    return {
      marks,
      x: { scale: xScale, guide: false },
      y: { scale: yScale, grid: grid?.horizontal ?? false, ticks: grid?.numTicks ?? 5 },
      margin,
      focus: "group-x" as const,
      maxFocusDistance: Number.POSITIVE_INFINITY as const,
      animate,
    };
  }, [marks, renderData, xDataKey, grid, width, nicedYDomain, yDomainChangedForTween, margin]);

  const definition = React.useMemo(() => {
    if (!spec) return null;
    return defineChart(spec);
  }, [spec]);

  // Hover chrome (bklit ChartTooltip): imperative overlays driven by
  // TanStack's focus callbacks — no React work per pointer move. The state
  // ref keeps the chrome reading current geometry without re-attaching.
  const tooltipEnabled = tooltip?.enabled ?? false;
  const chromeRef = React.useRef<HoverChrome | null>(null);
  const chromeStateRef = React.useRef<HoverChromeState | null>(null);
  const xForIndex = React.useCallback(
    (index: number) => {
      const xScaleInstance = xScaleD3Ref.current;
      const row = renderData[index];
      const value = row?.[xDataKey];
      if (!xScaleInstance || !(value instanceof Date)) return margin.left;
      const mapped = xScaleInstance(value);
      return mapped ?? margin.left;
    },
    [renderData, xDataKey, margin.left],
  );
  chromeStateRef.current = {
    margin,
    series: lines.map((line) => ({
      dataKey: line.dataKey,
      color: line.stroke ?? "",
      strokeWidth: line.strokeWidth ?? 2.5,
      showHighlight: line.showHighlight ?? true,
    })),
    xDataKey,
    pointCount: renderData.length,
    xForIndex,
    showCrosshair: tooltip?.showCrosshair ?? true,
    showDots: tooltip?.showDots ?? true,
    showDatePill: tooltip?.showDatePill ?? true,
  };

  const overlayHostRef = React.useRef<HTMLDivElement | null>(null);
  const hasDefinition = width > 0;

  React.useLayoutEffect(() => {
    const el = overlayHostRef.current;
    if (!el || !tooltipEnabled) return;
    const chrome = attachHoverChrome(el, () => chromeStateRef.current!);
    chromeRef.current = chrome;
    return () => {
      chromeRef.current = null;
      chrome.detach();
    };
  }, [tooltipEnabled, hasDefinition]);

  const handleFocusGroupChange = React.useCallback(
    (points: readonly ChartPoint<ChartDatum, Date, number>[]) => {
      // bklit gates interaction on the ready phase (canInteract).
      chromeRef.current?.onFocusGroupChange(
        phaseRef.current === "ready" ? points : [],
      );
    },
    [],
  );

  // Mount reveal: bklit's ChartRevealClip equivalent — clip the marks group
  // left→right once, via WAAPI. Runs outside React; fires phase transitions.
  const handleRender = React.useCallback(() => {
    const marks = containerRef.current?.querySelector<SVGGElement>(
      ".ts-chart__marks",
    );
    if (!marks || marks.dataset.bkmRevealed === "1" || animationDuration <= 0) {
      setPhase("ready");
      return;
    }
    marks.dataset.bkmRevealed = "1";
    setPhase("revealing");
    revealAnimRef.current?.cancel();
    const anim = marks.animate(
      [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: animationDuration, easing: animationEasing },
    );
    revealAnimRef.current = anim;
    let settled = false;
    const finishReady = () => {
      if (settled) return;
      settled = true;
      revealAnimRef.current = null;
      setPhase("ready");
    };
    anim.onfinish = finishReady;
    anim.oncancel = () => {
      settled = true;
      revealAnimRef.current = null;
    };
  }, [animationDuration, setPhase, animationEasing]);

  React.useEffect(
    () => () => {
      const anim = revealAnimRef.current;
      if (anim) {
        try {
          anim.cancel();
        } catch {
          // ignore
        }
        revealAnimRef.current = null;
      }
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio, ...style }}
      data-bkm-chart="line"
      // bklit line.tsx fadeEdges default true → edge-fade mask (styles.css).
      data-bkm-fade-edges={
        lines.some((l) => (l.fadeEdges ?? true) !== false) ? "" : undefined
      }
      data-bkm-fade-edges-left={
        lines.some((l) => {
          const fe = l.fadeEdges ?? true;
          return fe === true || fe === "left";
        })
          ? ""
          : undefined
      }
      data-bkm-fade-edges-right={
        lines.some((l) => {
          const fe = l.fadeEdges ?? true;
          return fe === true || fe === "right";
        })
          ? ""
          : undefined
      }
    >
      {loadingLabel && status !== "ready" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <span className="ts-bkm-loading-label">{loadingLabel}</span>
        </div>
      ) : null}
      {definition ? (
        <>
          <Chart
            ariaLabel="Line chart"
            aspectRatio={parseAspectRatio(aspectRatio)}
            definition={definition}
            onFocusGroupChange={handleFocusGroupChange}
            onRender={handleRender}
          />
          {xAxis ? (
            <XAxisOverlay
              data={renderData}
              xDataKey={xDataKey}
              rangeStart={margin.left}
              rangeEnd={width - margin.right}
              numTicks={xAxis.numTicks ?? 5}
              formatValue={xAxis.formatValue}
            />
          ) : null}
          {yAxis ? (
            <YAxisOverlay
              yDomain={nicedYDomain}
              chartTop={margin.top}
              chartBottom={width / parseAspectRatio(aspectRatio) - margin.bottom}
              chartLeft={margin.left}
              chartRight={margin.right}
              orientation={yAxis.orientation ?? "left"}
              numTicks={yAxis.numTicks ?? 5}
              formatLargeNumbers={yAxis.formatLargeNumbers ?? true}
              formatValue={yAxis.formatValue}
            />
          ) : null}
          {tooltipEnabled ? (
            <div
              ref={overlayHostRef}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

