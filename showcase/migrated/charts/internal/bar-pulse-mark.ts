import { createMark } from "@tanstack/charts";
import type { ChartMark, MarkRenderContext, MarkScene, SceneNode } from "@tanstack/charts";
import { numericBarCell } from "./bar-chart-hover-dots";
import { barDepthAndRise, barDepthMaxDepth, resolveBandFrame } from "./bar-depth-geometry";
import type { BarPulseConfig, ChartDatum } from "./types";

const PULSE_WAVE_HEIGHT_RATIO = 0.55;
const PULSE_WAVE_HEIGHT_MIN_PX = 36;

interface BarSilhouetteArgs {
  readonly bandX: number;
  readonly bandWidth: number;
  readonly topY: number;
  readonly bottomY: number;
  readonly depth: number;
  readonly perspectiveRise: number;
  readonly isRightOfCenter: boolean;
}

const buildBarSilhouettePath = (silhouette: Readonly<BarSilhouetteArgs>): string => {
  if (silhouette.depth <= 0) {
    return [`M ${silhouette.bandX} ${silhouette.topY}`, `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.topY}`, `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.bottomY}`, `L ${silhouette.bandX} ${silhouette.bottomY}`, "Z"].join(" ");
  }
  if (silhouette.isRightOfCenter) {
    return [
      `M ${silhouette.bandX - silhouette.depth} ${silhouette.topY - silhouette.perspectiveRise}`,
      `L ${silhouette.bandX + silhouette.bandWidth - silhouette.depth} ${silhouette.topY - silhouette.perspectiveRise}`,
      `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.topY}`,
      `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.bottomY}`,
      `L ${silhouette.bandX} ${silhouette.bottomY}`,
      `L ${silhouette.bandX - silhouette.depth} ${silhouette.bottomY - silhouette.perspectiveRise}`,
      "Z",
    ].join(" ");
  }
  return [
    `M ${silhouette.bandX} ${silhouette.topY}`,
    `L ${silhouette.bandX + silhouette.depth} ${silhouette.topY - silhouette.perspectiveRise}`,
    `L ${silhouette.bandX + silhouette.bandWidth + silhouette.depth} ${silhouette.topY - silhouette.perspectiveRise}`,
    `L ${silhouette.bandX + silhouette.bandWidth + silhouette.depth} ${silhouette.bottomY - silhouette.perspectiveRise}`,
    `L ${silhouette.bandX + silhouette.bandWidth} ${silhouette.bottomY}`,
    `L ${silhouette.bandX} ${silhouette.bottomY}`,
    "Z",
  ].join(" ");
}

interface BarPulseMarkOptions {
  readonly id: string;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
  readonly activeIndex?: number;
  readonly pulsePaused?: boolean;
  /** Id of the host-built wave linearGradient def (see buildPulseWaveStops). */
  readonly gradientId: string;
}

interface ActivePulseIndexArgs {
  readonly activeIndex: number | undefined;
  readonly dataLength: number;
  readonly pulsePaused: boolean | undefined;
}

// Validates the pulse target; undefined when the pulse must not render. Hoisted so barPulseMark stays short.
const resolveActivePulseIndex = (indexArgs: Readonly<ActivePulseIndexArgs>): number | undefined => {
  if (indexArgs.pulsePaused === true) {return undefined;}
  if (indexArgs.activeIndex === undefined || !Number.isFinite(indexArgs.activeIndex)) {return undefined;}
  if (indexArgs.activeIndex < 0 || indexArgs.activeIndex >= indexArgs.dataLength) {return undefined;}
  return indexArgs.activeIndex;
};

interface BarPulseChannelsArgs {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly yAccessor: (datum: Readonly<ChartDatum>) => number;
}

interface BarPulseChannels {
  readonly xValues: string[];
  readonly yValues: readonly number[];
}

// Channel values for the pulse mark; hoisted so the mark factory stays short.
const buildBarPulseChannels = (channelArgs: Readonly<BarPulseChannelsArgs>): BarPulseChannels => ({
  xValues: channelArgs.data.map((datum) => channelArgs.categoryAccessor(datum)),
  yValues: channelArgs.data.map((datum) => channelArgs.yAccessor(datum)),
});

interface ActivePulseBarArgs {
  readonly activeIndex: number;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly scales: MarkRenderContext["scales"];
}

interface ActivePulseBar {
  readonly xValue: string | undefined;
  readonly yValue: number;
  readonly baseline: number;
  readonly valuePos: number;
  readonly isNegative: boolean;
}

// Finite-number check for pulse channel values; hoisted so readers stay short.
const isNumber = <Value>(value: Value): value is Value & number => typeof value === "number";

// Active bar values plus its pixel positions; undefined when nothing may paint. Hoisted so the scene renderer stays short.
const readActivePulseBar = (readArgs: Readonly<ActivePulseBarArgs>): ActivePulseBar | undefined => {
  const datum = readArgs.data.at(readArgs.activeIndex);
  if (!datum) {return undefined;}
  const yValue = readArgs.yValues[readArgs.activeIndex];
  if (!isNumber(yValue) || !Number.isFinite(yValue) || yValue === 0) {return undefined;}
  const baseline = readArgs.scales.y.map(0);
  const valuePos = readArgs.scales.y.map(yValue);
  return { baseline, isNegative: yValue < 0, valuePos, xValue: readArgs.xValues[readArgs.activeIndex], yValue };
};

interface DepthOffsetArgs {
  readonly bandX: number;
  readonly bandWidth: number;
  readonly innerWidth: number;
  readonly centerX: number;
}

interface DepthOffset {
  readonly absOffset: number;
  readonly isRightOfCenter: boolean;
}

// Perspective offset of the bar from the chart center; hoisted so the frame resolver stays short.
const resolveDepthOffset = (offsetArgs: Readonly<DepthOffsetArgs>): DepthOffset => {
  const cx = offsetArgs.bandX + offsetArgs.bandWidth / 2;
  const offsetFromCenter = offsetArgs.innerWidth > 0 ? (cx - offsetArgs.centerX) / (offsetArgs.innerWidth / 2) : 0;
  return { absOffset: Math.min(1, Math.abs(offsetFromCenter)), isRightOfCenter: offsetFromCenter > 0 };
};

interface PulseBarFrameArgs {
  readonly bandX: number;
  readonly bandWidth: number;
  readonly bandStep: number;
  readonly innerWidth: number;
  readonly centerX: number;
  readonly baseline: number;
  readonly valuePos: number;
  readonly isNegative: boolean;
}

interface PulseBarFrame {
  readonly bandX: number;
  readonly depth: number;
  readonly perspectiveRise: number;
  readonly isRightOfCenter: boolean;
  readonly isNegative: boolean;
  readonly topY: number;
  readonly bottomY: number;
  readonly barHeight: number;
}

// Bar frame in pixels; undefined when the bar has no positive length. Hoisted so the scene renderer stays short.
const resolvePulseBarFrame = (frameArgs: Readonly<PulseBarFrameArgs>): PulseBarFrame | undefined => {
  if (!Number.isFinite(frameArgs.valuePos)) {return undefined;}
  const topY = Math.min(frameArgs.baseline, frameArgs.valuePos);
  const bottomY = Math.max(frameArgs.baseline, frameArgs.valuePos);
  const barLengthPx = bottomY - topY;
  if (barLengthPx <= 0) {return undefined;}
  const maxDepth = barDepthMaxDepth(frameArgs.bandStep, frameArgs.bandWidth);
  const offset = resolveDepthOffset({ bandWidth: frameArgs.bandWidth, bandX: frameArgs.bandX, centerX: frameArgs.centerX, innerWidth: frameArgs.innerWidth });
  const { depth, perspectiveRise } = barDepthAndRise(offset.absOffset, barLengthPx, maxDepth);
  return { bandX: frameArgs.bandX, barHeight: barLengthPx, bottomY, depth, isNegative: frameArgs.isNegative, isRightOfCenter: offset.isRightOfCenter, perspectiveRise, topY };
};

interface PulseNodeArgs {
  readonly id: string;
  readonly frame: Readonly<PulseBarFrame>;
  readonly bandWidth: number;
  readonly gradientId: string;
}

interface BarPulseSweep {
  readonly silhouettePath: string;
  readonly waveHeight: number;
  readonly waveY: number;
  readonly travelPx: number;
}

// Sweep endpoints from the frame (bklit root-to-tip: positives park at the floor and rise, negatives park above the lid and fall).
const resolveBarPulseSweep = (frame: Readonly<PulseBarFrame>, bandWidth: number): BarPulseSweep => {
  const silhouettePath = buildBarSilhouettePath({ bandWidth, bandX: frame.bandX, bottomY: frame.bottomY, depth: frame.depth, isRightOfCenter: frame.isRightOfCenter, perspectiveRise: frame.perspectiveRise, topY: frame.topY });
  const waveHeight = Math.max(frame.barHeight * PULSE_WAVE_HEIGHT_RATIO, PULSE_WAVE_HEIGHT_MIN_PX);
  const yAboveLid = frame.topY - frame.perspectiveRise - waveHeight;
  const waveY = frame.isNegative ? yAboveLid : frame.bottomY;
  const yEnd = frame.isNegative ? frame.bottomY : yAboveLid;
  return { silhouettePath, travelPx: yEnd - waveY, waveHeight, waveY };
};

// Silhouette + wave nodes; hoisted so the scene renderer stays a short decision chain.
const buildBarPulseNodes = (nodeArgs: Readonly<PulseNodeArgs>): SceneNode[] => {
  const sweep = resolveBarPulseSweep(nodeArgs.frame, nodeArgs.bandWidth);
  const nodes: SceneNode[] = [
    {
      ariaHidden: true,
      children: [
        // Invisible silhouette; the seam mask reuses this path as its crop (no scene clipPath node type).
        {
          key: `${nodeArgs.id}:silhouette`,
          kind: "area",
          path: sweep.silhouettePath,
          points: [],
          style: { fill: "none" },
        },
        // Wave parked at sweep start (bar bottom, or above the lid for negatives); the CSS keyframes loop carries it to the bar top.
        {
          className: "ts-bkm-bar-pulse-wave",
          height: sweep.waveHeight,
          key: `${nodeArgs.id}:wave`,
          kind: "rect",
          style: { fill: `url(#${nodeArgs.gradientId})` },
          width: nodeArgs.bandWidth + 2 * nodeArgs.frame.depth + 2,
          x: nodeArgs.frame.bandX - nodeArgs.frame.depth - 1,
          y: sweep.waveY,
        },
      ],
      // Renamed off the `ts-chart__bar` substring so native motion role probing never matches.
      className: "bkm-chart__bar-pulse",
      key: nodeArgs.id,
      kind: "group",
    },
  ];
  return nodes;
};

interface PulseSceneInput {
  readonly frame: PulseBarFrame;
  readonly bandWidth: number;
}

interface PulseSceneInputArgs {
  readonly scales: MarkRenderContext["scales"];
  readonly chartX: number;
  readonly chartWidth: number;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly activeIndex: number;
}

// Frame for the active bar from the package scales; undefined when nothing may paint. Shared by the mark and the seam publisher so both read one geometry.
const resolvePulseSceneInput = (inputArgs: Readonly<PulseSceneInputArgs>): PulseSceneInput | undefined => {
  const active = readActivePulseBar({ activeIndex: inputArgs.activeIndex, data: inputArgs.data, scales: inputArgs.scales, xValues: inputArgs.xValues, yValues: inputArgs.yValues });
  if (!active) {return undefined;}
  // Band geometry resolves at scene build from the package scale (V1.2/G6).
  const { bandPos, bandStep, bandWidth } = resolveBandFrame(inputArgs.scales.x);
  const frame = resolvePulseBarFrame({ bandStep, bandWidth, bandX: bandPos(String(active.xValue)), baseline: active.baseline, centerX: inputArgs.chartX + inputArgs.chartWidth / 2, innerWidth: inputArgs.chartWidth, isNegative: active.isNegative, valuePos: active.valuePos });
  if (!frame) {return undefined;}
  return { bandWidth, frame };
};

interface BarPulseOverlay {
  readonly clipD: string;
  readonly travelPx: number;
}

interface BarPulseOverlayArgs {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly pulses: readonly Readonly<BarPulseConfig>[];
  readonly categoryAccessor: (datum: Readonly<ChartDatum>) => string;
  readonly projectValue: (dataKey: string, value: number) => number;
  readonly scales: MarkRenderContext["scales"];
  readonly chartX: number;
  readonly chartWidth: number;
}

// Geometry for one pulse config; null when that pulse must not render.
// Hoisted so the resolver below is a first-match scan with no loop jumps.
const resolveOnePulseOverlay = (pulse: Readonly<BarPulseConfig>, overlayArgs: Readonly<BarPulseOverlayArgs>): BarPulseOverlay | null => {
  const index = resolveActivePulseIndex({ activeIndex: pulse.activeIndex, dataLength: overlayArgs.data.length, pulsePaused: pulse.pulsePaused });
  if (index === undefined) {return null;}
  const yAccessor = (datum: Readonly<ChartDatum>): number => overlayArgs.projectValue(pulse.dataKey, numericBarCell(datum, pulse.dataKey));
  const input = resolvePulseSceneInput({
    activeIndex: index,
    chartWidth: overlayArgs.chartWidth,
    chartX: overlayArgs.chartX,
    data: overlayArgs.data,
    scales: overlayArgs.scales,
    xValues: overlayArgs.data.map((datum) => overlayArgs.categoryAccessor(datum)),
    yValues: overlayArgs.data.map(yAccessor),
  });
  if (!input) {return null;}
  const sweep = resolveBarPulseSweep(input.frame, input.bandWidth);
  return { clipD: sweep.silhouettePath, travelPx: sweep.travelPx };
};

// Seam inputs for the first pulse with live geometry (clip path + CSS travel); null when no pulse renders. Same helper as the mark, so the seam can never drift from the scene.
const resolveBarPulseOverlay = (overlayArgs: Readonly<BarPulseOverlayArgs>): BarPulseOverlay | null => {
  for (const pulse of overlayArgs.pulses) {
    const overlay = resolveOnePulseOverlay(pulse, overlayArgs);
    if (overlay !== null) {return overlay;}
  }
  return null;
};

interface PulseSceneArgs {
  readonly context: MarkRenderContext;
  readonly data: readonly Readonly<ChartDatum>[];
  readonly xValues: readonly string[];
  readonly yValues: readonly number[];
  readonly activeIndex: number;
  readonly gradientId: string;
  readonly id: string;
}

// Scene for the active bar; empty when nothing may paint. Hoisted so the mark factory stays short.
const renderBarPulseScene = (sceneArgs: Readonly<PulseSceneArgs>): MarkScene<ChartDatum, string, number> => {
  const input = resolvePulseSceneInput({
    activeIndex: sceneArgs.activeIndex,
    chartWidth: sceneArgs.context.chart.width,
    chartX: sceneArgs.context.chart.x,
    data: sceneArgs.data,
    scales: sceneArgs.context.scales,
    xValues: sceneArgs.xValues,
    yValues: sceneArgs.yValues,
  });
  if (!input) {return { nodes: [], points: [] };}
  return { nodes: buildBarPulseNodes({ bandWidth: input.bandWidth, frame: input.frame, gradientId: sceneArgs.gradientId, id: sceneArgs.id }) };
};

interface BarPulseMarkInstanceArgs {
  readonly data: readonly Readonly<ChartDatum>[];
  readonly options: Readonly<BarPulseMarkOptions>;
  readonly index: number;
}

// Mark instance wiring; hoisted so barPulseMark stays a short validation + delegation.
const createBarPulseMarkInstance = (instanceArgs: Readonly<BarPulseMarkInstanceArgs>): ChartMark<ChartDatum, string, number> => {
  const channels = buildBarPulseChannels({ categoryAccessor: instanceArgs.options.categoryAccessor, data: instanceArgs.data, yAccessor: instanceArgs.options.yAccessor });
  // Motion forced off: the pulse travel is a CSS keyframes loop on the wave rect, and this must never match native motion's role probe.
  return createMark(() => ({
    channels: {
      x: { scale: "x", values: channels.xValues },
      y: {
        includeZero: true,
        scale: "y",
        values: channels.yValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      },
    },
    id: instanceArgs.options.id,
    render: (context: MarkRenderContext): MarkScene<ChartDatum, string, number> => renderBarPulseScene({
      activeIndex: instanceArgs.index,
      context,
      data: instanceArgs.data,
      gradientId: instanceArgs.options.gradientId,
      id: instanceArgs.options.id,
      xValues: channels.xValues,
      yValues: channels.yValues,
    }),
  }), () => false);
};

const barPulseMark = (data: readonly Readonly<ChartDatum>[], options: Readonly<BarPulseMarkOptions>): ChartMark<ChartDatum, string, number> | null => {
  const index = resolveActivePulseIndex({ activeIndex: options.activeIndex, dataLength: data.length, pulsePaused: options.pulsePaused });
  if (index === undefined) {return null;}
  return createBarPulseMarkInstance({ data, index, options });
};

export {
  barPulseMark,
  buildBarSilhouettePath,
  resolveBarPulseOverlay,
  PULSE_WAVE_HEIGHT_MIN_PX,
  PULSE_WAVE_HEIGHT_RATIO,
};
export { buildPulseWaveStops, PULSE_WAVE_DURATION_S, PULSE_WAVE_PEAK_OPACITY } from "./bar-pulse-clip";
export type { BarPulseMarkOptions };
export type { PulseWaveGradientStop } from "./bar-pulse-clip";
